# 排錯概覽

Kubernetes 集群以及應用排錯的一般方法，主要包括

- [集群狀態異常排錯](cluster.md)
- [Pod運行異常排錯](pod.md)
- [網絡異常排錯](network.md)
- [持久化存儲異常排錯](pv.md)
  - [AzureDisk 排錯](azuredisk.md)
  - [AzureFile 排錯](azurefile.md)
- [Windows容器排錯](windows.md)
- [雲平臺異常排錯](cloud.md)
  - [Azure 排錯](azure.md)
- [常用排錯工具](tools.md)

在排錯過程中，`kubectl`  是最重要的工具，通常也是定位錯誤的起點。這裡也列出一些常用的命令，在後續的各種排錯過程中都會經常用到。

#### 查看 Pod 狀態以及運行節點

```sh
kubectl get pods -o wide
kubectl -n kube-system get pods -o wide
```

#### 查看 Pod 事件

```sh
kubectl describe pod <pod-name>
```

#### 查看 Node 狀態

```sh
kubectl get nodes
kubectl describe node <node-name>
```

#### kube-apiserver 日誌

```sh
PODNAME=$(kubectl -n kube-system get pod -l component=kube-apiserver -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100
```

以上命令操作假設控制平面以 Kubernetes 靜態 Pod 的形式來運行。如果 kube-apiserver 是用 systemd 管理的，則需要登錄到 master 節點上，然後使用 journalctl -u kube-apiserver 查看其日誌。

#### kube-controller-manager 日誌

```sh
PODNAME=$(kubectl -n kube-system get pod -l component=kube-controller-manager -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100
```

以上命令操作假設控制平面以 Kubernetes 靜態 Pod 的形式來運行。如果 kube-controller-manager 是用 systemd 管理的，則需要登錄到 master 節點上，然後使用 journalctl -u kube-controller-manager 查看其日誌。

#### kube-scheduler 日誌

```sh
PODNAME=$(kubectl -n kube-system get pod -l component=kube-scheduler -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100
```

以上命令操作假設控制平面以 Kubernetes 靜態 Pod 的形式來運行。如果 kube-scheduler 是用 systemd 管理的，則需要登錄到 master 節點上，然後使用 journalctl -u kube-scheduler 查看其日誌。

#### kube-dns 日誌

kube-dns 通常以 Addon 的方式部署，每個 Pod 包含三個容器，最關鍵的是 kubedns 容器的日誌：

```sh
PODNAME=$(kubectl -n kube-system get pod -l k8s-app=kube-dns -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME -c kubedns
```

#### Kubelet 日誌

Kubelet 通常以 systemd 管理。查看 Kubelet 日誌需要首先 SSH 登錄到 Node 上。

```sh
journalctl -l -u kubelet
```

#### Kube-proxy 日誌

Kube-proxy 通常以 DaemonSet 的方式部署，可以直接用 kubectl 查詢其日誌

```sh
$ kubectl -n kube-system get pod -l component=kube-proxy
NAME               READY     STATUS    RESTARTS   AGE
kube-proxy-42zpn   1/1       Running   0          1d
kube-proxy-7gd4p   1/1       Running   0          3d
kube-proxy-87dbs   1/1       Running   0          4d
$ kubectl -n kube-system logs kube-proxy-42zpn
```

## 參考文檔

* [hjacobs/kubernetes-failure-stories](https://github.com/hjacobs/kubernetes-failure-stories) 整理了一些公開的 Kubernetes 異常案例。
* <https://docs.microsoft.com/en-us/azure/aks/troubleshooting> 包含了 AKS 中排錯的一般思路
* <https://cloud.google.com/kubernetes-engine/docs/troubleshooting> 包含了 GKE 中問題排查的一般思路
* <https://www.oreilly.com/ideas/kubernetes-recipes-maintenance-and-troubleshooting>