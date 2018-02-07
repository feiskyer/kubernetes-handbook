# API Aggregation

API Aggregation允许在不修改Kubernetes核心代码的同时扩展Kubernetes API。

## 开启API Aggregation

kube-apiserver增加以下配置

```sh
--requestheader-client-ca-file=<path to aggregator CA cert>
--requestheader-allowed-names=aggregator
--requestheader-extra-headers-prefix=X-Remote-Extra-
--requestheader-group-headers=X-Remote-Group
--requestheader-username-headers=X-Remote-User
--proxy-client-cert-file=<path to aggregator proxy cert>
--proxy-client-key-file=<path to aggregator proxy key>
```

如果`kube-proxy`没有在Master上面运行，还需要配置

```sh
--enable-aggregator-routing=true
```

## 创建扩展API

1. 确保开启APIService API（默认开启，可用`kubectl get apiservice`命令验证）
2. 创建RBAC规则
3. 创建一个namespace，用来运行扩展的API服务
4. 创建CA和证书，用于https
5. 创建一个存储证书的secret
6. 创建一个部署扩展API服务的deployment，并使用上一步的secret配置证书，开启https服务
7. 创建一个ClusterRole和ClusterRoleBinding
8. 创建一个非namespace的apiservice，注意设置`spec.caBundle`
9. 运行`kubectl get <resource-name>`，正常应该返回`No resources found.`

可以使用[apiserver-builder](https://github.com/kubernetes-incubator/apiserver-builder)工具自动化上面的步骤。

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

见[sample-apiserver](https://github.com/kubernetes/sample-apiserver)和[apiserver-builder/example](https://github.com/kubernetes-incubator/apiserver-builder/tree/master/example)。
