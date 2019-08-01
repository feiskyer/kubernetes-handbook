# Aggregation Layer

API Aggregation 允許在不修改 Kubernetes 核心代碼的同時擴展 Kubernetes API，即將第三方服務註冊到 Kubernetes API 中，這樣就可以通過 Kubernetes API 來訪問外部服務。

> 備註：另外一種擴展 Kubernetes API 的方法是使用 [CustomResourceDefinition (CRD)](../concepts/customresourcedefinition.md)。

## 何時使用 Aggregation

| 滿足以下條件時使用 API Aggregation                           | 滿足以下條件時使用獨立 API                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| Your API is [Declarative](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/#declarative-apis). | Your API does not fit the [Declarative](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/#declarative-apis) model. |
| You want your new types to be readable and writable using `kubectl`. | `kubectl` support is not required                            |
| You want to view your new types in a Kubernetes UI, such as dashboard, alongside built-in types. | Kubernetes UI support is not required.                       |
| You are developing a new API.                                | You already have a program that serves your API and works well. |
| You are willing to accept the format restriction that Kubernetes puts on REST resource paths, such as API Groups and Namespaces. (See the [API Overview](https://kubernetes.io/docs/concepts/overview/kubernetes-api/).) | You need to have specific REST paths to be compatible with an already defined REST API. |
| Your resources are naturally scoped to a cluster or to namespaces of a cluster. | Cluster or namespace scoped resources are a poor fit; you need control over the specifics of resource paths. |
| You want to reuse [Kubernetes API support features](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/#common-features). | You don’t need those features.                               |

## 開啟 API Aggregation

kube-apiserver 增加以下配置

```sh
--requestheader-client-ca-file=<path to aggregator CA cert>
--requestheader-allowed-names=aggregator
--requestheader-extra-headers-prefix=X-Remote-Extra-
--requestheader-group-headers=X-Remote-Group
--requestheader-username-headers=X-Remote-User
--proxy-client-cert-file=<path to aggregator proxy cert>
--proxy-client-key-file=<path to aggregator proxy key>
```

如果 `kube-proxy` 沒有在 Master 上面運行，還需要配置

```sh
--enable-aggregator-routing=true
```

## 創建擴展 API

1. 確保開啟 APIService API（默認開啟，可用 `kubectl get apiservice` 命令驗證）
2. 創建 RBAC 規則
3. 創建一個 namespace，用來運行擴展的 API 服務
4. 創建 CA 和證書，用於 https
5. 創建一個存儲證書的 secret
6. 創建一個部署擴展 API 服務的 deployment，並使用上一步的 secret 配置證書，開啟 https 服務
7. 創建一個 ClusterRole 和 ClusterRoleBinding
8. 創建一個非 namespace 的 apiservice，注意設置 `spec.caBundle`
9. 運行 `kubectl get <resource-name>`，正常應該返回 `No resources found.`

可以使用 [apiserver-builder](https://github.com/kubernetes-incubator/apiserver-builder) 工具自動化上面的步驟。

```sh
# 初始化項目
$ cd GOPATH/src/github.com/my-org/my-project
$ apiserver-boot init repo --domain <your-domain>
$ apiserver-boot init glide

# 創建資源
$ apiserver-boot create group version resource --group <group> --version <version> --kind <Kind>

# 編譯
$ apiserver-boot build executables
$ apiserver-boot build docs

# 本地運行
$ apiserver-boot run local

# 集群運行
$ apiserver-boot run in-cluster --name nameofservicetorun --namespace default --image gcr.io/myrepo/myimage:mytag
$ kubectl create -f sample/<type>.yaml
```

## 示例

見 [sample-apiserver](https://github.com/kubernetes/sample-apiserver) 和 [apiserver-builder/example](https://github.com/kubernetes-incubator/apiserver-builder/tree/master/example)。
