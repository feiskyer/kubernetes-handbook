# 核心組件

![components](images/components.png)

Kubernetes 主要由以下幾個核心組件組成:

- etcd 保存了整個集群的狀態；
- apiserver 提供了資源操作的唯一入口，並提供認證、授權、訪問控制、API 註冊和發現等機制；
- controller manager 負責維護集群的狀態，比如故障檢測、自動擴展、滾動更新等；
- scheduler 負責資源的調度，按照預定的調度策略將 Pod 調度到相應的機器上；
- kubelet 負責維護容器的生命週期，同時也負責 Volume（CVI）和網絡（CNI）的管理；
- Container runtime 負責鏡像管理以及 Pod 和容器的真正運行（CRI）；
- kube-proxy 負責為 Service 提供 cluster 內部的服務發現和負載均衡；

## 組件通信

Kubernetes 多組件之間的通信原理為

- apiserver 負責 etcd 存儲的所有操作，且只有 apiserver 才直接操作 etcd 集群
- apiserver 對內（集群中的其他組件）和對外（用戶）提供統一的 REST API，其他組件均通過 apiserver 進行通信
  - controller manager、scheduler、kube-proxy 和 kubelet 等均通過 apiserver watch API 監測資源變化情況，並對資源作相應的操作
  - 所有需要更新資源狀態的操作均通過 apiserver 的 REST API 進行
- apiserver 也會直接調用 kubelet API（如 logs, exec, attach 等），默認不校驗 kubelet 證書，但可以通過 `--kubelet-certificate-authority` 開啟（而 GKE 通過 SSH 隧道保護它們之間的通信）

比如典型的創建 Pod 的流程為

![](images/workflow.png)

1. 用戶通過 REST API 創建一個 Pod
2. apiserver 將其寫入 etcd
3. scheduluer 檢測到未綁定 Node 的 Pod，開始調度並更新 Pod 的 Node 綁定
4. kubelet 檢測到有新的 Pod 調度過來，通過 container runtime 運行該 Pod
5. kubelet 通過 container runtime 取到 Pod 狀態，並更新到 apiserver 中

## 端口號

![ports](images/ports.png)

### Master node(s)

| Protocol | Direction | Port Range | Purpose                          |
| -------- | --------- | ---------- | -------------------------------- |
| TCP      | Inbound   | 6443*      | Kubernetes API server            |
| TCP      | Inbound   | 8080       | Kubernetes API insecure server   |
| TCP      | Inbound   | 2379-2380  | etcd server client API           |
| TCP      | Inbound   | 10250      | Kubelet API                      |
| TCP      | Inbound   | 10251      | kube-scheduler healthz           |
| TCP      | Inbound   | 10252      | kube-controller-manager healthz  |
| TCP      | Inbound   | 10253      | cloud-controller-manager healthz |
| TCP      | Inbound   | 10255      | Read-only Kubelet API            |
| TCP      | Inbound   | 10256      | kube-proxy healthz               |

### Worker node(s)

| Protocol | Direction | Port Range  | Purpose               |
| -------- | --------- | ----------- | --------------------- |
| TCP      | Inbound   | 4194        | Kubelet cAdvisor      |
| TCP      | Inbound   | 10248       | Kubelet healthz       |
| TCP      | Inbound   | 10249       | kube-proxy metrics    |
| TCP      | Inbound   | 10250       | Kubelet API           |
| TCP      | Inbound   | 10255       | Read-only Kubelet API |
| TCP      | Inbound   | 10256       | kube-proxy healthz    |
| TCP      | Inbound   | 30000-32767 | NodePort Services**   |

## 參考文檔

- [Master-Node communication](https://kubernetes.io/docs/concepts/architecture/master-node-communication/)
- [Core Kubernetes: Jazz Improv over Orchestration](https://blog.heptio.com/core-kubernetes-jazz-improv-over-orchestration-a7903ea92ca)
- [Installing kubeadm](https://kubernetes.io/docs/setup/independent/install-kubeadm/#check-required-ports)
