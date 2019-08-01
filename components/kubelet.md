# Kubelet

每個節點上都運行一個 kubelet 服務進程，默認監聽 10250 端口，接收並執行 master 發來的指令，管理 Pod 及 Pod 中的容器。每個 kubelet 進程會在 API Server 上註冊節點自身信息，定期向 master 節點彙報節點的資源使用情況，並通過 cAdvisor 監控節點和容器的資源。

## 節點管理

節點管理主要是節點自注冊和節點狀態更新：

- Kubelet 可以通過設置啟動參數 --register-node 來確定是否向 API Server 註冊自己；
- 如果 Kubelet 沒有選擇自注冊模式，則需要用戶自己配置 Node 資源信息，同時需要告知 Kubelet 集群上的 API Server 的位置；
- Kubelet 在啟動時通過 API Server 註冊節點信息，並定時向 API Server 發送節點新消息，API Server 在接收到新消息後，將信息寫入 etcd

## Pod 管理

### 獲取 Pod 清單

Kubelet 以 PodSpec 的方式工作。PodSpec 是描述一個 Pod 的 YAML 或 JSON 對象。 kubelet 採用一組通過各種機制提供的 PodSpecs（主要通過 apiserver），並確保這些 PodSpecs 中描述的 Pod 正常健康運行。

向 Kubelet 提供節點上需要運行的 Pod 清單的方法：

- 文件：啟動參數 --config 指定的配置目錄下的文件 (默認 / etc/kubernetes/manifests/)。該文件每 20 秒重新檢查一次（可配置）。
- HTTP endpoint (URL)：啟動參數 --manifest-url 設置。每 20 秒檢查一次這個端點（可配置）。
- API Server：通過 API Server 監聽 etcd 目錄，同步 Pod 清單。
- HTTP server：kubelet 偵聽 HTTP 請求，並響應簡單的 API 以提交新的 Pod 清單。

### 通過 API Server 獲取 Pod 清單及創建 Pod 的過程

Kubelet 通過 API Server Client(Kubelet 啟動時創建)使用 Watch 加 List 的方式監聽 "/registry/nodes/$ 當前節點名" 和 “/registry/pods” 目錄，將獲取的信息同步到本地緩存中。

Kubelet 監聽 etcd，所有針對 Pod 的操作都將會被 Kubelet 監聽到。如果發現有新的綁定到本節點的 Pod，則按照 Pod 清單的要求創建該 Pod。

如果發現本地的 Pod 被修改，則 Kubelet 會做出相應的修改，比如刪除 Pod 中某個容器時，則通過 Docker Client 刪除該容器。
如果發現刪除本節點的 Pod，則刪除相應的 Pod，並通過 Docker Client 刪除 Pod 中的容器。

Kubelet 讀取監聽到的信息，如果是創建和修改 Pod 任務，則執行如下處理：

- 為該 Pod 創建一個數據目錄；
- 從 API Server 讀取該 Pod 清單；
- 為該 Pod 掛載外部卷；
- 下載 Pod 用到的 Secret；
- 檢查已經在節點上運行的 Pod，如果該 Pod 沒有容器或 Pause 容器沒有啟動，則先停止 Pod 裡所有容器的進程。如果在 Pod 中有需要刪除的容器，則刪除這些容器；
- 用 “kubernetes/pause” 鏡像為每個 Pod 創建一個容器。Pause 容器用於接管 Pod 中所有其他容器的網絡。每創建一個新的 Pod，Kubelet 都會先創建一個 Pause 容器，然後創建其他容器。
- 為 Pod 中的每個容器做如下處理：
  1. 為容器計算一個 hash 值，然後用容器的名字去 Docker 查詢對應容器的 hash 值。若查找到容器，且兩者 hash 值不同，則停止 Docker 中容器的進程，並停止與之關聯的 Pause 容器的進程；若兩者相同，則不做任何處理；
  1. 如果容器被終止了，且容器沒有指定的 restartPolicy，則不做任何處理；
  1. 調用 Docker Client 下載容器鏡像，調用 Docker Client 運行容器。

### Static Pod

