# Controller Manager工作原理

## kube-controller-manager

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

## cloud-controller-manager

cloud-controller-manager在Kubernetes启用Cloud Provider的时候才需要，用来配合云服务提供商的控制，也包括一系列的控制器

- CloudNodeController
- RouteController
- ServiceController

## 如何保证高可用

在启动时设置`--leader-elect=true`后，controller manager会使用多节点选主的方式选择主节点。只有主节点才会调用`StartControllers()`启动所有控制器，而其他从节点则仅执行选主算法。

多节点选主的实现方法见[leaderelection.go](https://github.com/kubernetes/client-go/blob/master/tools/leaderelection/leaderelection.go)。它实现了两种资源锁（Endpoint或ConfigMap，kube-controller-manager和cloud-controller-manager都使用Endpoint锁），通过更新资源的Annotation（`control-plane.alpha.kubernetes.io/leader`），来确定主从关系。

## 如何保证高性能

从Kubernetes 1.7开始，所有需要监控资源变化情况的调用均推荐使用[Informer](https://github.com/kubernetes/client-go/blob/master/tools/cache/shared_informer.go)。Informer提供了基于事件通知的只读缓存机制，可以注册资源变化的回调函数，并可以极大减少API的调用。

Informer的使用方法可以参考[这里](https://github.com/feiskyer/kubernetes-handbook/blob/master/examples/client/informer/informer.go)。
