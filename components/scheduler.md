# kube-scheduler

kube-scheduler 負責分配調度 Pod 到集群內的節點上，它監聽 kube-apiserver，查詢還未分配 Node 的 Pod，然後根據調度策略為這些 Pod 分配節點（更新 Pod 的 `NodeName` 字段）。

調度器需要充分考慮諸多的因素：

- 公平調度
- 資源高效利用
- QoS
- affinity 和 anti-affinity
- 數據本地化（data locality）
- 內部負載干擾（inter-workload interference）
- deadlines

## 指定 Node 節點調度

有三種方式指定 Pod 只運行在指定的 Node 節點上

- nodeSelector：只調度到匹配指定 label 的 Node 上
- nodeAffinity：功能更豐富的 Node 選擇器，比如支持集合操作
- podAffinity：調度到滿足條件的 Pod 所在的 Node 上

### nodeSelector 示例

首先給 Node 打上標籤

```sh
kubectl label nodes node-01 disktype=ssd
```

然後在 daemonset 中指定 nodeSelector 為 `disktype=ssd`：

```yaml
spec:
  nodeSelector:
    disktype: ssd
```

### nodeAffinity 示例

nodeAffinity 目前支持兩種：requiredDuringSchedulingIgnoredDuringExecution 和 preferredDuringSchedulingIgnoredDuringExecution，分別代表必須滿足條件和優選條件。比如下面的例子代表調度到包含標籤 `kubernetes.io/e2e-az-name` 並且值為 e2e-az1 或 e2e-az2 的 Node 上，並且優選還帶有標籤 `another-node-label-key=another-node-label-value` 的 Node。

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

### podAffinity 示例

podAffinity 基於 Pod 的標籤來選擇 Node，僅調度到滿足條件 Pod 所在的 Node 上，支持 podAffinity 和 podAntiAffinity。這個功能比較繞，以下面的例子為例：

* 如果一個 “Node 所在 Zone 中包含至少一個帶有 `security=S1` 標籤且運行中的 Pod”，那麼可以調度到該 Node
* 不調度到 “包含至少一個帶有 `security=S2` 標籤且運行中 Pod” 的 Node 上

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

## Taints 和 tolerations

Taints 和 tolerations 用於保證 Pod 不被調度到不合適的 Node 上，其中 Taint 應用於 Node 上，而 toleration 則應用於 Pod 上。

目前支持的 taint 類型

- NoSchedule：新的 Pod 不調度到該 Node 上，不影響正在運行的 Pod
- PreferNoSchedule：soft 版的 NoSchedule，儘量不調度到該 Node 上
- NoExecute：新的 Pod 不調度到該 Node 上，並且刪除（evict）已在運行的 Pod。Pod 可以增加一個時間（tolerationSeconds），

然而，當 Pod 的 Tolerations 匹配 Node 的所有 Taints 的時候可以調度到該 Node 上；當 Pod 是已經運行的時候，也不會被刪除（evicted）。另外對於 NoExecute，如果 Pod 增加了一個 tolerationSeconds，則會在該時間之後才刪除 Pod。

比如，假設 node1 上應用以下幾個 taint

```sh
kubectl taint nodes node1 key1=value1:NoSchedule
kubectl taint nodes node1 key1=value1:NoExecute
kubectl taint nodes node1 key2=value2:NoSchedule
```

下面的這個 Pod 由於沒有 tolerate`key2=value2:NoSchedule` 無法調度到 node1 上

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

而正在運行且帶有 tolerationSeconds 的 Pod 則會在 600s 之後刪除

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

注意，DaemonSet 創建的 Pod 會自動加上對 `node.alpha.kubernetes.io/unreachable` 和 `node.alpha.kubernetes.io/notReady` 的 NoExecute Toleration，以避免它們因此被刪除。

## 優先級調度

從 v1.8 開始，kube-scheduler 支持定義 Pod 的優先級，從而保證高優先級的 Pod 優先調度。並從 v1.11 開始默認開啟。

> 注：在 v1.8-v1.10 版本中的開啟方法為
>
> - apiserver 配置 `--feature-gates=PodPriority=true` 和 `--runtime-config=scheduling.k8s.io/v1alpha1=true`
> - kube-scheduler 配置 `--feature-gates=PodPriority=true`

在指定 Pod 的優先級之前需要先定義一個 PriorityClass（非 namespace 資源），如

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

- `value` 為 32 位整數的優先級，該值越大，優先級越高
- `globalDefault` 用於未配置 PriorityClassName 的 Pod，整個集群中應該只有一個 PriorityClass 將其設置為 true

然後，在 PodSpec 中通過 PriorityClassName 設置 Pod 的優先級：

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

## 多調度器

如果默認的調度器不滿足要求，還可以部署自定義的調度器。並且，在整個集群中還可以同時運行多個調度器實例，通過 `podSpec.schedulerName` 來選擇使用哪一個調度器（默認使用內置的調度器）。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
  labels:
    app: nginx
spec:
  # 選擇使用自定義調度器 my-scheduler
  schedulerName: my-scheduler
  containers:
  - name: nginx
    image: nginx:1.10
