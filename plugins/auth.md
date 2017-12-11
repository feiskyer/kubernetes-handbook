# 访问控制

Kubernetes 对 API 访问提供了三种安全访问控制措施：认证、授权和 Admission Control。认证解决用户是谁的问题，授权解决用户能做什么的问题，Admission Control则是资源管理方面的作用。通过合理的权限管理，能够保证系统的安全可靠。

Kubernetes集群的所有操作基本上都是通过kube-apiserver这个组件进行的，它提供HTTP RESTful形式的API供集群内外客户端调用。需要注意的是：认证授权过程只存在HTTPS形式的API中。也就是说，如果客户端使用HTTP连接到kube-apiserver，那么是不会进行认证授权的。所以说，可以这么设置，在集群内部组件间通信使用HTTP，集群外部就使用HTTPS，这样既增加了安全性，也不至于太复杂。

下图是 API 访问要经过的三个步骤，前面两个是认证和授权，第三个是 Admission Control。

![](images/authentication.png)

## 认证

开启TLS时，所有的请求都需要首先认证。Kubernetes支持多种认证机制，并支持同时开启多个认证插件（只要有一个认证通过即可）。如果认证成功，则用户的`username`会传入授权模块做进一步授权验证；而对于认证失败的请求则返回HTTP 401。

> **[warning] Kubernetes不管理用户**
>
> 虽然Kubernetes认证和授权用到了username，但Kubernetes并不直接管理用户，不能创建`user`对象，
> 也不存储username。但是Kubernetes提供了Service Account，用来与API交互。

目前，Kubernetes支持以下认证插件：

- X509证书
- 静态Token文件
- 引导Token
- 静态密码文件
- Service Account
- OpenID
- Webhook
- 认证代理
- OpenStack Keystone密码

### X509证书

使用X509客户端证书只需要API Server启动时配置`--client-ca-file=SOMEFILE`。在证书认证时，其CN域用作用户名，而组织机构域则用作group名。

创建一个客户端证书的方法为：

```sh
openssl req -new -key jbeda.pem -out jbeda-csr.pem -subj "/CN=jbeda/O=app1/O=app2"
```

### 静态Token文件

使用静态Token文件认证只需要API Server启动时配置`--token-auth-file=SOMEFILE`。该文件为csv格式，每行至少包括三列`token,username,user id`，后面是可选的group名，比如

```
token,user,uid,"group1,group2,group3"
```

客户端在使用token认证时，需要在请求头中加入Bearer Authorization头，比如

```
Authorization: Bearer 31ada4fd-adec-460c-809a-9e56ceb75269
```

### 引导Token

引导Token是动态生成的，存储在kube-system namespace的Secret中，用来部署新的Kubernetes集群。

使用引导Token需要API Server启动时配置`--experimental-bootstrap-token-auth`，并且Controller Manager开启TokenCleaner `--controllers=*,tokencleaner,bootstrapsigner`。

在使用kubeadm部署Kubernetes时，kubeadm会自动创建默认token，可通过`kubeadm token list`命令查询。

### 静态密码文件

需要API Server启动时配置`--basic-auth-file=SOMEFILE`，文件格式为csv，每行至少三列`password, user, uid`，后面是可选的group名，如

```
password,user,uid,"group1,group2,group3"
```

客户端在使用密码认证时，需要在请求头重加入Basic Authorization头，如

```
Authorization: Basic BASE64ENCODED(USER:PASSWORD)
```

### Service Account

ServiceAccount是Kubernetes自动生成的，并会自动挂载到容器的`/var/run/secrets/kubernetes.io/serviceaccount`目录中。

在认证时，ServiceAccount的用户名格式为`system:serviceaccount:(NAMESPACE):(SERVICEACCOUNT)`，并从属于两个group：`system:serviceaccounts`和`system:serviceaccounts:(NAMESPACE)`。

### OpenID

OpenID提供了OAuth2的认证机制，是很多云服务商（如GCE、Azure等）的首选认证方法。

![](images/oidc.png)

使用OpenID认证，API Server需要配置

- `--oidc-issuer-url`，如`https://accounts.google.com`
- `--oidc-client-id`，如`kubernetes`
- `--oidc-username-claim`，如`sub`
- `--oidc-groups-claim`，如`groups`
- `--oidc-ca-file`，如`/etc/kubernetes/ssl/kc-ca.pem`

### Webhook

API Server需要配置

```sh
# 配置如何访问webhook server
--authentication-token-webhook-config-file
# 默认2分钟
--authentication-token-webhook-cache-ttl
```

配置文件格式为

```yaml
# clusters refers to the remote service.
clusters:
  - name: name-of-remote-authn-service
    cluster:
      # CA for verifying the remote service.
      certificate-authority: /path/to/ca.pem  
      # URL of remote service to query. Must use 'https'.
      server: https://authn.example.com/authenticate 
      
# users refers to the API server's webhook configuration.
users:
  - name: name-of-api-server
    user:
      # cert for the webhook plugin to use
      client-certificate: /path/to/cert.pem 
       # key matching the cert
      client-key: /path/to/key.pem         

# kubeconfig files require a context. Provide one for the API server.
current-context: webhook
contexts:
- context:
    cluster: name-of-remote-authn-service
    user: name-of-api-sever
  name: webhook
```

Kubernetes发给webhook server的请求格式为

```json
{
  "apiVersion": "authentication.k8s.io/v1beta1",
  "kind": "TokenReview",
  "spec": {
    "token": "(BEARERTOKEN)"
  }
}
```

