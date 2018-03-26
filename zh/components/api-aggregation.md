# API Aggregation

API Aggregation 允许在不修改 Kubernetes 核心代码的同时扩展 Kubernetes API。

## 开启 API Aggregation

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

如果 `kube-proxy` 没有在 Master 上面运行，还需要配置

```sh
--enable-aggregator-routing=true
```

## 创建扩展 API

1. 确保开启 APIService API（默认开启，可用 `kubectl get apiservice` 命令验证）
2. 创建 RBAC 规则
3. 创建一个 namespace，用来运行扩展的 API 服务
4. 创建 CA 和证书，用于 https
5. 创建一个存储证书的 secret
6. 创建一个部署扩展 API 服务的 deployment，并使用上一步的 secret 配置证书，开启 https 服务
7. 创建一个 ClusterRole 和 ClusterRoleBinding
8. 创建一个非 namespace 的 apiservice，注意设置 `spec.caBundle`
9. 运行 `kubectl get <resource-name>`，正常应该返回 `No resources found.`

可以使用 [apiserver-builder](https://github.com/kubernetes-incubator/apiserver-builder) 工具自动化上面的步骤。

```sh
# 初始化项目
$ cd GOPATH/src/github.com/my-org/my-project
$ apiserver-boot init repo --domain <your-domain>
$ apiserver-boot init glide

# 创建资源
$ apiserver-boot create group version resource --group <group> --version <version> --kind <Kind>

# 编译
$ apiserver-boot build executables
$ apiserver-boot build docs

# 本地运行
$ apiserver-boot run local

# 集群运行
$ apiserver-boot run in-cluster --name nameofservicetorun --namespace default --image gcr.io/myrepo/myimage:mytag
$ kubectl create -f sample/<type>.yaml
```

## 示例

见 [sample-apiserver](https://github.com/kubernetes/sample-apiserver) 和[apiserver-builder/example](https://github.com/kubernetes-incubator/apiserver-builder/tree/master/example)。

## 备注

另外一种扩展 Kubernetes API 的方法是使用 [CustomResourceDefinition (CRD)](../concepts/customresourcedefinition.md)。
