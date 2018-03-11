# Controller Manager

Controller Manager由kube-controller-manager和cloud-controller-manager组成，是Kubernetes的大脑，它通过apiserver监控整个集群的状态，并确保集群处于预期的工作状态。

![](images/post-ccm-arch.png)

kube-controller-manager由一系列的控制器组成

- Replication Controller
- Node Controller
- CronJob Controller
- Daemon Controller
- Deployment Controller
- Endpoint Controller
- Garbage Collector
- Namespace Controller
- Job Controller
- Pod AutoScaler
- RelicaSet
- Service Controller
- ServiceAccount Controller
- StatefulSet Controller
- Volume Controller
- Resource quota Controller

cloud-controller-manager在Kubernetes启用Cloud Provider的时候才需要，用来配合云服务提供商的控制，也包括一系列的控制器，如

- Node Controller
- Route Controller
- Service Controller

从v1.6开始，cloud provider已经经历了几次重大重构，以便在不修改Kubernetes核心代码的同时构建自定义的云服务商支持。参考[这里](../plugins/cloud-provider.md)查看如何为云提供商构建新的Cloud Provider。

## Metrics

Controller manager metrics提供了控制器内部逻辑的性能度量，如Go语言运行时度量、etcd请求延时、云服务商API请求延时、云存储请求延时等。Controller manager metrics默认监听在`kube-controller-manager`的10252端口，提供Prometheus格式的性能度量数据，可以通过`http://localhost:10252/metrics`来访问。

```
$ curl http://localhost:10252/metrics
...
# HELP etcd_request_cache_add_latencies_summary Latency in microseconds of adding an object to etcd cache
# TYPE etcd_request_cache_add_latencies_summary summary
etcd_request_cache_add_latencies_summary{quantile="0.5"} NaN
etcd_request_cache_add_latencies_summary{quantile="0.9"} NaN
etcd_request_cache_add_latencies_summary{quantile="0.99"} NaN
etcd_request_cache_add_latencies_summary_sum 0
etcd_request_cache_add_latencies_summary_count 0
# HELP etcd_request_cache_get_latencies_summary Latency in microseconds of getting an object from etcd cache
# TYPE etcd_request_cache_get_latencies_summary summary
etcd_request_cache_get_latencies_summary{quantile="0.5"} NaN
etcd_request_cache_get_latencies_summary{quantile="0.9"} NaN
etcd_request_cache_get_latencies_summary{quantile="0.99"} NaN
etcd_request_cache_get_latencies_summary_sum 0
etcd_request_cache_get_latencies_summary_count 0
...
```

## How it works

### kube-controller-manager

kube-controller-manager由一系列的控制器组成，这些控制器可以划分为三组

1. 必须启动的控制器
   - EndpointController
   - ReplicationController：
   - PodGCController
   - ResourceQuotaController
   - NamespaceController
   - ServiceAccountController
   - GarbageCollectorController
   - DaemonSetController
   - JobController
   - DeploymentController
   - ReplicaSetController
   - HPAController
   - DisruptionController
   - StatefulSetController
   - CronJobController
   - CSRSigningController
   - CSRApprovingController
   - TTLController
2. 默认启动的可选控制器，可通过选项设置是否开启
   - TokenController
   - NodeController
   - ServiceController
   - RouteController
   - PVBinderController
   - AttachDetachController
3. 默认禁止的可选控制器，可通过选项设置是否开启
   - BootstrapSignerController
   - TokenCleanerController

### cloud-controller-manager

cloud-controller-manager在Kubernetes启用Cloud Provider的时候才需要，用来配合云服务提供商的控制，也包括一系列的控制器

- CloudNodeController
- RouteController
- ServiceController

### 如何保证高可用

在启动时设置`--leader-elect=true`后，controller manager会使用多节点选主的方式选择主节点。只有主节点才会调用`StartControllers()`启动所有控制器，而其他从节点则仅执行选主算法。

多节点选主的实现方法见[leaderelection.go](https://github.com/kubernetes/client-go/blob/master/tools/leaderelection/leaderelection.go)。它实现了两种资源锁（Endpoint或ConfigMap，kube-controller-manager和cloud-controller-manager都使用Endpoint锁），通过更新资源的Annotation（`control-plane.alpha.kubernetes.io/leader`），来确定主从关系。

### 如何保证高性能

从Kubernetes 1.7开始，所有需要监控资源变化情况的调用均推荐使用[Informer](https://github.com/kubernetes/client-go/blob/master/tools/cache/shared_informer.go)。Informer提供了基于事件通知的只读缓存机制，可以注册资源变化的回调函数，并可以极大减少API的调用。

Informer的使用方法可以参考[这里](https://github.com/feiskyer/kubernetes-handbook/blob/master/examples/client/informer/informer.go)。


## kube-controller-manager启动示例

```sh
kube-controller-manager --enable-dynamic-provisioning=true \
    --feature-gates=AllAlpha=true \
    --horizontal-pod-autoscaler-sync-period=10s \
    --horizontal-pod-autoscaler-use-rest-clients=true \
    --node-monitor-grace-period=10s \
    --cluster-signing-cert-file=/etc/kubernetes/pki/ca.crt \
    --address=127.0.0.1 \
    --leader-elect=true \
    --use-service-account-credentials=true \
    --controllers=*,bootstrapsigner,tokencleaner \
    --kubeconfig=/etc/kubernetes/controller-manager.conf \
    --insecure-experimental-approve-all-kubelet-csrs-for-group=system:bootstrappers \
    --root-ca-file=/etc/kubernetes/pki/ca.crt \
    --service-account-private-key-file=/etc/kubernetes/pki/sa.key \
    --cluster-signing-key-file=/etc/kubernetes/pki/ca.key
```
