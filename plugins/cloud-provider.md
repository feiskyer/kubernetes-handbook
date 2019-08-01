# Cloud Provider 擴展

當 Kubernetes 集群運行在雲平臺內部時，Cloud Provider 使得 Kubernetes 可以直接利用雲平臺實現持久化卷、負載均衡、網絡路由、DNS 解析以及橫向擴展等功能。

## 常見 Cloud Provider

Kubenretes 內置的 Cloud Provider 包括

- GCE
- AWS
- Azure
- Mesos
- OpenStack
- CloudStack
- Ovirt
- Photon
- Rackspace
- Vsphere

## 當前 Cloud Provider 工作原理

- apiserver，kubelet，controller-manager 都配置 cloud provider 選項
- Kubelet
  - 通過 Cloud Provider 接口查詢 nodename
  - 向 API Server 註冊 Node 時查詢 InstanceID、ProviderID、ExternalID 和 Zone 等信息
  - 定期查詢 Node 是否新增了 IP 地址
  - 設置無法調度的條件（condition），直到雲服務商的路由配置完成
- kube-apiserver
  - 向所有 Node 分發 SSH 密鑰以便建立 SSH 隧道
  - PersistentVolumeLabel 負責 PV 標籤
  - PersistentVolumeClainResize 動態擴展 PV 的大小
- kube-controller-manager
  - Node 控制器檢查 Node 所在 VM 的狀態。當 VM 刪除後自動從 API Server 中刪除該 Node。
  - Volume 控制器向雲提供商創建和刪除持久化存儲卷，並按需要掛載或卸載到指定的 VM 上。
  - Route 控制器給所有已註冊的 Nodes 配置雲路由。
  - Service 控制器給 LoadBalancer 類型的服務創建負載均衡器並更新服務的外網 IP。

## 獨立 Cloud Provider 工作 [原理](https://kubernetes.io/docs/tasks/administer-cluster/running-cloud-controller/) 以及[跟蹤進度](https://github.com/kubernetes/features/issues/88)

- Kubelet 必須配置 ``--cloud-provider=external`，並且 `kube-apiserver` 和 `kube-controller-manager` 必須不配置 cloud provider。``
- `kube-apiserver` 的准入控制選項不能包含 PersistentVolumeLabel。
- `cloud-controller-manager` 獨立運行，並開啟 `InitializerConifguration`。
- Kubelet 可以通過 `provider-id` 選項配置 `ExternalID`，啟動後會自動給 Node 添加 taint `node.cloudprovider.kubernetes.io/uninitialized=NoSchedule`。
- `cloud-controller-manager` 在收到 Node 註冊的事件後再次初始化 Node 配置，添加 zone、類型等信息，並刪除上一步 Kubelet 自動創建的 taint。
- 主要邏輯（也就是合併了 kube-apiserver 和 kube-controller-manager 跟雲相關的邏輯）
  - Node 控制器檢查 Node 所在 VM 的狀態。當 VM 刪除後自動從 API Server 中刪除該 Node。
  - Volume 控制器向雲提供商創建和刪除持久化存儲卷，並按需要掛載或卸載到指定的 VM 上。
  - Route 控制器給所有已註冊的 Nodes 配置雲路由。
  - Service 控制器給 LoadBalancer 類型的服務創建負載均衡器並更新服務的外網 IP。
  - PersistentVolumeLabel 准入控制負責 PV 標籤
  - PersistentVolumeClainResize 准入控制動態擴展 PV 大小

## 如何開發 Cloud Provider 擴展

Kubernetes 的 Cloud Provider 目前正在重構中

- v1.6 添加了獨立的 `cloud-controller-manager` 服務，雲提供商可以構建自己的 `cloud-controller-manager` 而無須修改 Kubernetes 核心代碼
- v1.7-v1.10 進一步重構 `cloud-controller-manager`，解耦了 Controller Manager 與 Cloud Controller 的代碼邏輯
- v1.11 External Cloud Provider 升級為 Beta 版

構建一個新的雲提供商的 Cloud Provider 步驟為

- 編寫實現 [cloudprovider.Interface](https://github.com/kubernetes/cloud-provider/blob/master/cloud.go) 的 cloudprovider 代碼
- 將該 cloudprovider 鏈接到 `cloud-controller-manager`
  - 在 `cloud-controller-manager` 中導入新的 cloudprovider：`import "pkg/new-cloud-provider"`
  - 初始化時傳入新 cloudprovider 的名字，如 `cloudprovider.InitCloudProvider("rancher", s.CloudConfigFile)`
- 配置 kube-controller-manager `--cloud-provider=external`
- 啟動 `cloud-controller-manager`

具體實現方法可以參考 [rancher-cloud-controller-manager](https://github.com/rancher/rancher-cloud-controller-manager) 和 [cloud-controller-manager](https://github.com/kubernetes/kubernetes/blob/master/cmd/cloud-controller-manager/controller-manager.go)。
