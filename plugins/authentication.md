# Kubernetes 认证

开启 TLS 时，所有的请求都需要首先认证。Kubernetes 支持多种认证机制，并支持同时开启多个认证插件（只要有一个认证通过即可）。如果认证成功，则用户的 `username` 会传入授权模块做进一步授权验证；而对于认证失败的请求则返回 HTTP 401。

> **Kubernetes 不直接管理用户**
>
> 虽然 Kubernetes 认证和授权用到了 user 和 group，但 Kubernetes 并不直接管理用户，不能创建 `user` 对象，也不存储 user。

目前，Kubernetes 支持以下认证插件：

- X509 证书
- 静态 Token 文件
- 引导 Token
- 静态密码文件
- Service Account
- OpenID
- Webhook
- 认证代理
- OpenStack Keystone 密码

## X509 证书

使用 X509 客户端证书只需要 API Server 启动时配置 `--client-ca-file=SOMEFILE`。在证书认证时，其 Common Name（CN）域用作用户名，而 Organization（O）域则用作 group 名。

创建一个客户端证书的方法为：

```sh
# Create private key
openssl genrsa -out username.key 2048
# Create CSR (certificate signing request)
openssl req -new -key username.key -out username.csr -subj "/CN=username/O=group"
# Create certificate from CSR using the cluster authority
openssl x509 -req -in username.csr -CA $CA_LOCATION/ca.crt -CAkey $CA_LOCATION/ca.key -CAcreateserial -out username.crt -days 500
```

接着，就可以使用 username.key 和 username.crt 来访问集群：

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

## 静态 Token 文件

使用静态 Token 文件认证只需要 API Server 启动时配置 `--token-auth-file=SOMEFILE`。该文件为 csv 格式，每行至少包括三列 `token,username,user id`，后面是可选的 group 名，比如

```
token,user,uid,"group1,group2,group3"
```

客户端在使用 token 认证时，需要在请求头中加入 Bearer Authorization 头，比如

```
Authorization: Bearer 31ada4fd-adec-460c-809a-9e56ceb75269
```

## 引导 Token

引导 Token 是动态生成的，存储在 kube-system namespace 的 Secret 中，用来部署新的 Kubernetes 集群。

使用引导 Token 需要 API Server 启动时配置 `--experimental-bootstrap-token-auth`，并且 Controller Manager 开启 TokenCleaner `--controllers=*,tokencleaner,bootstrapsigner`。

在使用 kubeadm 部署 Kubernetes 时，kubeadm 会自动创建默认 token，可通过 `kubeadm token list` 命令查询。

## 静态密码文件

需要 API Server 启动时配置 `--basic-auth-file=SOMEFILE`，文件格式为 csv，每行至少三列 `password, user, uid`，后面是可选的 group 名，如

```
password,user,uid,"group1,group2,group3"
```

客户端在使用密码认证时，需要在请求头重加入 Basic Authorization 头，如

```
Authorization: Basic BASE64ENCODED(USER:PASSWORD)
```

## Service Account

ServiceAccount 是 Kubernetes 自动生成的，并会自动挂载到容器的 `/var/run/secrets/kubernetes.io/serviceaccount` 目录中。

在认证时，ServiceAccount 的用户名格式为 `system:serviceaccount:(NAMESPACE):(SERVICEACCOUNT)`，并从属于两个 group：`system:serviceaccounts` 和 `system:serviceaccounts:(NAMESPACE)`。

## OpenID

OpenID 提供了 OAuth2 的认证机制，是很多云服务商（如 GCE、Azure 等）的首选认证方法。

![](images/oidc.png)

使用 OpenID 认证，API Server 需要配置

- `--oidc-issuer-url`，如 `https://accounts.google.com`
- `--oidc-client-id`，如 `kubernetes`
- `--oidc-username-claim`，如 `sub`
- `--oidc-groups-claim`，如 `groups`
- `--oidc-ca-file`，如 `/etc/kubernetes/ssl/kc-ca.pem`

## Webhook

API Server 需要配置

```sh
# 配置如何访问 webhook server
--authentication-token-webhook-config-file
# 默认 2 分钟
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

Kubernetes 发给 webhook server 的请求格式为

```json
{
  "apiVersion": "authentication.k8s.io/v1beta1",
  "kind": "TokenReview",
  "spec": {
    "token": "(BEARERTOKEN)"
  }
}
```

示例：[kubernetes-github-authn](https://github.com/oursky/kubernetes-github-authn) 实现了一个基于 WebHook 的 github 认证。

## 认证代理

API Server 需要配置

```sh
--requestheader-username-headers=X-Remote-User
--requestheader-group-headers=X-Remote-Group
--requestheader-extra-headers-prefix=X-Remote-Extra-
# 为了防止头部欺骗，证书是必选项
--requestheader-client-ca-file
# 设置允许的 CN 列表。可选。
--requestheader-allowed-names
```

## OpenStack Keystone 密码

需要 API Server 在启动时指定 `--experimental-keystone-url=<AuthURL>`，而 https 时还需要设置 `--experimental-keystone-ca-file=SOMEFILE`。

> **不支持 Keystone v3**
>
> 目前只支持 keystone v2.0，不支持 v3（无法传入 domain）。

## 匿名请求

如果使用 AlwaysAllow 以外的认证模式，则匿名请求默认开启，但可用 `--anonymous-auth=false` 禁止匿名请求。

匿名请求的用户名格式为 `system:anonymous`，而 group 则为 `system:unauthenticated`。

## Credential Plugin

从 v1.11 开始支持 Credential Plugin（Beta），通过调用外部插件来获取用户的访问凭证。这是一种客户端认证插件，用来支持不在 Kubernetes 中内置的认证协议，如 LDAP、OAuth2、SAML 等。它通常与 [Webhook](#webhook) 配合使用。

Credential Plugin 可以在 kubectl 的配置文件中设置，比如

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

具体的插件开发及使用方法请参考 [kubernetes/client-go](https://github.com/kubernetes/client-go/tree/master/plugin/pkg/client/auth)。

## 开源工具

如下的开源工具可以帮你简化认证和授权的配置：

- [Keycloak](https://www.keycloak.org/)
- [coreos/dex](https://github.com/coreos/dex)
- [heptio/authenticator](https://github.com/heptio/authenticator)
- [hashicorp/vault-plugin-auth-kubernetes](https://github.com/hashicorp/vault-plugin-auth-kubernetes)
- [appscode/guard](https://github.com/appscode/guard)
- [cyberark/conjur](https://github.com/cyberark/conjur)
- [liggitt/audit2rbac](https://github.com/liggitt/audit2rbac)
- [reactiveops/rbac-manager](https://github.com/reactiveops/rbac-manager)
- [jtblin/kube2iam](https://github.com/jtblin/kube2iam)

## 参考资料

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
