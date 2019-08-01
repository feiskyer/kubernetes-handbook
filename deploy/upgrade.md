# Kubernetes  版本支持策略

## 版本支持

Kubernetes 版本的格式為 **x.y.z**，其中 x 是主版本號，y 是次版本號，而 z 則是修訂版本。版本的格式遵循 [Semantic Versioning](http://semver.org/) ，即
- 主版本號：當你做了不兼容的 API 修改，
- 次版本號：當你做了向下兼容的功能性新增，
- 修訂號：當你做了向下兼容的問題修正。
  Kubernetes 項目只維護最新的三個次版本，每個版本都會放到不同的發佈分支中維護。上游版本發現的嚴重缺陷以及安全修復等都會移植到這些發佈分支中，這些分支由 [patch release manager](https://github.com/kubernetes/sig-release/blob/master/release-team/role-handbooks/patch-release-manager/README.md#release-timing) 來維護。
  次版本一般是每三個月發佈一次，所以每個發佈分支一般會維護 9 個月。
## 不同組件的版本支持情況
在 Kubernetes 中，不同組件的版本並不要求完全一致，但不同版本的組件混合部署時也有一些最基本的限制。
### kube-apiserver
在 [highly-availabile (HA) clusters](https://kubernetes.io/docs/setup/independent/high-availability/) 集群中，kube-apiserver 的版本差不能超過一個次版本號。比如最新的 kube-apiserver 版本號為 1.13 時，其他 kube-apiserver 的版本只能是 1.13 或者 1.12。
### kubelet
Kubelet 的版本不能高於 kube-apiserver 的版本，並且跟 kube-apiserver 相比，最多可以相差兩個次版本號。比如：
* `kube-apiserver` 的版本是 **1.13**
* 相應的  `kubelet` 的版本為 **1.13**, **1.12**, and **1.11**
  再比如，一個高可用的集群中：
* `kube-apiserver` 版本號為 **1.13** and **1.12**
* 相應的  `kubelet`  版本為 **1.12**, and **1.11** ( **1.13** 不支持，因為它比 kube-apiserver 的 **1.12** 高)
### kube-controller-manager, kube-scheduler, and cloud-controller-manager
`kube-controller-manager`, `kube-scheduler`, 和 `cloud-controller-manager` 不能高於 kube-apiserver 的版本。通常它們的版本應該跟 kube-apiserver 一致，不過也支持相差一個次版本號同時運行。比如：
* `kube-apiserver` 版本為 **1.13**
* 相應的 `kube-controller-manager`, `kube-scheduler`, 和 `cloud-controller-manager`  版本為 **1.13** and **1.12**
  再比如，一個高可用的集群中：
* `kube-apiserver`  版本為 **1.13** and **1.12**
* 相應的 `kube-controller-manager`, `kube-scheduler`, 和  `cloud-controller-manager` 版本為 **1.12** ( **1.13** 不支持，因為它比 apiserver 的**1.12** 高)
### kubectl
kubectl 可以跟 kube-apiserver 相差一個次版本號，比如：
* `kube-apiserver` 版本為 **1.13**
* 相應的  `kubectl` 版本為 **1.14**, **1.13** 和 **1.12**
## 版本升級順序
當從 1.n 版本升級到 1.(n+1) 版本時，必須要遵循以下的升級順序。
### kube-apiserver
前提條件：
* 單節點集群中， kube-apiserver 的版本為 1.n；HA 集群中，kube-apiserver 版本為 1.n 或者 1.(n+1)。
* `kube-controller-manager`, `kube-scheduler` 以及 `cloud-controller-manager` 的版本都是 1.n。
* kubelet 的版本是 1.n 或者 1.(n-1)
* 已註冊的注入控制 webhook 可以處理新版本的請求，比如 ValidatingWebhookConfiguration 和 MutatingWebhookConfiguration 已經更新為支持 1.(n+1) 版本中新引入的特性。

接下來就可以把 kube-apiserver 升級到 1.(n+1)了，不過要注意**版本升級時不可跳過次版本號**。

### kube-controller-manager, kube-scheduler, and cloud-controller-manager
前提條件：
- kube-apiserver 已經升級到 1.(n+1) 版本。

接下來就可以把  `kube-controller-manager`, `kube-scheduler` 和  `cloud-controller-manager` 都升級到 **1.(n+1)** 版本了。

### kubelet

前提條件：
- kube-apiserver 已經升級到 1.(n+1) 版本。
- 升級過程中需要保證 kubelet 跟 kube-apiserver 最多隻相差一個次版本號。

接下來就可以把 kubelet 升級到 1.(n+1)了。

## 參考文檔
* [Kubernetes Version and Version Skew Support Policy - Kubernetes](https://kubernetes.io/docs/setup/version-skew-policy/)