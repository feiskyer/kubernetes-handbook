# The Kubernetes Brain: Controller Manager 

The Controller Manager, composed of the kube-controller-manager and the cloud-controller-manager, serves as the brain of Kubernetes. It keeps tabs on the overall state of the cluster through the apiserver and ensures that the cluster maintains its desired working condition. 

![The Structure of Controller Manager](../../.gitbook/assets/post-ccm-arch%20%284%29.png)

The kube-controller-manager integrates a set of controllers such as:

* Replication Controller
* Node Controller
* CronJob Controller
* Daemon Controller
* Deployment Controller
* Endpoint Controller
* Garbage Collector
* Namespace Controller
* Job Controller
* Pod AutoScaler
* ReplicaSet
* Service Controller
* ServiceAccount Controller
* StatefulSet Controller
* Volume Controller
* Resource Quota Controller

The cloud-controller-manager only becomes necessary when the Cloud Provider feature in Kubernetes is enabled. It works in harmony with the controls provided by cloud service providers and also contains a number of controllers, such as:

* Node Controller
* Route Controller
* Service Controller

Starting from v1.6, the cloud provider has undergone several significant refactoring in order to build customized cloud service provider support without modifying the core code of Kubernetes. Refer [here](../../extension/cloud-provider.md) to learn how to build a new Cloud Provider.

## In-depth Look: Metrics

The Controller Manager Metrics provide performance readings for the internal logic of the controllers, such as runtime metrics of the Go language, latencies of requests to etcd, cloud service provider API, and cloud storage. By default, these metrics are accessible on port 10252 of the kube-controller-manager and can be retrieved in Prometheus format from `http://localhost:10252/metrics`.

Command Example:
```text
$ curl http://localhost:10252/metrics
...
# HELP etcd_request_cache_add_latencies_summary Latency in microseconds of adding an object to etcd cache
# TYPE etcd_request_cache_add_latencies_summary summary
...
```

## Firing Up kube-controller-manager: A Startup Example

```bash
kube-controller-manager \
  --enable-dynamic-provisioning=true \
  --feature-gates=AllAlpha=true \
  --horizontal-pod-autoscaler-sync-period=10s \
  --horizontal-pod-autoscaler-use-rest-clients=true \
...
```

## The Key to It All: Controllers

The kube-controller-manager is made up of a bunch of controllers that can be divided into three groups:

1. Controllers that must be initiated
   * Endpoint Controller, Replication Controller, PodGc Controller, etc.
2. Optional controllers that are typically initiated; activation can be controlled by user options
   * Token Controller, Node Controller, Service Controller, etc.
3. Optional controllers that are typically not initiated; activation can be controlled by user options
   * Bootstrap Signer Controller, Token Cleaner Controller

When Kubernetes has the Cloud Provider feature enabled, the cloud-controller-manager is required to help manage cloud service providers and incorporates a series of controllers such as:

* CloudNodeController
* RouteController
* ServiceController

## High Availability

When `--leader-elect=true` is set at startup, the controller manager employs a multi-node elective leader approach to select the master node. Only the master node will call `StartControllers()` to initiate all controllers, while the rest will only participate in the leader election.

## High Performance

Starting from Kubernetes 1.7, all resource monitoring calls are recommended to use [Informer](https://github.com/kubernetes/client-go/blob/master/tools/cache/shared_informer.go). Informer offers an event-notification-based read-only cache mechanism and allows for the registration of change callbacks, remarkably reducing API calls.

The utilization method of Informer can be referred to [here](https://github.com/feiskyer/kubernetes-handbook/tree/master/examples/client/informer).

## Node Eviction

By default, Kubelet updates the Node status every 10 seconds, while the kube-controller-manager checks the Node status every 5 seconds. If a Node's status isn't updated for 40 seconds, the kube-controller-manager will mark it as NotReady and if there's no update for over 5 minutes, it'll evict all Pods on this Node.

Kubernetes automatically adds tolerations for `node.kubernetes.io/not-ready` and `node.kubernetes.io/unreachable` to Pods with `tolerationSeconds=300` configured. You can overwrite the default configuration by setting Pod's tolerations:

Example of Pod toleration settings:

```yaml
tolerations:
- key: "node.kubernetes.io/unreachable"
  operator: "Exists"
  effect: "NoExecute"
  tolerationSeconds: 10
- key: "node.kubernetes.io/not-ready"
  operator: "Exists"
  effect: "NoExecute"
  tolerationSeconds: 10
```

After a Node anomaly, the Node controller evicts the Node at a default rate (`--node-eviction-rate=0.1`, meaning one node per 10 seconds). The Node controller divides nodes into different groups based on Zones and adjusts the rate according to Zone status:

* Normal: All Nodes are Ready, evicted at a default rate.
* PartialDisruption: Over 33% of Nodes are NotReady. When the abnormal Node ratio exceeds `--unhealthy-zone-threshold=0.55`, the rate begins to slow down.
* FullDisruption: All Nodes are NotReady, returning to use the default eviction rate. But when all Zones are in FullDisruption, eviction is halted.