# 訪問控制

Kubernetes 對 API 訪問提供了三種安全訪問控制措施：認證、授權和 Admission Control。認證解決用戶是誰的問題，授權解決用戶能做什麼的問題，Admission Control 則是資源管理方面的作用。通過合理的權限管理，能夠保證系統的安全可靠。

Kubernetes 集群的所有操作基本上都是通過 kube-apiserver 這個組件進行的，它提供 HTTP RESTful 形式的 API 供集群內外客戶端調用。需要注意的是：認證授權過程只存在 HTTPS 形式的 API 中。也就是說，如果客戶端使用 HTTP 連接到 kube-apiserver，那麼是不會進行認證授權的。所以說，可以這麼設置，在集群內部組件間通信使用 HTTP，集群外部就使用 HTTPS，這樣既增加了安全性，也不至於太複雜。

下圖是 API 訪問要經過的三個步驟，前面兩個是認證和授權，第三個是 Admission Control。

![](images/authentication.png)

## 認證

開啟 TLS 時，所有的請求都需要首先認證。Kubernetes 支持多種認證機制，並支持同時開啟多個認證插件（只要有一個認證通過即可）。如果認證成功，則用戶的 `username` 會傳入授權模塊做進一步授權驗證；而對於認證失敗的請求則返回 HTTP 401。

> **Kubernetes 不直接管理用戶**
>
> 雖然 Kubernetes 認證和授權用到了 user 和 group，但 Kubernetes 並不直接管理用戶，不能創建 `user` 對象，也不存儲 user。

目前，Kubernetes 支持以下認證插件：

- X509 證書
- 靜態 Token 文件
- 引導 Token
- 靜態密碼文件
- Service Account
- OpenID
- Webhook
- 認證代理
- OpenStack Keystone 密碼

詳細使用方法請參考[這裡](authentication.md)

## 授權

授權主要是用於對集群資源的訪問控制，通過檢查請求包含的相關屬性值，與相對應的訪問策略相比較，API 請求必須滿足某些策略才能被處理。跟認證類似，Kubernetes 也支持多種授權機制，並支持同時開啟多個授權插件（只要有一個驗證通過即可）。如果授權成功，則用戶的請求會發送到准入控制模塊做進一步的請求驗證；對於授權失敗的請求則返回 HTTP 403。

Kubernetes 授權僅處理以下的請求屬性：

- user, group, extra
- API、請求方法（如 get、post、update、patch 和 delete）和請求路徑（如 `/api`）
- 請求資源和子資源
- Namespace
- API Group

目前，Kubernetes 支持以下授權插件：

- ABAC
- RBAC
- Webhook
- Node

> **AlwaysDeny 和 AlwaysAllow**
>
> Kubernetes 還支持 AlwaysDeny 和 AlwaysAllow 模式，其中 AlwaysDeny 僅用來測試，而 AlwaysAllow 則
> 允許所有請求（會覆蓋其他模式）。

### ABAC 授權

使用 ABAC 授權需要 API Server 配置 `--authorization-policy-file=SOME_FILENAME`，文件格式為每行一個 json 對象，比如

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

### RBAC 授權

見 [RBAC 授權](rbac.md)。

### WebHook 授權

使用 WebHook 授權需要 API Server 配置 `--authorization-webhook-config-file=SOME_FILENAME` 和 `--runtime-config=authorization.k8s.io/v1beta1=true`，配置文件格式同 kubeconfig，如

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

API Server 請求 Webhook server 的格式為

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

而 Webhook server 需要返回授權的結果，允許 (allowed=true) 或拒絕(allowed=false)：

```json
{
  "apiVersion": "authorization.k8s.io/v1beta1",
  "kind": "SubjectAccessReview",
  "status": {
    "allowed": true
  }
}
```

### Node 授權

v1.7 + 支持 Node 授權，配合 `NodeRestriction` 准入控制來限制 kubelet 僅可訪問 node、endpoint、pod、service 以及 secret、configmap、PV 和 PVC 等相關的資源，配置方法為

`--authorization-mode=Node,RBAC --admission-control=...,NodeRestriction,...`

注意，kubelet 認證需要使用 `system:nodes` 組，並使用用戶名 `system:node:<nodeName>`。

## 參考文檔

- [Authenticating](https://kubernetes.io/docs/admin/authentication/)
- [Authorization](https://kubernetes.io/docs/admin/authorization/)
- [Bootstrap Tokens](https://kubernetes.io/docs/admin/bootstrap-tokens/)
- [Managing Service Accounts](https://kubernetes.io/docs/admin/service-accounts-admin/)
- [ABAC Mode](https://kubernetes.io/docs/admin/authorization/abac/)
- [Webhook Mode](https://kubernetes.io/docs/admin/authorization/webhook/)
- [Node Authorization](https://kubernetes.io/docs/admin/authorization/node/)
