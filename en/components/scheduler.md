# kube-scheduler

kube-scheduler负责分配调度Pod到集群内的节点上，它监听kube-apiserver，查询还未分配Node的Pod，然后根据调度策略为这些Pod分配节点（更新Pod的`NodeName`字段）。

调度器需要充分考虑诸多的因素：

- 公平调度
- 资源高效利用
- QoS
- affinity 和 anti-affinity
- 数据本地化（data locality）
- 内部负载干扰（inter-workload interference）
- deadlines

## 指定Node节点调度

有三种方式指定Pod只运行在指定的Node节点上

- nodeSelector：只调度到匹配指定label的Node上
- nodeAffinity：功能更丰富的Node选择器，比如支持集合操作
- podAffinity：调度到满足条件的Pod所在的Node上

### nodeSelector示例

首先给Node打上标签

```sh
kubectl label nodes node-01 disktype=ssd
```

然后在daemonset中指定nodeSelector为`disktype=ssd`：

```yaml
spec:
  nodeSelector:
    disktype: ssd
```

### nodeAffinity示例

nodeAffinity目前支持两种：requiredDuringSchedulingIgnoredDuringExecution和preferredDuringSchedulingIgnoredDuringExecution，分别代表必须满足条件和优选条件。比如下面的例子代表调度到包含标签`kubernetes.io/e2e-az-name`并且值为e2e-az1或e2e-az2的Node上，并且优选还带有标签`another-node-label-key=another-node-label-value`的Node。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: with-node-affinity
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: kubernetes.io/e2e-az-name
            operator: In
            values:
            - e2e-az1
            - e2e-az2
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 1
        preference:
          matchExpressions:
          - key: another-node-label-key
            operator: In
            values:
            - another-node-label-value
  containers:
  - name: with-node-affinity
    image: gcr.io/google_containers/pause:2.0
```

### podAffinity示例

podAffinity基于Pod的标签来选择Node，仅调度到满足条件Pod所在的Node上，支持podAffinity和podAntiAffinity。这个功能比较绕，以下面的例子为例：

* 如果一个“Node所在Zone中包含至少一个带有`security=S1`标签且运行中的Pod”，那么可以调度到该Node
* 不调度到“包含至少一个带有`security=S2`标签且运行中Pod”的Node上

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: with-pod-affinity
spec:
  affinity:
    podAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchExpressions:
          - key: security
            operator: In
            values:
            - S1
        topologyKey: failure-domain.beta.kubernetes.io/zone
    podAntiAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchExpressions:
            - key: security
              operator: In
              values:
              - S2
          topologyKey: kubernetes.io/hostname
  containers:
  - name: with-pod-affinity
    image: gcr.io/google_containers/pause:2.0
```

## Taints和tolerations

Taints和tolerations用于保证Pod不被调度到不合适的Node上，其中Taint应用于Node上，而toleration则应用于Pod上。

目前支持的taint类型

- NoSchedule：新的Pod不调度到该Node上，不影响正在运行的Pod
- PreferNoSchedule：soft版的NoSchedule，尽量不调度到该Node上
- NoExecute：新的Pod不调度到该Node上，并且删除（evict）已在运行的Pod。Pod可以增加一个时间（tolerationSeconds），

然而，当Pod的Tolerations匹配Node的所有Taints的时候可以调度到该Node上；当Pod是已经运行的时候，也不会被删除（evicted）。另外对于NoExecute，如果Pod增加了一个tolerationSeconds，则会在该时间之后才删除Pod。

比如，假设node1上应用以下几个taint

```sh
kubectl taint nodes node1 key1=value1:NoSchedule
kubectl taint nodes node1 key1=value1:NoExecute
kubectl taint nodes node1 key2=value2:NoSchedule
```

下面的这个Pod由于没有tolerate`key2=value2:NoSchedule`无法调度到node1上

```yaml
tolerations:
- key: "key1"
  operator: "Equal"
  value: "value1"
  effect: "NoSchedule"
- key: "key1"
  operator: "Equal"
  value: "value1"
  effect: "NoExecute"
```

而正在运行且带有tolerationSeconds的Pod则会在600s之后删除

