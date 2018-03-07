# 排错指南

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

在排错过程中，`kubectl`  是最重要的工具，通常也是定位错误的起点。

#### 查看 Pod 状态以及运行节点

```sh
kubectl get pods -o wide
kubectl -n kube-system get pods -o wide
```

#### 查看 Pod 事件

```sh
kubectl describe pod <pod-name>
```

#### kube-apiserver 日志

```sh
PODNAME=$(kubectl -n kube-system get pod -l component=kube-apiserver -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100
```

#### kube-controller-manager 日志

```sh
PODNAME=$(kubectl -n kube-system get pod -l component=kube-controller-manager -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100
```

#### kube-scheduler 日志

```sh
PODNAME=$(kubectl -n kube-system get pod -l component=kube-scheduler -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100
```

#### kube-dns 日志

```sh
PODNAME=$(kubectl -n kube-system get pod -l k8s-app=kube-dns -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME -c kubedns
```

#### Kubelet 日志

查看 Kubelet 日志需要首先 SSH 登录到 Node 上。

```sh
journalctl -l -u kubelet
```

#### Kube-proxy 日志

Kube-proxy 通常以 DaemonSet 的方式部署

```sh
$ kubectl -n kube-system get pod -l component=kube-proxy
NAME               READY     STATUS    RESTARTS   AGE
kube-proxy-42zpn   1/1       Running   0          1d
kube-proxy-7gd4p   1/1       Running   0          3d
kube-proxy-87dbs   1/1       Running   0          4d
$ kubectl -n kube-system logs kube-proxy-42zpn
```