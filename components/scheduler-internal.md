# kube-schedular工作原理

kube-schedular调度原理：

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
- MatchInterPodAffinity：检查是否匹配inter-pod affinity
- NoDiskConflict：检查是否存在Volume冲突，仅限于GCE PD、AWS EBS、Ceph RBD以及ISCSI
- GeneralPredicates：包括noncriticalPredicates（PodFitsResources）和EssentialPredicates（PodFitsHost）
- PodToleratesNodeTaints：检查Pod是否容忍Node Taints
- CheckNodeMemoryPressure：检查Pod是否可以调度到MemoryPressure的节点上
- CheckNodeDiskPressure：检查Pod是否可以调度到DiskPressure的节点上
- NoVolumeNodeConflict：检查P节点是否满足Pod所引用的Volume的条件

priorities策略

- SelectorSpreadPriority：优先减少节点上属于同一个Service或Replication Controller的Pod数量
- InterPodAffinityPriority：优先将Pod调度到相同的拓扑上（如同一个节点、Rack、Zone等）
- LeastRequestedPriority：优先调度到请求资源少的节点上
- BalancedResourceAllocation：优先平衡各节点的资源使用
- NodePreferAvoidPodsPriority：将PreferNode优先级调到最大（1000），避免其他优先级策略的影响
- NodeAffinityPriority：优先调度到匹配NodeAffinity的节点上
- TaintTolerationPriority：优先调度到匹配TaintToleration的节点上
- ServiceSpreadingPriority：尽量将同一个service的Pod分布到不同节点上
- EqualPriority：将所有节点的优先级设置为1
- ImageLocalityPriority：尽量将使用大镜像的容器调度到已经下拉了该镜像的节点上
- MostRequestedPriority：尽量调度到已经使用过的Node上，特别适用于cluster-autoscaler

> **[warning] 入口路径**
>
> 与Kubernetes其他组件的入口不同(其他都是位于`cmd/`目录)，kube-schedular的入口在`plugin/cmd/kube-scheduler`。
>

