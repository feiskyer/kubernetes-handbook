# Kubernetes Ingress Let's Encrypt

## 申请域名

在使用 Let's Encrypt 之前需要申请一个域名，比如可以到 GoDaddy、Name 等网站购买。具体步骤这里不再细说，可以参考网络教程操作。

## 部署 Nginx Ingress Controller

直接使用 Helm 部署即可：

```sh
helm install stable/nginx-ingress --name nginx-ingress --set rbac.create=true --namespace=kube-system
```

部署成功后，查询 Ingress 服务的公网 IP 地址（下文中假设该 IP 是 `6.6.6.6`）：

```sh
$ kubectl -n kube-system get service nginx-ingress-controller
NAME                       TYPE           CLUSTER-IP     EXTERNAL-IP     PORT(S)                      AGE
nginx-ingress-controller   LoadBalancer   10.0.216.124   6.6.6.6         80:31935/TCP,443:31797/TCP   4d
```

然后到域名注册服务商网站中，创建 A 记录，将需要的域名解析到 `6.6.6.6`。

## 开启  Let's Encrypt

```sh
# Install cert-manager
helm install --namespace=kube-system --name cert-manager stable/cert-manager --set ingressShim.defaultIssuerName=letsencrypt --set ingressShim.defaultIssuerKind=ClusterIssuer

# create cluster issuer
kubectl apply -f https://raw.githubusercontent.com/feiskyer/kubernetes-handbook/master/manifests/ingress-nginx/cert-manager/cluster-issuer.yaml
```

## 创建 Ingress

首先，创建一个 Secret，用于登录认证：

```sh
$ htpasswd -c auth foo
$ kubectl -n kube-system create secret generic basic-auth --from-file=auth
```

### HTTP Ingress 示例

为 nginx 服务（端口 80）创建 TLS Ingress，并且自动将 `http://echo-tls.example.com` 重定向到 `https://echo-tls.example.com`：

```sh
cat <<EOF | kubectl create -f-
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: web
  namespace: default
  annotations:
    kubernetes.io/tls-acme: "true"
    kubernetes.io/ingress.class: "nginx"
    ingress.kubernetes.io/ssl-redirect: "true"
    certmanager.k8s.io/cluster-issuer: letsencrypt
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  tls:
  - hosts:
    - echo-tls.example.com
    secretName: web-tls
  rules:
  - host: echo-tls.example.com
    http:
      paths:
      - path: /
        backend:
          serviceName: nginx
          servicePort: 80
EOF
```

### TLS Ingress

为 Kubernetes Dashboard 服务（端口443）创建 TLS Ingress，并且禁止该域名的 HTTP 访问：

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  annotations:
    kubernetes.io/ingress.class: nginx
    kubernetes.io/tls-acme: "true"
    kubernetes.io/ingress.allow-http: "false"
    nginx.ingress.kubernetes.io/auth-realm: Authentication Required
    nginx.ingress.kubernetes.io/auth-secret: basic-auth
    nginx.ingress.kubernetes.io/auth-type: basic
    nginx.ingress.kubernetes.io/secure-backends: "true"
    certmanager.k8s.io/cluster-issuer: letsencrypt
  name: dashboard
  namespace: kube-system
spec:
  tls:
  - hosts:
    - dashboard.example.com
    secretName: dashboard-ingress-tls
  rules:
  - host: dashboard.example.com
    http:
      paths:
      - path: /
        backend:
          serviceName: kubernetes-dashboard
          servicePort: 443
```

## 参考文档

- [Nginx Ingress Controller Documentation](https://kubernetes.github.io/ingress-nginx/)
