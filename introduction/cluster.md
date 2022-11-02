# Kubernetes 集群

![](../.gitbook/assets/architecture%20%287%29.png)

一个 Kubernetes 集群由分布式存储 etcd、控制节点 controller 以及服务节点 Node 组成。

* 控制节点主要负责整个集群的管理，比如容器的调度、维护资源的状态、自动扩展以及滚动更新等
* 服务节点是真正运行容器的主机，负责管理镜像和容器以及 cluster 内的服务发现和负载均衡
* etcd 集群保存了整个集群的状态

详细的介绍请参考 [Kubernetes 架构](../concepts/architecture.md)。

## 集群联邦

集群联邦（Federation）用于跨可用区的 Kubernetes 集群，需要配合云服务商（如 GCE、AWS）一起实现。

![](../.gitbook/assets/federation%20%284%29.png)

详细的介绍请参考 [Federation](../concepts/components/federation.md)。

## 创建 Kubernetes 集群

可以参考 [Kubernetes 部署指南](../setup/index.md) 来部署一套 Kubernetes 集群。而对于初学者或者简单验证测试的用户，则可以使用以下几种更简单的方法。

### minikube

创建 Kubernetes cluster（单机版）最简单的方法是 [minikube](https://github.com/kubernetes/minikube):

```bash
$ minikube start
Starting local Kubernetes cluster...
Kubectl is now configured to use the cluster.
$ kubectl cluster-info
Kubernetes master is running at https://192.168.64.12:8443
kubernetes-dashboard is running at https://192.168.64.12:8443/api/v1/proxy/namespaces/kube-system/services/kubernetes-dashboard

To further debug and diagnose cluster problems, use 'kubectl cluster-info dump'.
```

### play-with-k8s

[Play with Kubernetes](http://play-with-k8s.com) 提供了一个免费的 Kubernetes 体验环境，直接访问 &lt; [http://play-with-k8s.com](http://play-with-k8s.com) &gt; 就可以使用 kubeadm 来创建 Kubernetes 集群。注意，每次创建的集群最长可以使用 4 小时。

Play with Kubernetes 有个非常方便的功能：自动在页面上显示所有 NodePort 类型服务的端口，点击该端口即可访问对应的服务。

详细使用方法可以参考 [Play-With-Kubernetes](https://github.com/feiskyer/kubernetes-handbook/tree/549e0e3c9ba0175e64b2d4719b5a46e9016d532b/appendix/play-with-k8s.md)。

