# kube-scheduler

kube-scheduler负责分配调度Pod到集群内的节点上，它监听kube-apiserve，查询还未分配Node的Pod，然后根据调度策略为这些Pod分配节点（更新Pod的`NodeName`字段）。

调度器需要充分考虑诸多的因素：

- 公平调度
- 资源高效利用
- QoS
- affinity 和 anti-affinity
- 数据本地化（data locality）
- 内部负载干扰（inter-workload interference）
- deadlines

## 调度策略

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

- predicate：删选符合条件的节点
- priority：优先级排序，选择优先级最高的节点

predicates策略

- PodFitsHostPorts
- PodFitsResources
- NoDiskConflict
- NoVolumeZoneConflict
- MatchNodeSelector
- HostName

priorities策略

- LeastRequestedPriority
- BalancedResourceAllocation
- ServiceSpreadingPriority
- EqualPriority"

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

## 启动kube-scheduler示例

```sh
kube-scheduler --address=127.0.0.1 --leader-elect=true --kubeconfig=/etc/kubernetes/scheduler.conf
```

## 多调度器

如果默认的kube-scheduler不满足应用的要求，还可以编写并运行其他的调度器，具体配置方法见[这里](https://kubernetes.io/docs/tasks/administer-cluster/configure-multiple-schedulers/)。