```yaml
tolerations:
- key: "key1"
  operator: "Equal"
  value: "value1"
  effect: "NoSchedule"
- key: "key1"
  operator: "Equal"
  value: "value1"
  effect: "NoExecute"
  tolerationSeconds: 600
- key: "key2"
  operator: "Equal"
  value: "value2"
  effect: "NoSchedule"
```

注意，DaemonSet创建的Pod会自动加上对`node.alpha.kubernetes.io/unreachable`和`node.alpha.kubernetes.io/notReady`的NoExecute Toleration，以避免它们因此被删除。

## 优先级调度

从v1.8开始，kube-scheduler支持定义Pod的优先级，从而保证高优先级的Pod优先调度。开启方法为

- apiserver配置`--feature-gates=PodPriority=true` 和 `--runtime-config=scheduling.k8s.io/v1alpha1=true`
- kube-scheduler配置`--feature-gates=PodPriority=true`

在指定Pod的优先级之前需要先定义一个PriorityClass（非namespace资源），如

```yaml
apiVersion: v1
kind: PriorityClass
metadata:
  name: high-priority
value: 1000000
globalDefault: false
description: "This priority class should be used for XYZ service pods only."
```

其中

- `value` 为32位整数的优先级，该值越大，优先级越高
- `globalDefault` 用于未配置PriorityClassName的Pod，整个集群中应该只有一个PriorityClass将其设置为true

然后，在PodSpec中通过PriorityClassName设置Pod的优先级：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
  labels:
    env: test
spec:
  containers:
  - name: nginx
    image: nginx
    imagePullPolicy: IfNotPresent
  priorityClassName: high-priority
```

## 多调度器

如果默认的调度器不满足要求，还可以部署自定义的调度器。并且，在整个集群中还可以同时运行多个调度器实例，通过`podSpec.schedulerName`来选择使用哪一个调度器（默认使用内置的调度器）。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
  labels:
    app: nginx
spec:
  # 选择使用自定义调度器my-scheduler
  schedulerName: my-scheduler
  containers:
  - name: nginx
    image: nginx:1.10
```

调度器的示例参见[这里](../plugins/scheduler.md)。

## 调度器扩展

kube-scheduler还支持使用`--policy-config-file`指定一个调度策略文件来自定义调度策略，比如

```json
{
"kind" : "Policy",
"apiVersion" : "v1",
"predicates" : [
    {"name" : "PodFitsHostPorts"},
    {"name" : "PodFitsResources"},
    {"name" : "NoDiskConflict"},
    {"name" : "MatchNodeSelector"},
    {"name" : "HostName"}
    ],
"priorities" : [
    {"name" : "LeastRequestedPriority", "weight" : 1},
    {"name" : "BalancedResourceAllocation", "weight" : 1},
    {"name" : "ServiceSpreadingPriority", "weight" : 1},
    {"name" : "EqualPriority", "weight" : 1}
    ],
"extenders":[
    {
        "urlPrefix": "http://127.0.0.1:12346/scheduler",
        "apiVersion": "v1beta1",
        "filterVerb": "filter",
        "prioritizeVerb": "prioritize",
        "weight": 5,
        "enableHttps": false,
        "nodeCacheCapable": false
    }
    ]
}
```

## 其他影响调度的因素

- 如果Node Condition处于MemoryPressure，则所有BestEffort的新Pod（未指定resources limits和requests）不会调度到该Node上
- 如果Node Condition处于DiskPressure，则所有新Pod都不会调度到该Node上
- 为了保证Critical Pods的正常运行，当它们处于异常状态时会自动重新调度。Critical Pods是指
  - annotation包括`scheduler.alpha.kubernetes.io/critical-pod=''`
  - tolerations包括`[{"key":"CriticalAddonsOnly", "operator":"Exists"}]`

## How it works


kube-scheduler调度原理：

```
For given pod:

    +---------------------------------------------+
    |               Schedulable nodes:            |
    |                                             |
    | +--------+    +--------+      +--------+    |
    | | node 1 |    | node 2 |      | node 3 |    |
    | +--------+    +--------+      +--------+    |
    |                                             |
    +-------------------+-------------------------+
                        |
                        |
                        v
    +-------------------+-------------------------+

    Pred. filters: node 3 doesn't have enough resource

    +-------------------+-------------------------+
                        |
                        |
                        v
    +-------------------+-------------------------+
    |             remaining nodes:                |
    |   +--------+                 +--------+     |
    |   | node 1 |                 | node 2 |     |
    |   +--------+                 +--------+     |
    |                                             |
    +-------------------+-------------------------+
                        |
                        |
                        v
    +-------------------+-------------------------+

    Priority function:    node 1: p=2
                          node 2: p=5

    +-------------------+-------------------------+
                        |
                        |
                        v
            select max{node priority} = node 2
```

