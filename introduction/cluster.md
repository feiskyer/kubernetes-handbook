# Kubernetes 集群

![](architecture.png)

一个 Kubernetes 集群由分布式存储 etcd、控制节点 controller 以及服务节点 Node 组成。

- 控制节点主要负责整个集群的管理，比如容器的调度、维护资源的状态、自动扩展以及滚动更新等
- 服务节点是真正运行容器的主机，负责管理镜像和容器以及 cluster 内的服务发现和负载均衡
- etcd 集群保存了整个集群的状态

详细的介绍请参考 [Kubernetes 架构](../architecture/architecture.md)。

## 集群联邦

集群联邦（Federation）用于跨可用区的 Kubernetes 集群，需要配合云服务商（如 GCE、AWS）一起实现。

![](federation.png)

详细的介绍请参考 [Federation](../components/federation.md)。

## 创建 Kubernetes 集群

可以参考 [Kubernetes 部署指南](../deploy/index.md) 来部署一套 Kubernetes 集群。而对于初学者或者简单验证测试的用户，则可以使用以下几种更简单的方法。

### minikube

创建 Kubernetes cluster（单机版）最简单的方法是 [minikube](https://github.com/kubernetes/minikube):

```sh
$ minikube start
Starting local Kubernetes cluster...
Kubectl is now configured to use the cluster.
$ kubectl cluster-info
Kubernetes master is running at https://192.168.64.12:8443
kubernetes-dashboard is running at https://192.168.64.12:8443/api/v1/proxy/namespaces/kube-system/services/kubernetes-dashboard

To further debug and diagnose cluster problems, use 'kubectl cluster-info dump'.
```

### play-with-k8s

[Play with Kubernetes](http://play-with-k8s.com) 提供了一个免费的 Kubernetes 体验环境，直接访问 < http://play-with-k8s.com > 就可以使用 kubeadm 来创建 Kubernetes 集群。注意，每次创建的集群最长可以使用 4 小时。

Play with Kubernetes 有个非常方便的功能：自动在页面上显示所有 NodePort 类型服务的端口，点击该端口即可访问对应的服务。

详细使用方法可以参考 [Play-With-Kubernetes](../appendix/play-with-k8s.md)。

### Katacoda playground

[Katacoda playground](https://www.katacoda.com/courses/kubernetes/playground)也提供了一个免费的 2 节点 Kubernetes 体验环境，网络基于 WeaveNet，并且会自动部署整个集群。但要注意，刚打开 [Katacoda playground](https://www.katacoda.com/courses/kubernetes/playground) 页面时集群有可能还没初始化完成，可以在 master 节点上运行 `launch.sh` 等待集群初始化完成。

部署并访问 kubernetes dashboard 的方法：

```sh
# 在 master node 上面运行
kubectl create -f https://raw.githubusercontent.com/kubernetes/dashboard/v1.10.1/src/deploy/recommended/kubernetes-dashboard.yaml
kubectl proxy --address='0.0.0.0' --port=8080 --accept-hosts='^*$'&
```

然后点击 Terminal Host 1 右边的➕，从弹出的菜单里选择 View HTTP port 8080 on Host 1，即可打开 Kubernetes 的 API 页面。在该网址后面增加 `/ui` 即可访问 dashboard。