示例：[kubernetes-github-authn](https://github.com/oursky/kubernetes-github-authn)实现了一个基于WebHook的github认证。

### 认证代理

API Server需要配置

```sh
--requestheader-username-headers=X-Remote-User
--requestheader-group-headers=X-Remote-Group
--requestheader-extra-headers-prefix=X-Remote-Extra-
# 为了防止头部欺骗，证书是必选项
--requestheader-client-ca-file
# 设置允许的CN列表。可选。
--requestheader-allowed-names
```

### OpenStack Keystone密码

需要API Server在启动时指定`--experimental-keystone-url=<AuthURL>`，而https时还需要设置`--experimental-keystone-ca-file=SOMEFILE`。

> **[warning] 不支持Keystone v3**
>
> 目前只支持keystone v2.0，不支持v3（无法传入domain）。

### 匿名请求

如果使用AlwaysAllow以外的认证模式，则匿名请求默认开启，但可用`--anonymous-auth=false`禁止匿名请求。

匿名请求的用户名格式为`system:anonymous`，而group则为`system:unauthenticated`。

## 授权

授权主要是用于对集群资源的访问控制，通过检查请求包含的相关属性值，与相对应的访问策略相比较，API请求必须满足某些策略才能被处理。跟认证类似，Kubernetes也支持多种授权机制，并支持同时开启多个授权插件（只要有一个验证通过即可）。如果授权成功，则用户的请求会发送到准入控制模块做进一步的请求验证；对于授权失败的请求则返回HTTP 403。

Kubernetes授权仅处理以下的请求属性：

- user, group, extra
- API、请求方法（如get、post、update、patch和delete）和请求路径（如`/api`）
- 请求资源和子资源
- Namespace
- API Group

目前，Kubernetes支持以下授权插件：

- ABAC
- RBAC
- Webhook
- Node

> **[info] AlwaysDeny和AlwaysAllow**
>
> Kubernetes还支持AlwaysDeny和AlwaysAllow模式，其中AlwaysDeny仅用来测试，而AlwaysAllow则
> 允许所有请求（会覆盖其他模式）。

### ABAC授权

使用ABAC授权需要API Server配置`--authorization-policy-file=SOME_FILENAME`，文件格式为每行一个json对象，比如

```json
{
    "apiVersion": "abac.authorization.kubernetes.io/v1beta1",
    "kind": "Policy",
    "spec": {
        "group": "system:authenticated",
        "nonResourcePath": "*",
        "readonly": true
    }
}
{
    "apiVersion": "abac.authorization.kubernetes.io/v1beta1",
    "kind": "Policy",
    "spec": {
        "group": "system:unauthenticated",
        "nonResourcePath": "*",
        "readonly": true
    }
}
{
    "apiVersion": "abac.authorization.kubernetes.io/v1beta1",
    "kind": "Policy",
    "spec": {
        "user": "admin",
        "namespace": "*",
        "resource": "*",
        "apiGroup": "*"
    }
}
```

### RBAC授权

见[RBAC授权](rbac.md)。

### WebHook授权

使用WebHook授权需要API Server配置`--authorization-webhook-config-file=SOME_FILENAME`和`--runtime-config=authorization.k8s.io/v1beta1=true`，配置文件格式同kubeconfig，如

```yaml
# clusters refers to the remote service.
clusters:
  - name: name-of-remote-authz-service
    cluster:
      # CA for verifying the remote service.
      certificate-authority: /path/to/ca.pem  
      # URL of remote service to query. Must use 'https'.
      server: https://authz.example.com/authorize 
      
# users refers to the API Server's webhook configuration.
users:
  - name: name-of-api-server
    user:
      # cert for the webhook plugin to use
      client-certificate: /path/to/cert.pem 
       # key matching the cert
      client-key: /path/to/key.pem         

# kubeconfig files require a context. Provide one for the API Server.
current-context: webhook
contexts:
- context:
    cluster: name-of-remote-authz-service
    user: name-of-api-server
  name: webhook
```

API Server请求Webhook server的格式为

```json
{
  "apiVersion": "authorization.k8s.io/v1beta1",
  "kind": "SubjectAccessReview",
  "spec": {
    "resourceAttributes": {
      "namespace": "kittensandponies",
      "verb": "get",
      "group": "unicorn.example.org",
      "resource": "pods"
    },
    "user": "jane",
    "group": [
      "group1",
      "group2"
    ]
  }
}
```

而Webhook server需要返回授权的结果，允许(allowed=true)或拒绝(allowed=false)：

```json
{
  "apiVersion": "authorization.k8s.io/v1beta1",
  "kind": "SubjectAccessReview",
  "status": {
    "allowed": true
  }
}
```

### Node授权

v1.7+支持Node授权，配合`NodeRestriction`准入控制来限制kubelet仅可访问node、endpoint、pod、service以及secret、configmap、PV和PVC等相关的资源，配置方法为

`--authorization-mode=Node,RBAC --admission-control=...,NodeRestriction,...`

注意，kubelet认证需要使用`system:nodes`组，并使用用户名`system:node:<nodeName>`。


## 参考文档

- [Authenticating](https://kubernetes.io/docs/admin/authentication/)
- [Authorization](https://kubernetes.io/docs/admin/authorization/)
- [Bootstrap Tokens](https://kubernetes.io/docs/admin/bootstrap-tokens/)
- [Managing Service Accounts](https://kubernetes.io/docs/admin/service-accounts-admin/)
- [ABAC Mode](https://kubernetes.io/docs/admin/authorization/abac/)
- [Webhook Mode](https://kubernetes.io/docs/admin/authorization/webhook/)
- [Node Authorization](https://kubernetes.io/docs/admin/authorization/node/)
