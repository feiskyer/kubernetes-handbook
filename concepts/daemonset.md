# DaemonSet

DaemonSet保证在每个Node上都运行一个容器副本，常用来部署一些集群的日志、监控或者其他系统管理应用。典型的应用包括：

* 日志收集，比如fluentd，logstash等
* 系统监控，比如Prometheus Node Exporter，collectd，New Relic agent，Ganglia gmond等
* 系统程序，比如kube-proxy, kube-dns, glusterd, ceph等

使用Fluentd收集日志的例子：

```yaml
apiVersion: extensions/v1beta1
kind: DaemonSet
metadata:
  name: fluentd
spec:
  template:
    metadata:
      labels:
        app: logging
        id: fluentd
      name: fluentd
    spec:
      containers:
      - name: fluentd-es
        image: gcr.io/google_containers/fluentd-elasticsearch:1.3
        env:
         - name: FLUENTD_ARGS
           value: -qq
        volumeMounts:
         - name: containers
           mountPath: /var/lib/docker/containers
         - name: varlog
           mountPath: /varlog
      volumes:
         - hostPath:
             path: /var/lib/docker/containers
           name: containers
         - hostPath:
             path: /var/log
           name: varlog
```

注意

- Kubernetes v1.7及以前API版本使用`extensions/v1beta1`
- Kubernetes v1.8的API版本升级到`apps/v1beta2`

## 滚动更新

v1.6+支持DaemonSet的滚动更新，可以通过`.spec.updateStrategy.type`设置更新策略。目前支持两种策略

- OnDelete：默认策略，更新模板后，只有手动删除了旧的Pod后才会创建新的Pod
- RollingUpdate：更新DaemonSet模版后，自动删除旧的Pod并创建新的Pod

在使用RollingUpdate策略时，还可以设置

- `.spec.updateStrategy.rollingUpdate.maxUnavailable`, 默认1
- `spec.minReadySeconds`，默认0

### 回滚

v1.7+还支持回滚

```sh
# 查询历史版本
$ kubectl rollout history daemonset <daemonset-name>

# 查询某个历史版本的详细信息
$ kubectl rollout history daemonset <daemonset-name> --revision=1

# 回滚
$ kubectl rollout undo daemonset <daemonset-name> --to-revision=<revision>
# 查询回滚状态
$ kubectl rollout status ds/<daemonset-name>
```

## 指定Node节点

DaemonSet会忽略Node的unschedulable状态，有两种方式来指定Pod只运行在指定的Node节点上：

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

## 静态Pod

除了DaemonSet，还可以使用静态Pod来在每台机器上运行指定的Pod，这需要kubelet在启动的时候指定manifest目录：

```sh
kubelet --pod-manifest-path=/etc/kubernetes/manifests
```

然后将所需要的Pod定义文件放到指定的manifest目录中。

注意：静态Pod不能通过API Server来删除，但可以通过删除manifest文件来自动删除对应的Pod。