```

調度器的示例參見 [這裡](../plugins/scheduler.md)。

## 調度器擴展

kube-scheduler 還支持使用 `--policy-config-file` 指定一個調度策略文件來自定義調度策略，比如

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

## 其他影響調度的因素

- 如果 Node Condition 處於 MemoryPressure，則所有 BestEffort 的新 Pod（未指定 resources limits 和 requests）不會調度到該 Node 上
- 如果 Node Condition 處於 DiskPressure，則所有新 Pod 都不會調度到該 Node 上
- 為了保證 Critical Pods 的正常運行，當它們處於異常狀態時會自動重新調度。Critical Pods 是指
  - annotation 包括 `scheduler.alpha.kubernetes.io/critical-pod=''`
  - tolerations 包括 `[{"key":"CriticalAddonsOnly", "operator":"Exists"}]`
  - priorityClass 為 `system-cluster-critical` 或者 `system-node-critical`

## 啟動 kube-scheduler 示例

```sh
kube-scheduler --address=127.0.0.1 --leader-elect=true --kubeconfig=/etc/kubernetes/scheduler.conf
```

## kube-scheduler 工作原理

kube-scheduler 調度原理：

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

kube-scheduler 調度分為兩個階段，predicate 和 priority

- predicate：過濾不符合條件的節點
- priority：優先級排序，選擇優先級最高的節點

predicates 策略

- PodFitsPorts：同 PodFitsHostPorts
- PodFitsHostPorts：檢查是否有 Host Ports 衝突
- PodFitsResources：檢查 Node 的資源是否充足，包括允許的 Pod 數量、CPU、內存、GPU 個數以及其他的 OpaqueIntResources
- HostName：檢查 `pod.Spec.NodeName` 是否與候選節點一致
- MatchNodeSelector：檢查候選節點的 `pod.Spec.NodeSelector` 是否匹配
- NoVolumeZoneConflict：檢查 volume zone 是否衝突
- MaxEBSVolumeCount：檢查 AWS EBS Volume 數量是否過多（默認不超過 39）
- MaxGCEPDVolumeCount：檢查 GCE PD Volume 數量是否過多（默認不超過 16）
- MaxAzureDiskVolumeCount：檢查 Azure Disk Volume 數量是否過多（默認不超過 16）
- MatchInterPodAffinity：檢查是否匹配 Pod 的親和性要求
- NoDiskConflict：檢查是否存在 Volume 衝突，僅限於 GCE PD、AWS EBS、Ceph RBD 以及 ISCSI
- GeneralPredicates：分為 noncriticalPredicates 和 EssentialPredicates。noncriticalPredicates 中包含 PodFitsResources，EssentialPredicates 中包含 PodFitsHost，PodFitsHostPorts 和 PodSelectorMatches。
- PodToleratesNodeTaints：檢查 Pod 是否容忍 Node Taints
- CheckNodeMemoryPressure：檢查 Pod 是否可以調度到 MemoryPressure 的節點上
- CheckNodeDiskPressure：檢查 Pod 是否可以調度到 DiskPressure 的節點上
- NoVolumeNodeConflict：檢查節點是否滿足 Pod 所引用的 Volume 的條件

priorities 策略

- SelectorSpreadPriority：優先減少節點上屬於同一個 Service 或 Replication Controller 的 Pod 數量
- InterPodAffinityPriority：優先將 Pod 調度到相同的拓撲上（如同一個節點、Rack、Zone 等）
- LeastRequestedPriority：優先調度到請求資源少的節點上
- BalancedResourceAllocation：優先平衡各節點的資源使用
- NodePreferAvoidPodsPriority：alpha.kubernetes.io/preferAvoidPods 字段判斷, 權重為 10000，避免其他優先級策略的影響
- NodeAffinityPriority：優先調度到匹配 NodeAffinity 的節點上
- TaintTolerationPriority：優先調度到匹配 TaintToleration 的節點上
- ServiceSpreadingPriority：儘量將同一個 service 的 Pod 分佈到不同節點上，已經被 SelectorSpreadPriority 替代 [默認未使用]
- EqualPriority：將所有節點的優先級設置為 1[默認未使用]
- ImageLocalityPriority：儘量將使用大鏡像的容器調度到已經下拉了該鏡像的節點上 [默認未使用]
- MostRequestedPriority：儘量調度到已經使用過的 Node 上，特別適用於 cluster-autoscaler[默認未使用]

> ** 代碼入口路徑 **
>
> 在release-1.9及之前的代碼入口在plugin/cmd/kube-scheduler，從release-1.10起，kube-scheduler的核心代碼遷移到pkg/scheduler目錄下面，入口也遷移到cmd/kube-scheduler
>

## 參考文檔

- [Pod Priority and Preemption](https://kubernetes.io/docs/concepts/configuration/pod-priority-preemption/)
- [Configure Multiple Schedulers](https://kubernetes.io/docs/tasks/administer-cluster/configure-multiple-schedulers/)
- [Taints and Tolerations](https://kubernetes.io/docs/concepts/configuration/taint-and-toleration/)
- [Advanced Scheduling in Kubernetes](https://kubernetes.io/blog/2017/03/advanced-scheduling-in-kubernetes/)
