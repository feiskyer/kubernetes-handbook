# Node

Node 是 Pod 真正運行的主機，可以是物理機，也可以是虛擬機。為了管理 Pod，每個 Node 節點上至少要運行 container runtime（比如 `docker` 或者 `rkt`）、`kubelet` 和 `kube-proxy` 服務。

![node](images/node.png)

## Node 管理

不像其他的資源（如 Pod 和 Namespace），Node 本質上不是 Kubernetes 來創建的，Kubernetes 只是管理 Node 上的資源。雖然可以通過 Manifest 創建一個 Node 對象（如下 yaml 所示），但 Kubernetes 也只是去檢查是否真的是有這麼一個 Node，如果檢查失敗，也不會往上調度 Pod。

```yaml
kind: Node
apiVersion: v1
metadata:
  name: 10-240-79-157
  labels:
    name: my-first-k8s-node
```

這個檢查是由 Node Controller 來完成的。Node Controller 負責

- 維護 Node 狀態
- 與 Cloud Provider 同步 Node
- 給 Node 分配容器 CIDR
- 刪除帶有 `NoExecute` taint 的 Node 上的 Pods

默認情況下，kubelet 在啟動時會向 master 註冊自己，並創建 Node 資源。

## Node 的狀態

每個 Node 都包括以下狀態信息：

- 地址：包括 hostname、外網 IP 和內網 IP
- 條件（Condition）：包括 OutOfDisk、Ready、MemoryPressure 和 DiskPressure
- 容量（Capacity）：Node 上的可用資源，包括 CPU、內存和 Pod 總數
- 基本信息（Info）：包括內核版本、容器引擎版本、OS 類型等

## Taints 和 tolerations

Taints 和 tolerations 用於保證 Pod 不被調度到不合適的 Node 上，Taint 應用於 Node 上，而 toleration 則應用於 Pod 上（Toleration 是可選的）。

比如，可以使用 taint 命令給 node1 添加 taints：

```sh
kubectl taint nodes node1 key1=value1:NoSchedule
kubectl taint nodes node1 key1=value2:NoExecute
```

Taints 和 tolerations 的具體使用方法請參考 [調度器章節](../components/scheduler.md#Taints 和 tolerations)。

## Node 維護模式

標誌 Node 不可調度但不影響其上正在運行的 Pod，這種維護 Node 時是非常有用的

```sh
kubectl cordon $NODENAME
```

## 參考文檔

- [Kubernetes Node](https://kubernetes.io/docs/concepts/architecture/nodes/)
- [Taints 和 tolerations](https://kubernetes.io/docs/concepts/configuration/assign-pod-node/#taints-and-tolerations-beta-feature)
