# The Inner Workings of kube-scheduler

kube-scheduler plays a crucial role in allocating Pods within a cluster to different nodes. It keeps an eye on the kube-apiserver, looking for Pods that have not yet been assigned a Node. Once it finds these, it allocates Nodes to them based on a set of scheduling strategies (which is achieved by updating the `NodeName` field of these Pods).

The scheduler takes into account a series of factors, including:

* Fair distribution
* Efficient utilization of resources 
* Quality of Service (QoS)
* Affinity and anti-affinity
* Data locality 
* Inter-workload interference 
* Deadlines

## Specifying Node Scheduling

There are three ways to specify that a Pod should only run on a predetermined Node:

* nodeSelector: Only schedules on Node that match certain labels
* nodeAffinity: A more versatile Node selector, supports collection operations
* podAffinity: Schedules the Pod on the Node where the condition-satisfying Pod is located.

### nodeSelector Example

First, label the Node:

```bash
kubectl label nodes node-01 disktype=ssd
```

Then, specify nodeSelector as `disktype=ssd` in the daemonset:

```yaml
spec:
  nodeSelector:
    disktype: ssd
```

### nodeAffinity Example

nodeAffinity currently supports two modes: requiredDuringSchedulingIgnoredDuringExecution and preferredDuringSchedulingIgnoredDuringExecution. They represent the conditions that must be met and preferred conditions, respectively. The example below indicates scheduling to a Node with labels `kubernetes.io/e2e-az-name` and the values either e2e-az1 or e2e-az2, and preferably, the Node also carries the label `another-node-label-key=another-node-label-value`.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: with-node-affinity
spec:
  ...
```

### podAffinity Example

podAffinity chooses the Node based on the labels of the Pod, only schedules the Pod on the Node where the condition-satisfying Pod is located, and supports both podAffinity and podAntiAffinity. 

```bash
apiVersion: v1
kind: Pod
metadata:
  name: with-pod-affinity
spec:
  ...
```

## Taints and Tolerations

Taints and Tolerations are used to ensure that a Pod is not scheduled on an unsuitable Node: Taint is applied to the Node, while Toleration is applied to the Pod.

```bash
kubectl taint nodes node1 key1=value1:NoSchedule
kubectl taint nodes node1 key1=value1:NoExecute
kubectl taint nodes node1 key2=value2:NoSchedule
```

However, a Pod can be scheduled to a specific Node when the Tolerations of the Pod match all the Taints of the Node; if the Pod is already running, it will not be removed (evicted). Note that the Pods created by DaemonSet will automatically add the NoExecute Toleration for `node.alpha.kubernetes.io/unreachable` and `node.alpha.kubernetes.io/notReady` to avoid being removed because of them.

## Priority Scheduling

Starting from version 1.8, kube-scheduler supports defining the priority of a Pod, ensuring that high priority Pods are scheduled first. 

```yaml
apiVersion: v1
kind: PriorityClass
metadata:
  name: high-priority
value: 1000000
globalDefault: false
description: "This priority class should be used for XYZ service pods only."
```

Then, set the priority of the Pod in PodSpec through PriorityClassName:

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

## Multiple Schedulers

If the default scheduler does not meet the requirements, you can deploy a custom scheduler. In the entire cluster, multiple instances of the scheduler can run at the same time, and `podSpec.schedulerName` is used to select which scheduler to use (the built-in scheduler is used by default).

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
  labels:
    app: nginx
spec:
  # Choose to use the custom scheduler my-scheduler
  schedulerName: my-scheduler
  containers:
  - name: nginx
    image: nginx:1.10
```

## Scheduler Extensions

### Scheduler Plugins

From version 1.19, you can use the [Scheduling Framework](https://kubernetes.io/docs/concepts/scheduling-eviction/scheduling-framework/) to extend the scheduler in the form of plug-ins as the figure below shows, which are the Pod scheduling context and the extension points exposed by the scheduling framework:

![](2022-04-24-16-32-32.png)

### Scheduler Policy

kube-scheduler also supports using `--policy-config-file` to specify a scheduling policy file to customize the scheduling policy, such as

```javascript
{
      ...
    ]
}
```

## Other Factors Affecting Scheduling

* If the Node Condition is in MemoryPressure, all new BestEffort Pods (those that haven't specified resource limits and requests) will not be scheduled on that Node.
* If the Node Condition is in DiskPressure, all new Pods will not be scheduled on that Node.
* To ensure the normal operation of Critical Pods, they will be automatically rescheduled when they are in an abnormal state. Critical Pods refer to:
  * Annotations include `scheduler.alpha.kubernetes.io/critical-pod=''`
  * Tolerations include `[{"key":"CriticalAddonsOnly", "operator":"Exists"}]`
  * PriorityClass is `system-cluster-critical` or `system-node-critical`.

## Launch kube-scheduler Example

```bash
kube-scheduler --address=127.0.0.1 --leader-elect=true --kubeconfig=/etc/kubernetes/scheduler.conf
```

## How kube-scheduler Works

kube-scheduler scheduling principle:

```text
For given pod:
    ...
```

The kube-scheduler schedules in two phases, the predicate phase and priority phase:

* Predicate: Filters out ineligible nodes
* Priority: Prioritizes nodes and selects the highest priority one.

Predicate strategies include:

* PodFitsPorts: Same as PodFitsHostPorts.
* HostName: Checks whether `pod.Spec.NodeName` matches the candidate node.
* NoVolumeZoneConflict: Checks for volume zone conflict.
* GeneralPredicates: Divided into noncriticalPredicates and EssentialPredicates. 
* PodToleratesNodeTaints: Checks whether the Pod tolerates Node Taints.

Priority strategies include:

* SelectorSpreadPriority: Tries to reduce the number of Pods belonging to the same Service or Replication Controller on each node.
* NodeAffinityPriority: Tries to schedule Pods to Nodes that match NodeAffinity.
* TaintTolerationPriority: Tries to schedule Pods to Nodes that match TaintToleration.

## Reference Documents

* [Pod Priority and Preemption](https://kubernetes.io/docs/concepts/configuration/pod-priority-preemption/)
* [Configure Multiple Schedulers](https://kubernetes.io/docs/tasks/administer-cluster/configure-multiple-schedulers/)
* [Taints and Tolerations](https://kubernetes.io/docs/concepts/configuration/taint-and-toleration/)
* [Advanced Scheduling in Kubernetes](https://kubernetes.io/blog/2017/03/advanced-scheduling-in-kubernetes/)