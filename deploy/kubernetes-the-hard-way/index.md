# Kubernetes The Hard Way

翻譯註：本部分翻譯自 [Kubernetes The Hard Way](https://github.com/kelseyhightower/kubernetes-the-hard-way)，譯者 [@kweisamx](https://github.com/kweisamx) 和 [@feiskyer](https://github.com/feiskyer)。該教程指引用戶在 [Google Cloud Platform](https://cloud.google.com) 上面一步步搭建一個高可用的 Kubernetes 集群。

如果你正在使用 [Microsoft Azure](https://azure.microsoft.com)，那麼請參考 [kubernetes-the-hard-way-on-azure](https://github.com/ivanfioravanti/kubernetes-the-hard-way-on-azure) 在 Azure 上面搭建 Kubernetes 集群。

如有翻譯不好的地方或文字上的錯誤, 歡迎提出 [Issue](https://github.com/feiskyer/kubernetes-handbook) 或是 [PR](https://github.com/feiskyer/kubernetes-handbook)。

---

本教程將帶領你一步步配置和部署一套高可用的 Kubernetes 集群。它不適用於想要一鍵自動化部署 Kubernetes 集群的人。如果你想要一鍵自動化部署，請參考 [Google Container Engine](https://cloud.google.com/container-engine) 或 [Getting Started Guides](https://kubernetes.io/docs/setup/)。

Kubernetes The Hard Way 的主要目的是學習, 也就是說它會花很多時間來保障讀者可以真正理解搭建 Kubernetes 的每個步驟。

> 使用該教程部署的集群不應該直接視為生產環境可用，並且也可能無法獲得 Kubernetes 社區的許多支持，但這都不影響你想真正瞭解 Kubernetes 的決心！

---

## 目標讀者

該教程的目標是給那些計劃要將 Kubernetes 應用到生產環境的人, 並想了解每個有關 Kubernetes 的環節以及他們如何運作的。

## 集群版本

Kubernetes The Hard Way 將引導你建立高可用的 Kubernetes 集群, 包括每個組件之間的加密以及 RBAC 認證

* [Kubernetes](https://github.com/kubernetes/kubernetes) 1.12.0
* [Containerd Container Runtime](https://github.com/containerd/containerd) 1.2.0-rc0
* [CNI Container Networking](https://github.com/containernetworking/cni) 0.6.0
* [gVisor](https://github.com/google/gvisor) 50c283b9f56bb7200938d9e207355f05f79f0d17
* [etcd](https://github.com/coreos/etcd) 3.3.9
* [CoreDNS](https://github.com/coredns/coredns) v1.2.2

## 實驗步驟

這份教程假設你已經創建並配置好了 [Google Cloud Platform](https://cloud.google.com) 賬戶。該教程只是將 GCP 作為最基礎的架構，教程的內容也同樣適用於其他的平臺。

* [準備部署環境](01-prerequisites.md)
* [安裝必要工具](02-client-tools.md)
* [創建計算資源](03-compute-resources.md)
* [配置創建證書](04-certificate-authority.md)
* [配置生成配置](05-kubernetes-configuration-files.md)
* [配置生成密鑰](06-data-encryption-keys.md)
* [部署Etcd群集](07-bootstrapping-etcd.md)
* [部署控制節點](08-bootstrapping-kubernetes-controllers.md)
* [部署計算節點](09-bootstrapping-kubernetes-workers.md)
* [配置Kubectl](10-configuring-kubectl.md)
* [配置網絡路由](11-pod-network-routes.md)
* [部署DNS擴展](12-dns-addon.md)
* [煙霧測試](13-smoke-test.md)
* [刪除集群](14-cleanup.md)