所有以非 API Server 方式創建的 Pod 都叫 Static Pod。Kubelet 將 Static Pod 的狀態彙報給 API Server，API Server 為該 Static Pod 創建一個 Mirror Pod 和其相匹配。Mirror Pod 的狀態將真實反映 Static Pod 的狀態。當 Static Pod 被刪除時，與之相對應的 Mirror Pod 也會被刪除。

## 容器健康檢查

Pod 通過兩類探針檢查容器的健康狀態:

- (1) LivenessProbe 探針：用於判斷容器是否健康，告訴 Kubelet 一個容器什麼時候處於不健康的狀態。如果 LivenessProbe 探針探測到容器不健康，則 Kubelet 將刪除該容器，並根據容器的重啟策略做相應的處理。如果一個容器不包含 LivenessProbe 探針，那麼 Kubelet 認為該容器的 LivenessProbe 探針返回的值永遠是 “Success”；
- (2)ReadinessProbe：用於判斷容器是否啟動完成且準備接收請求。如果 ReadinessProbe 探針探測到失敗，則 Pod 的狀態將被修改。Endpoint Controller 將從 Service 的 Endpoint 中刪除包含該容器所在 Pod 的 IP 地址的 Endpoint 條目。

Kubelet 定期調用容器中的 LivenessProbe 探針來診斷容器的健康狀況。LivenessProbe 包含如下三種實現方式：

- ExecAction：在容器內部執行一個命令，如果該命令的退出狀態碼為 0，則表明容器健康；
- TCPSocketAction：通過容器的 IP 地址和端口號執行 TCP 檢查，如果端口能被訪問，則表明容器健康；
- HTTPGetAction：通過容器的 IP 地址和端口號及路徑調用 HTTP GET 方法，如果響應的狀態碼大於等於 200 且小於 400，則認為容器狀態健康。

LivenessProbe 探針包含在 Pod 定義的 spec.containers.{某個容器} 中。

## cAdvisor 資源監控

Kubernetes 集群中，應用程序的執行情況可以在不同的級別上監測到，這些級別包括：容器、Pod、Service 和整個集群。Heapster 項目為 Kubernetes 提供了一個基本的監控平臺，它是集群級別的監控和事件數據集成器 (Aggregator)。Heapster 以 Pod 的方式運行在集群中，Heapster 通過 Kubelet 發現所有運行在集群中的節點，並查看來自這些節點的資源使用情況。Kubelet 通過 cAdvisor 獲取其所在節點及容器的數據。Heapster 通過帶著關聯標籤的 Pod 分組這些信息，這些數據將被推到一個可配置的後端，用於存儲和可視化展示。支持的後端包括 InfluxDB(使用 Grafana 實現可視化) 和 Google Cloud Monitoring。

cAdvisor 是一個開源的分析容器資源使用率和性能特性的代理工具，已集成到 Kubernetes 代碼中。cAdvisor 自動查找所有在其所在節點上的容器，自動採集 CPU、內存、文件系統和網絡使用的統計信息。cAdvisor 通過它所在節點機的 Root 容器，採集並分析該節點機的全面使用情況。

cAdvisor 通過其所在節點機的 4194 端口暴露一個簡單的 UI。

## Kubelet Eviction（驅逐）

Kubelet 會監控資源的使用情況，並使用驅逐機制防止計算和存儲資源耗盡。在驅逐時，Kubelet 將 Pod 的所有容器停止，並將 PodPhase 設置為 Failed。

Kubelet 定期（`housekeeping-interval`）檢查系統的資源是否達到了預先配置的驅逐閾值，包括

