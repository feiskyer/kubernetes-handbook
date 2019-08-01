# 雲平臺排錯

本章主要介紹在公有云中運行 Kubernetes 時可能會碰到的問題以及解決方法。

在公有云平臺上運行 Kubernetes，一般可以使用雲平臺提供的託管 Kubernetes 服務（比如 Google 的 GKE、微軟 Azure 的 AKS 或者 AWS 的 Amazon EKS 等）。當然，為了更自由的靈活性，也可以直接在這些公有云平臺的虛擬機中部署 Kubernetes。無論哪種方法，一般都需要給 Kubernetes 配置 Cloud Provider 選項，以方便直接利用雲平臺提供的高級網絡、持久化存儲以及安全控制等功能。

而在雲平臺中運行 Kubernetes 的常見問題有

* 認證授權問題：比如 Kubernetes Cloud Provider 中配置的認證方式無權操作虛擬機所在的網絡或持久化存儲。這一般從 kube-controller-manager 的日誌中很容易發現。
* 網絡路由配置失敗：正常情況下，Cloud Provider 會為每個 Node 配置一條 PodCIDR 至 NodeIP 的路由規則，如果這些規則有問題就會導致多主機 Pod 相互訪問的問題。
* 公網 IP 分配失敗：比如 LoadBalancer 類型的 Service 無法分配公網 IP 或者指定的公網 IP 無法使用。這一版也是配置錯誤導致的。
* 安全組配置失敗：比如無法為 Service 創建安全組（如超出配額等）或與已有的安全組衝突等。
* 持久化存儲分配或者掛載問題：比如分配 PV 失敗（如超出配額、配置錯誤等）或掛載到虛擬機失敗（比如 PV 正被其他異常 Pod 引用而導致無法從舊的虛擬機中卸載）。
* 網絡插件使用不當：比如網絡插件使用了雲平臺不支持的網絡協議等。


## Node 未註冊到集群中

通常，在 Kubelet 啟動時會自動將自己註冊到 kubernetes API 中，然後通過 `kubectl get nodes` 就可以查詢到該節點。 如果新的 Node 沒有自動註冊到 Kubernetes 集群中，那說明這個註冊過程有錯誤發生，需要檢查 kubelet 和 kube-controller-manager 的日誌，進而再根據日誌查找具體的錯誤原因。

### Kubelet 日誌

查看 Kubelet 日誌需要首先 SSH 登錄到 Node 上，然後運行 `journalctl` 命令查看 kubelet 的日誌：

```sh
journalctl -l -u kubelet
```

### kube-controller-manager 日誌

kube-controller-manager 會自動在雲平臺中給 Node 創建路由，如果路由創建創建失敗也有可能導致 Node 註冊失敗。

```sh
PODNAME=$(kubectl -n kube-system get pod -l component=kube-controller-manager -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100
```
