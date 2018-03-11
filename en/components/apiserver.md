# API Server

kube-apiserver是Kubernetes最重要的核心组件之一，主要提供以下的功能

- 提供集群管理的REST API接口，包括认证授权、数据校验以及集群状态变更等
- 提供其他模块之间的数据交互和通信的枢纽（其他模块通过API Server查询或修改数据，只有API Server才直接操作etcd）

## REST API

kube-apiserver支持同时提供https（默认监听在6443端口）和http API（默认监听在127.0.0.1的8080端口），其中http API是非安全接口，不做任何认证授权机制，不建议生产环境启用。两个接口提供的REST API格式相同，参考[Kubernetes API Reference](https://kubernetes.io/docs/api-reference/v1.8/)查看所有API的调用格式。

在实际使用中，通常通过[kubectl](https://kubernetes.io/docs/user-guide/kubectl-overview/)来访问apiserver，也可以通过Kubernetes各个语言的client库来访问apiserver。在使用kubectl时，打开调试日志也可以看到每个API调用的格式，比如

```sh
$ kubectl --v=8 get pods
```

## OpenAPI和Swagger

通过`/swaggerapi`可以查看Swagger API，`/swagger.json`查看OpenAPI。

开启`--enable-swagger-ui=true`后还可以通过`/swagger-ui`访问Swagger UI。

## 访问控制

Kubernetes API的每个请求都会经过多阶段的访问控制之后才会被接受，这包括认证、授权以及准入控制（Admission Control）等。

![](images/access_control.png)

### 认证

开启TLS时，所有的请求都需要首先认证。Kubernetes支持多种认证机制，并支持同时开启多个认证插件（只要有一个认证通过即可）。如果认证成功，则用户的`username`会传入授权模块做进一步授权验证；而对于认证失败的请求则返回HTTP 401。

> **[warning] Kubernetes不管理用户**
>
> 虽然Kubernetes认证和授权用到了username，但Kubernetes并不直接管理用户，不能创建`user`对象，也不存储username。

更多认证模块的使用方法可以参考[Kubernetes认证插件](../plugins/auth.md#认证)。

### 授权

认证之后的请求就到了授权模块。跟认证类似，Kubernetes也支持多种授权机制，并支持同时开启多个授权插件（只要有一个验证通过即可）。如果授权成功，则用户的请求会发送到准入控制模块做进一步的请求验证；而对于授权失败的请求则返回HTTP 403.

更多授权模块的使用方法可以参考[Kubernetes授权插件](../plugins/auth.md#授权)。

### 准入控制

准入控制（Admission Control）用来对请求做进一步的验证或添加默认参数。不同于授权和认证只关心请求的用户和操作，准入控制还处理请求的内容，并且仅对创建、更新、删除或连接（如代理）等有效，而对读操作无效。准入控制也支持同时开启多个插件，它们依次调用，只有全部插件都通过的请求才可以放过进入系统。

更多准入控制模块的使用方法可以参考[Kubernetes准入控制](../plugins/admission.md)。

## How it works

kube-apiserver提供了Kubernetes的REST API，实现了认证、授权、准入控制等安全校验功能，同时也负责集群状态的存储操作（通过etcd）。

![](images/kube-apiserver.png)

## 启动apiserver示例

```sh
kube-apiserver --feature-gates=AllAlpha=true --runtime-config=api/all=true \
    --requestheader-allowed-names=front-proxy-client \
    --client-ca-file=/etc/kubernetes/pki/ca.crt \
    --allow-privileged=true \
    --experimental-bootstrap-token-auth=true \
    --storage-backend=etcd3 \
    --requestheader-username-headers=X-Remote-User \
    --requestheader-extra-headers-prefix=X-Remote-Extra- \
    --service-account-key-file=/etc/kubernetes/pki/sa.pub \
    --tls-cert-file=/etc/kubernetes/pki/apiserver.crt \
    --tls-private-key-file=/etc/kubernetes/pki/apiserver.key \
    --kubelet-client-certificate=/etc/kubernetes/pki/apiserver-kubelet-client.crt \
    --requestheader-client-ca-file=/etc/kubernetes/pki/front-proxy-ca.crt \
    --insecure-port=8080 \
    --admission-control=NamespaceLifecycle,LimitRanger,ServiceAccount,PersistentVolumeLabel,DefaultStorageClass,ResourceQuota,DefaultTolerationSeconds \
    --requestheader-group-headers=X-Remote-Group \
    --kubelet-client-key=/etc/kubernetes/pki/apiserver-kubelet-client.key \
    --secure-port=6443 \
    --kubelet-preferred-address-types=InternalIP,ExternalIP,Hostname \
    --service-cluster-ip-range=10.96.0.0/12 \
    --authorization-mode=RBAC \
    --advertise-address=192.168.0.20 --etcd-servers=http://127.0.0.1:2379
```