| Eviction Signal      | Condition     | Description                                                  |
| -------------------- | ------------- | ------------------------------------------------------------ |
| `memory.available`   | MemoryPressue | `memory.available` := `node.status.capacity[memory]` - `node.stats.memory.workingSet` （計算方法參考[這裡](https://kubernetes.io/docs/tasks/administer-cluster/out-of-resource/memory-available.sh)） |
| `nodefs.available`   | DiskPressure  | `nodefs.available` := `node.stats.fs.available`（Kubelet Volume以及日誌等） |
| `nodefs.inodesFree`  | DiskPressure  | `nodefs.inodesFree` := `node.stats.fs.inodesFree`            |
| `imagefs.available`  | DiskPressure  | `imagefs.available` := `node.stats.runtime.imagefs.available`（鏡像以及容器可寫層等） |
| `imagefs.inodesFree` | DiskPressure  | `imagefs.inodesFree` := `node.stats.runtime.imagefs.inodesFree` |

這些驅逐閾值可以使用百分比，也可以使用絕對值，如

```sh
--eviction-hard=memory.available<500Mi,nodefs.available<1Gi,imagefs.available<100Gi
--eviction-minimum-reclaim="memory.available=0Mi,nodefs.available=500Mi,imagefs.available=2Gi"`
--system-reserved=memory=1.5Gi
```

這些驅逐信號可以分為軟驅逐和硬驅逐

- 軟驅逐（Soft Eviction）：配合驅逐寬限期（eviction-soft-grace-period和eviction-max-pod-grace-period）一起使用。系統資源達到軟驅逐閾值並在超過寬限期之後才會執行驅逐動作。
- 硬驅逐（Hard Eviction ）：系統資源達到硬驅逐閾值時立即執行驅逐動作。

驅逐動作包括回收節點資源和驅逐用戶 Pod 兩種：

- 回收節點資源
  - 配置了 imagefs 閾值時
    - 達到 nodefs 閾值：刪除已停止的 Pod
    - 達到 imagefs 閾值：刪除未使用的鏡像
  - 未配置 imagefs 閾值時
    - 達到 nodefs閾值時，按照刪除已停止的 Pod 和刪除未使用鏡像的順序清理資源
- 驅逐用戶 Pod
  - 驅逐順序為：BestEffort、Burstable、Guaranteed
  - 配置了 imagefs 閾值時
    - 達到 nodefs 閾值，基於 nodefs 用量驅逐（local volume + logs）
    - 達到 imagefs 閾值，基於 imagefs 用量驅逐（容器可寫層）
  - 未配置 imagefs 閾值時
    - 達到 nodefs閾值時，按照總磁盤使用驅逐（local volume + logs + 容器可寫層）

## 容器運行時

容器運行時（Container Runtime）是 Kubernetes 最重要的組件之一，負責真正管理鏡像和容器的生命週期。Kubelet 通過 [Container Runtime Interface (CRI)](../plugins/CRI.md) 與容器運行時交互，以管理鏡像和容器。

Container Runtime Interface（CRI）是 Kubernetes v1.5 引入的容器運行時接口，它將 Kubelet 與容器運行時解耦，將原來完全面向 Pod 級別的內部接口拆分成面向 Sandbox 和 Container 的 gRPC 接口，並將鏡像管理和容器管理分離到不同的服務。

![](../plugins/images/cri.png)

CRI 最早從從 1.4 版就開始設計討論和開發，在 v1.5 中發佈第一個測試版。在 v1.6 時已經有了很多外部容器運行時，如 frakti 和 cri-o 等。v1.7 中又新增了 cri-containerd 支持用 Containerd 來管理容器。

CRI 基於 gRPC 定義了 RuntimeService 和 ImageService 等兩個 gRPC 服務，分別用於容器運行時和鏡像的管理。其定義在

- v1.14 以以上：<https://github.com/kubernetes/cri-api/tree/master/pkg/apis/runtime>
- v1.10-v1.13: [pkg/kubelet/apis/cri/runtime/v1alpha2](https://github.com/kubernetes/kubernetes/tree/release-1.13/pkg/kubelet/apis/cri/runtime/v1alpha2)
- v1.7-v1.9: [pkg/kubelet/apis/cri/v1alpha1/runtime](https://github.com/kubernetes/kubernetes/tree/release-1.9/pkg/kubelet/apis/cri/v1alpha1/runtime)
- v1.6: [pkg/kubelet/api/v1alpha1/runtime](https://github.com/kubernetes/kubernetes/tree/release-1.6/pkg/kubelet/api/v1alpha1/runtime)

Kubelet 作為 CRI 的客戶端，而容器運行時則需要實現 CRI 的服務端（即 gRPC server，通常稱為 CRI shim）。容器運行時在啟動 gRPC server 時需要監聽在本地的 Unix Socket （Windows 使用 tcp 格式）。



![](images/cri.png)

目前基於 CRI 容器引擎已經比較豐富了，包括

- Docker: 核心代碼依然保留在 kubelet 內部（[pkg/kubelet/dockershim](https://github.com/kubernetes/kubernetes/tree/master/pkg/kubelet/dockershim)），是最穩定和特性支持最好的運行時
- OCI 容器運行時：
  - 社區有兩個實現
    - [Containerd](https://github.com/containerd/cri)，支持 kubernetes v1.7+
    - [CRI-O](https://github.com/kubernetes-incubator/cri-o)，支持 Kubernetes v1.6+
  - 支持的 OCI 容器引擎包括
    - [runc](https://github.com/opencontainers/runc)：OCI 標準容器引擎
    - [gVisor](https://github.com/google/gvisor)：谷歌開源的基於用戶空間內核的沙箱容器引擎
    - [Clear Containers](https://github.com/clearcontainers/runtime)：Intel 開源的基於虛擬化的容器引擎
    - [Kata Containers](https://github.com/kata-containers/runtime)：基於虛擬化的容器引擎，由 Clear Containers 和 runV 合併而來
- [PouchContainer](https://github.com/alibaba/pouch)：阿里巴巴開源的胖容器引擎
- [Frakti](https://github.com/kubernetes/frakti)：支持 Kubernetes v1.6+，提供基於 hypervisor 和 docker 的混合運行時，適用於運行非可信應用，如多租戶和 NFV 等場景
- [Rktlet](https://github.com/kubernetes-incubator/rktlet)：支持 [rkt](https://github.com/rkt/rkt) 容器引擎
- [Virtlet](https://github.com/Mirantis/virtlet)：Mirantis 開源的虛擬機容器引擎，直接管理 libvirt 虛擬機，鏡像須是 qcow2 格式
- [Infranetes](https://github.com/apporbit/infranetes)：直接管理 IaaS 平臺虛擬機，如 GCE、AWS 等

## 啟動 kubelet 示例

```sh
/usr/bin/kubelet \
  --bootstrap-kubeconfig=/etc/kubernetes/bootstrap-kubelet.conf \
  --kubeconfig=/etc/kubernetes/kubelet.conf \
  --pod-manifest-path=/etc/kubernetes/manifests \
  --allow-privileged=true \
  --network-plugin=cni \
  --cni-conf-dir=/etc/cni/net.d \
  --cni-bin-dir=/opt/cni/bin \
  --cluster-dns=10.96.0.10 \
  --cluster-domain=cluster.local \
  --authorization-mode=Webhook \
  --client-ca-file=/etc/kubernetes/pki/ca.crt \
  --cadvisor-port=0 \
  --rotate-certificates=true \
  --cert-dir=/var/lib/kubelet/pki
```

## kubelet 工作原理

如下 kubelet 內部組件結構圖所示，Kubelet 由許多內部組件構成

- Kubelet API，包括 10250 端口的認證 API、4194 端口的 cAdvisor API、10255 端口的只讀 API 以及 10248 端口的健康檢查 API
- syncLoop：從 API 或者 manifest 目錄接收 Pod 更新，發送到 podWorkers 處理，大量使用 channel 處理來處理異步請求
- 輔助的 manager，如 cAdvisor、PLEG、Volume Manager 等，處理 syncLoop 以外的其他工作
- CRI：容器執行引擎接口，負責與 container runtime shim 通信
- 容器執行引擎，如 dockershim、rkt 等（注：rkt 暫未完成 CRI 的遷移）
- 網絡插件，目前支持 CNI 和 kubenet

![](images/kubelet.png)

### Pod 啟動流程

![Pod Start](images/pod-start.png)

### 查詢 Node 彙總指標

通過 Kubelet 的 10255 端口可以查詢 Node 的彙總指標。有兩種訪問方式

- 在集群內部可以直接訪問 kubelet 的 10255 端口，比如 `http://<node-name>:10255/stats/summary`
- 在集群外部可以藉助 `kubectl proxy` 來訪問，比如

```sh
kubectl proxy&
curl http://localhost:8001/api/v1/proxy/nodes/<node-name>:10255/stats/summary
```
