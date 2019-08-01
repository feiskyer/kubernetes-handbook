# Ingress Controller 擴展

[Ingress](../concepts/ingress.md) 為 Kubernetes 集群中的服務提供了外部入口以及路由，而 Ingress Controller 監測 Ingress 和 Service 資源的變更並根據規則配置負載均衡、路由規則和 DNS 等並提供訪問入口。

## 如何開發 Ingress Controller 擴展

[NGINX Ingress Controller](https://github.com/kubernetes/ingress-nginx) 和 [GLBC](https://github.com/kubernetes/ingress-gce) 提供了兩個 Ingress Controller 的完整示例，可以在此基礎上方便的開發新的 Ingress Controller。

## 常見 Ingress Controller

* [Nginx Ingress](https://github.com/kubernetes/ingress-nginx)

```sh
helm install stable/nginx-ingress --name nginx-ingress --set rbac.create=true
```

* [HAProxy Ingress controller](https://github.com/jcmoraisjr/haproxy-ingress)

* [Linkerd](https://linkerd.io/config/0.9.1/linkerd/index.html#ingress-identifier)

* [traefik](https://docs.traefik.io/configuration/backends/kubernetes/)

* [AWS Application Load Balancer Ingress Controller](https://github.com/coreos/alb-ingress-controller)

* [kube-ingress-aws-controller](https://github.com/zalando-incubator/kube-ingress-aws-controller)

* [Voyager: HAProxy Ingress Controller](https://github.com/appscode/voyager)

## Ingress 使用方法

具體 Ingress 的使用方法可以參考 [這裡](../concepts/ingress.md)。
