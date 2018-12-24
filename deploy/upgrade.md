# Kubernetes  版本支持策略

## 版本支持

Kubernetes 版本的格式为 **x.y.z**，其中 x 是主版本号，y 是次版本号，而 z 则是修订版本。版本的格式遵循 [Semantic Versioning](http://semver.org/) ，即
- 主版本号：当你做了不兼容的 API 修改，
- 次版本号：当你做了向下兼容的功能性新增，
- 修订号：当你做了向下兼容的问题修正。
  Kubernetes 项目只维护最新的三个次版本，每个版本都会放到不同的发布分支中维护。上游版本发现的严重缺陷以及安全修复等都会移植到这些发布分支中，这些分支由 [patch release manager](https://github.com/kubernetes/sig-release/blob/master/release-team/role-handbooks/patch-release-manager/README.md#release-timing) 来维护。
  次版本一般是每三个月发布一次，所以每个发布分支一般会维护 9 个月。
## 不同组件的版本支持情况
在 Kubernetes 中，不同组件的版本并不要求完全一致，但不同版本的组件混合部署时也有一些最基本的限制。
### kube-apiserver
在 [highly-availabile (HA) clusters](https://kubernetes.io/docs/setup/independent/high-availability/) 集群中，kube-apiserver 的版本差不能超过一个次版本号。比如最新的 kube-apiserver 版本号为 1.13 时，其他 kube-apiserver 的版本只能是 1.13 或者 1.12。
### kubelet
Kubelet 的版本不能高于 kube-apiserver 的版本，并且跟 kube-apiserver 相比，最多可以相差两个次版本号。比如：
* `kube-apiserver` 的版本是 **1.13**
* 相应的  `kubelet` 的版本为 **1.13**, **1.12**, and **1.11**
  再比如，一个高可用的集群中：
* `kube-apiserver` 版本号为 **1.13** and **1.12**
* 相应的  `kubelet`  版本为 **1.12**, and **1.11** ( **1.13** 不支持，因为它比 kube-apiserver 的 **1.12** 高)
### kube-controller-manager, kube-scheduler, and cloud-controller-manager
`kube-controller-manager`, `kube-scheduler`, 和 `cloud-controller-manager` 不能高于 kube-apiserver 的版本。通常它们的版本应该跟 kube-apiserver 一致，不过也支持相差一个次版本号同时运行。比如：
* `kube-apiserver` 版本为 **1.13**
* 相应的 `kube-controller-manager`, `kube-scheduler`, 和 `cloud-controller-manager`  版本为 **1.13** and **1.12**
  再比如，一个高可用的集群中：
* `kube-apiserver`  版本为 **1.13** and **1.12**
* 相应的 `kube-controller-manager`, `kube-scheduler`, 和  `cloud-controller-manager` 版本为 **1.12** ( **1.13** 不支持，因为它比 apiserver 的**1.12** 高)
### kubectl
kubectl 可以跟 kube-apiserver 相差一个次版本号，比如：
* `kube-apiserver` 版本为 **1.13**
* 相应的  `kubectl` 版本为 **1.14**, **1.13** 和 **1.12**
## 版本升级顺序
当从 1.n 版本升级到 1.(n+1) 版本时，必须要遵循以下的升级顺序。
### kube-apiserver
前提条件：
* 单节点集群中， kube-apiserver 的版本为 1.n；HA 集群中，kube-apiserver 版本为 1.n 或者 1.(n+1)。
* `kube-controller-manager`, `kube-scheduler` 以及 `cloud-controller-manager` 的版本都是 1.n。
* kubelet 的版本是 1.n 或者 1.(n-1)
* 已注册的注入控制 webhook 可以处理新版本的请求，比如 ValidatingWebhookConfiguration 和 MutatingWebhookConfiguration 已经更新为支持 1.(n+1) 版本中新引入的特性。

接下来就可以把 kube-apiserver 升级到 1.(n+1)了，不过要注意**版本升级时不可跳过次版本号**。

### kube-controller-manager, kube-scheduler, and cloud-controller-manager
前提条件：
- kube-apiserver 已经升级到 1.(n+1) 版本。

接下来就可以把  `kube-controller-manager`, `kube-scheduler` 和  `cloud-controller-manager` 都升级到 **1.(n+1)** 版本了。

### kubelet

前提条件：
- kube-apiserver 已经升级到 1.(n+1) 版本。
- 升级过程中需要保证 kubelet 跟 kube-apiserver 最多只相差一个次版本号。

接下来就可以把 kubelet 升级到 1.(n+1)了。

## 参考文档
* [Kubernetes Version and Version Skew Support Policy - Kubernetes](https://kubernetes.io/docs/setup/version-skew-policy/)