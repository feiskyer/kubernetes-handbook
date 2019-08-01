# Kubernetes 認證

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

## X509 證書

使用 X509 客戶端證書只需要 API Server 啟動時配置 `--client-ca-file=SOMEFILE`。在證書認證時，其 Common Name（CN）域用作用戶名，而 Organization（O）域則用作 group 名。

創建一個客戶端證書的方法為：

```sh
# Create private key
openssl genrsa -out username.key 2048
# Create CSR (certificate signing request)
openssl req -new -key username.key -out username.csr -subj "/CN=username/O=group"
# Create certificate from CSR using the cluster authority
openssl x509 -req -in username.csr -CA $CA_LOCATION/ca.crt -CAkey $CA_LOCATION/ca.key -CAcreateserial -out username.crt -days 500
```

接著，就可以使用 username.key 和 username.crt 來訪問集群：

```sh
# Config cluster
kubectl config set-cluster my-cluster --certificate-authority=ca.pem --embed-certs=true --server=https://<APISERVER_IP>:6443
# Config credentials
kubectl config set-credentials username --client-certificate=username.crt --client-key=username.key --embed-certs=true
# Config context
kubectl config set-context username --cluster=my-cluster --user=username
# Config RBAC if it's enabled
# Finally, switch to new context
kubectl config use-context username
```

## 靜態 Token 文件

使用靜態 Token 文件認證只需要 API Server 啟動時配置 `--token-auth-file=SOMEFILE`。該文件為 csv 格式，每行至少包括三列 `token,username,user id`，後面是可選的 group 名，比如

```
token,user,uid,"group1,group2,group3"
```

客戶端在使用 token 認證時，需要在請求頭中加入 Bearer Authorization 頭，比如

```
Authorization: Bearer 31ada4fd-adec-460c-809a-9e56ceb75269
```

## 引導 Token

引導 Token 是動態生成的，存儲在 kube-system namespace 的 Secret 中，用來部署新的 Kubernetes 集群。

使用引導 Token 需要 API Server 啟動時配置 `--experimental-bootstrap-token-auth`，並且 Controller Manager 開啟 TokenCleaner `--controllers=*,tokencleaner,bootstrapsigner`。

在使用 kubeadm 部署 Kubernetes 時，kubeadm 會自動創建默認 token，可通過 `kubeadm token list` 命令查詢。

## 靜態密碼文件

需要 API Server 啟動時配置 `--basic-auth-file=SOMEFILE`，文件格式為 csv，每行至少三列 `password, user, uid`，後面是可選的 group 名，如

```
password,user,uid,"group1,group2,group3"
```

客戶端在使用密碼認證時，需要在請求頭重加入 Basic Authorization 頭，如

```
Authorization: Basic BASE64ENCODED(USER:PASSWORD)
```

## Service Account

ServiceAccount 是 Kubernetes 自動生成的，並會自動掛載到容器的 `/var/run/secrets/kubernetes.io/serviceaccount` 目錄中。

在認證時，ServiceAccount 的用戶名格式為 `system:serviceaccount:(NAMESPACE):(SERVICEACCOUNT)`，並從屬於兩個 group：`system:serviceaccounts` 和 `system:serviceaccounts:(NAMESPACE)`。

## OpenID

OpenID 提供了 OAuth2 的認證機制，是很多雲服務商（如 GCE、Azure 等）的首選認證方法。

![](images/oidc.png)

使用 OpenID 認證，API Server 需要配置

- `--oidc-issuer-url`，如 `https://accounts.google.com`
- `--oidc-client-id`，如 `kubernetes`
- `--oidc-username-claim`，如 `sub`
- `--oidc-groups-claim`，如 `groups`
- `--oidc-ca-file`，如 `/etc/kubernetes/ssl/kc-ca.pem`

## Webhook

API Server 需要配置

```sh
# 配置如何訪問 webhook server
--authentication-token-webhook-config-file
# 默認 2 分鐘
--authentication-token-webhook-cache-ttl
```

配置文件格式為

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

Kubernetes 發給 webhook server 的請求格式為

```json
{
  "apiVersion": "authentication.k8s.io/v1beta1",
  "kind": "TokenReview",
  "spec": {
    "token": "(BEARERTOKEN)"
  }
}
```

