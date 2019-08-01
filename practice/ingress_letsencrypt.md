# Kubernetes Ingress Let's Encrypt

## 申請域名

在使用 Let's Encrypt 之前需要申請一個域名，比如可以到 GoDaddy、Name 等網站購買。具體步驟這裡不再細說，可以參考網絡教程操作。

## 部署 Nginx Ingress Controller

直接使用 Helm 部署即可：

```sh
helm install stable/nginx-ingress --name nginx-ingress --set rbac.create=true --namespace=kube-system
```

部署成功後，查詢 Ingress 服務的公網 IP 地址（下文中假設該 IP 是 `6.6.6.6`）：

```sh
$ kubectl -n kube-system get service nginx-ingress-controller
NAME                       TYPE           CLUSTER-IP     EXTERNAL-IP     PORT(S)                      AGE
nginx-ingress-controller   LoadBalancer   10.0.216.124   6.6.6.6         80:31935/TCP,443:31797/TCP   4d
```

然後到域名註冊服務商網站中，創建 A 記錄，將需要的域名解析到 `6.6.6.6`。

## 開啟  Let's Encrypt

```sh
# Install cert-manager
helm install --namespace=kube-system --name cert-manager stable/cert-manager --set ingressShim.defaultIssuerName=letsencrypt --set ingressShim.defaultIssuerKind=ClusterIssuer

# create cluster issuer
kubectl apply -f https://raw.githubusercontent.com/feiskyer/kubernetes-handbook/master/manifests/ingress-nginx/cert-manager/cluster-issuer.yaml
```

## 創建 Ingress

首先，創建一個 Secret，用於登錄認證：

```sh
$ htpasswd -c auth foo
$ kubectl -n kube-system create secret generic basic-auth --from-file=auth
```

### HTTP Ingress 示例

為 nginx 服務（端口 80）創建 TLS Ingress，並且自動將 `http://echo-tls.example.com` 重定向到 `https://echo-tls.example.com`：

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

為 Kubernetes Dashboard 服務（端口443）創建 TLS Ingress，並且禁止該域名的 HTTP 訪問：

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

## 參考文檔

- [Nginx Ingress Controller Documentation](https://kubernetes.github.io/ingress-nginx/)
