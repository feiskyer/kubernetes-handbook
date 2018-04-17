# Kubernetes Ingress Let's Encrypt

## 申请域名

在使用 Let's Encrypt 之前需要申请一个域名，比如可以到 GoDaddy、Name 等网站购买。具体步骤这里不再细说，可以参考网络教程操作。

## 部署 Nginx Ingress Controller

直接使用 Helm 部署即可：

```sh
helm install stable/nginx-ingress --name nginx-ingress --set rbac.create=true
```

部署成功后，查询 Ingress 服务的公网 IP 地址（下文中假设该 IP 是 `6.6.6.6`）：

```sh
$ kubectl get service nginx-ingress-controller
NAME                       TYPE           CLUSTER-IP     EXTERNAL-IP     PORT(S)                      AGE
nginx-ingress-controller   LoadBalancer   10.0.216.124   6.6.6.6         80:31935/TCP,443:31797/TCP   4d
```

然后到域名注册服务商网站中，创建 A 记录，将需要的域名解析到 `6.6.6.6`。

## 开启  Let's Encrypt

```sh
git clone https://github.com/jetstack/kube-lego
cd kube-lego
kubectl apply -f examples/nginx/lego/
```

注意：kube-lego 已经不再更新，其功能正在迁移到 [cert-manager](https://github.com/jetstack/cert-manager/)。

## 创建 Ingress 资源

首先，创建一个 Secret，用于登录认证：

```sh
$ htpasswd -c auth foo
$ kubectl -n kube-system create secret generic basic-auth --from-file=auth
```

然后创建 Ingress（以 Kubernetes Dashboard 服务为例并假设域名为 `dashboard.example.com`）：

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  annotations:
    kubernetes.io/ingress.class: nginx
    kubernetes.io/tls-acme: "true"
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/auth-type: basic
    nginx.ingress.kubernetes.io/auth-secret: basic-auth
    nginx.ingress.kubernetes.io/auth-realm: "Authentication Required"
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
          servicePort: 80
```