kube-scheduler调度分为两个阶段，predicate和priority

- predicate：过滤不符合条件的节点
- priority：优先级排序，选择优先级最高的节点

predicates策略

- PodFitsPorts：同PodFitsHostPorts
- PodFitsHostPorts：检查是否有Host Ports冲突
- PodFitsResources：检查Node的资源是否充足，包括允许的Pod数量、CPU、内存、GPU个数以及其他的OpaqueIntResources
- HostName：检查`pod.Spec.NodeName`是否与候选节点一致
- MatchNodeSelector：检查候选节点的`pod.Spec.NodeSelector`是否匹配
- NoVolumeZoneConflict：检查volume zone是否冲突
- MaxEBSVolumeCount：检查AWS EBS Volume数量是否过多（默认不超过39）
- MaxGCEPDVolumeCount：检查GCE PD Volume数量是否过多（默认不超过16）
- MaxAzureDiskVolumeCount：检查Azure Disk Volume数量是否过多（默认不超过16）
- MatchInterPodAffinity：检查是否匹配Pod的亲和性要求
- NoDiskConflict：检查是否存在Volume冲突，仅限于GCE PD、AWS EBS、Ceph RBD以及ISCSI
- GeneralPredicates：分为noncriticalPredicates和EssentialPredicates。noncriticalPredicates中包含PodFitsResources，EssentialPredicates中包含PodFitsHost，PodFitsHostPorts和PodSelectorMatches。
- PodToleratesNodeTaints：检查Pod是否容忍Node Taints
- CheckNodeMemoryPressure：检查Pod是否可以调度到MemoryPressure的节点上
- CheckNodeDiskPressure：检查Pod是否可以调度到DiskPressure的节点上
- NoVolumeNodeConflict：检查节点是否满足Pod所引用的Volume的条件

priorities策略

- SelectorSpreadPriority：优先减少节点上属于同一个Service或Replication Controller的Pod数量
- InterPodAffinityPriority：优先将Pod调度到相同的拓扑上（如同一个节点、Rack、Zone等）
- LeastRequestedPriority：优先调度到请求资源少的节点上
- BalancedResourceAllocation：优先平衡各节点的资源使用
- NodePreferAvoidPodsPriority：alpha.kubernetes.io/preferAvoidPods字段判断,权重为10000，避免其他优先级策略的影响
- NodeAffinityPriority：优先调度到匹配NodeAffinity的节点上
- TaintTolerationPriority：优先调度到匹配TaintToleration的节点上
- ServiceSpreadingPriority：尽量将同一个service的Pod分布到不同节点上，已经被SelectorSpreadPriority替代[默认未使用]
- EqualPriority：将所有节点的优先级设置为1[默认未使用]
- ImageLocalityPriority：尽量将使用大镜像的容器调度到已经下拉了该镜像的节点上[默认未使用]
- MostRequestedPriority：尽量调度到已经使用过的Node上，特别适用于cluster-autoscaler[默认未使用]

> ** [warning] 代码入口路径**
>
> 与Kubernetes其他组件的入口不同(其他都是位于`cmd/`目录)，kube-schedular的入口在`plugin/cmd/kube-scheduler`。
>

## 启动kube-scheduler示例

```sh
kube-scheduler --address=127.0.0.1 --leader-elect=true --kubeconfig=/etc/kubernetes/scheduler.conf
```

## 参考文档

- [Pod Priority and Preemption](https://kubernetes.io/docs/concepts/configuration/pod-priority-preemption/)
- [Configure Multiple Schedulers](https://kubernetes.io/docs/tasks/administer-cluster/configure-multiple-schedulers/)
- [Taints and Tolerations](https://kubernetes.io/docs/concepts/configuration/taint-and-toleration/)
- [Advanced Scheduling in Kubernetes](http://blog.kubernetes.io/2017/03/advanced-scheduling-in-kubernetes.html)