示例：[kubernetes-github-authn](https://github.com/oursky/kubernetes-github-authn) 實現了一個基於 WebHook 的 github 認證。

## 認證代理

API Server 需要配置

```sh
--requestheader-username-headers=X-Remote-User
--requestheader-group-headers=X-Remote-Group
--requestheader-extra-headers-prefix=X-Remote-Extra-
# 為了防止頭部欺騙，證書是必選項
--requestheader-client-ca-file
# 設置允許的 CN 列表。可選。
--requestheader-allowed-names
```

## OpenStack Keystone 密碼

需要 API Server 在啟動時指定 `--experimental-keystone-url=<AuthURL>`，而 https 時還需要設置 `--experimental-keystone-ca-file=SOMEFILE`。

> **不支持 Keystone v3**
>
> 目前只支持 keystone v2.0，不支持 v3（無法傳入 domain）。

## 匿名請求

如果使用 AlwaysAllow 以外的認證模式，則匿名請求默認開啟，但可用 `--anonymous-auth=false` 禁止匿名請求。

匿名請求的用戶名格式為 `system:anonymous`，而 group 則為 `system:unauthenticated`。

## Credential Plugin

從 v1.11 開始支持 Credential Plugin（Beta），通過調用外部插件來獲取用戶的訪問憑證。這是一種客戶端認證插件，用來支持不在 Kubernetes 中內置的認證協議，如 LDAP、OAuth2、SAML 等。它通常與 [Webhook](#webhook) 配合使用。

Credential Plugin 可以在 kubectl 的配置文件中設置，比如

```yaml
apiVersion: v1
kind: Config
users:
- name: my-user
  user:
    exec:
      # Command to execute. Required.
      command: "example-client-go-exec-plugin"

      # API version to use when decoding the ExecCredentials resource. Required.
      #
      # The API version returned by the plugin MUST match the version listed here.
      #
      # To integrate with tools that support multiple versions (such as client.authentication.k8s.io/v1alpha1),
      # set an environment variable or pass an argument to the tool that indicates which version the exec plugin expects.
      apiVersion: "client.authentication.k8s.io/v1beta1"

      # Environment variables to set when executing the plugin. Optional.
      env:
      - name: "FOO"
        value: "bar"

      # Arguments to pass when executing the plugin. Optional.
      args:
      - "arg1"
      - "arg2"
clusters:
- name: my-cluster
  cluster:
    server: "https://172.17.4.100:6443"
    certificate-authority: "/etc/kubernetes/ca.pem"
contexts:
- name: my-cluster
  context:
    cluster: my-cluster
    user: my-user
current-context: my-cluster
```

具體的插件開發及使用方法請參考 [kubernetes/client-go](https://github.com/kubernetes/client-go/tree/master/plugin/pkg/client/auth)。

## 開源工具

如下的開源工具可以幫你簡化認證和授權的配置：

- [Keycloak](https://www.keycloak.org/)
- [coreos/dex](https://github.com/coreos/dex)
- [heptio/authenticator](https://github.com/heptio/authenticator)
- [hashicorp/vault-plugin-auth-kubernetes](https://github.com/hashicorp/vault-plugin-auth-kubernetes)
- [appscode/guard](https://github.com/appscode/guard)
- [cyberark/conjur](https://github.com/cyberark/conjur)
- [liggitt/audit2rbac](https://github.com/liggitt/audit2rbac)
- [reactiveops/rbac-manager](https://github.com/reactiveops/rbac-manager)
- [jtblin/kube2iam](https://github.com/jtblin/kube2iam)

## 參考資料

- <https://kubernetes-security.info>
- [Protect Kubernetes External Endpoints with OAuth2 Proxy](https://akomljen.com/protect-kubernetes-external-endpoints-with-oauth2-proxy/) by Alen Komljen
- [Single Sign-On for Internal Apps in Kubernetes using Google Oauth / SSO](https://medium.com/@while1eq1/single-sign-on-for-internal-apps-in-kubernetes-using-google-oauth-sso-2386a34bc433) by William Broach
- [Single Sign-On for Kubernetes: An Introduction](https://thenewstack.io/kubernetes-single-sign-one-less-identity/) by Joel Speed
- [Let’s Encrypt, OAuth 2, and Kubernetes Ingress](https://eng.fromatob.com/post/2017/02/lets-encrypt-oauth-2-and-kubernetes-ingress/) by Ian Chiles
- [Comparing Kubernetes Authentication Methods](https://medium.com/@etienne_24233/comparing-kubernetes-authentication-methods-6f538d834ca7) by Etienne Dilocker
- [K8s auth proxy example](http://uptoknow.blogspot.com/2017/06/kubernetes-authentication-proxy-example.html)
- [K8s authentication with Conjur](https://blog.conjur.org/kubernetes-authentication)
- [Effective RBAC](https://www.youtube.com/watch?v=Nw1ymxcLIDI) by Jordan Liggitt
- [Configure RBAC In Your Kubernetes Cluster](https://docs.bitnami.com/kubernetes/how-to/configure-rbac-in-your-kubernetes-cluster/) via Bitnami
- [Using RBAC, Generally Available in Kubernetes v1.8](https://kubernetes.io/blog/2017/10/using-rbac-generally-available-18/) by Eric Chiang
