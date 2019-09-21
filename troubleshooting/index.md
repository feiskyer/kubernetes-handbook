# 排错概览

Kubernetes 集群以及应用排错的一般方法，主要包括

- [集群状态异常排错](cluster.md)
- [Pod运行异常排错](pod.md)
- [网络异常排错](network.md)
- [持久化存储异常排错](pv.md)
  - [AzureDisk 排错](azuredisk.md)
  - [AzureFile 排错](azurefile.md)
- [Windows容器排错](windows.md)
- [云平台异常排错](cloud.md)
  - [Azure 排错](azure.md)
- [常用排错工具](tools.md)

在排错过程中，`kubectl`  是最重要的工具，通常也是定位错误的起点。这里也列出一些常用的命令，在后续的各种排错过程中都会经常用到。

#### 查看 Pod 状态以及运行节点

```sh
kubectl get pods -o wide
kubectl -n kube-system get pods -o wide
```

#### 查看 Pod 事件

```sh
kubectl describe pod <pod-name>
```

#### 查看 Node 状态

```sh
kubectl get nodes
kubectl describe node <node-name>
```

#### kube-apiserver 日志

```sh
PODNAME=$(kubectl -n kube-system get pod -l component=kube-apiserver -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100
```

以上命令操作假设控制平面以 Kubernetes 静态 Pod 的形式来运行。如果 kube-apiserver 是用 systemd 管理的，则需要登录到 master 节点上，然后使用 journalctl -u kube-apiserver 查看其日志。

#### kube-controller-manager 日志

```sh
PODNAME=$(kubectl -n kube-system get pod -l component=kube-controller-manager -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100
```

以上命令操作假设控制平面以 Kubernetes 静态 Pod 的形式来运行。如果 kube-controller-manager 是用 systemd 管理的，则需要登录到 master 节点上，然后使用 journalctl -u kube-controller-manager 查看其日志。

#### kube-scheduler 日志

```sh
PODNAME=$(kubectl -n kube-system get pod -l component=kube-scheduler -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100
```

以上命令操作假设控制平面以 Kubernetes 静态 Pod 的形式来运行。如果 kube-scheduler 是用 systemd 管理的，则需要登录到 master 节点上，然后使用 journalctl -u kube-scheduler 查看其日志。

#### kube-dns 日志

kube-dns 通常以 Addon 的方式部署，每个 Pod 包含三个容器，最关键的是 kubedns 容器的日志：

```sh
PODNAME=$(kubectl -n kube-system get pod -l k8s-app=kube-dns -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME -c kubedns
```

#### Kubelet 日志

Kubelet 通常以 systemd 管理。查看 Kubelet 日志需要首先 SSH 登录到 Node 上，推荐使用 [kubectl-enter](https://github.com/kvaps/kubectl-enter) 插件而不是为每个节点分配公网 IP 地址。比如：

```sh
kubectl enter <node-name>
journalctl -l -u kubelet
```

#### Kube-proxy 日志

Kube-proxy 通常以 DaemonSet 的方式部署，可以直接用 kubectl 查询其日志

```sh
$ kubectl -n kube-system get pod -l component=kube-proxy
NAME               READY     STATUS    RESTARTS   AGE
kube-proxy-42zpn   1/1       Running   0          1d
kube-proxy-7gd4p   1/1       Running   0          3d
kube-proxy-87dbs   1/1       Running   0          4d
$ kubectl -n kube-system logs kube-proxy-42zpn
```

## 参考文档

* [hjacobs/kubernetes-failure-stories](https://github.com/hjacobs/kubernetes-failure-stories) 整理了一些公开的 Kubernetes 异常案例。
* <https://docs.microsoft.com/en-us/azure/aks/troubleshooting> 包含了 AKS 中排错的一般思路
* <https://cloud.google.com/kubernetes-engine/docs/troubleshooting> 包含了 GKE 中问题排查的一般思路
* <https://www.oreilly.com/ideas/kubernetes-recipes-maintenance-and-troubleshooting>
