# Ingress Controller 扩展

[Ingress](../concepts/ingress.md) 为 Kubernetes 集群中的服务提供了外部入口以及路由，而 Ingress Controller 监测 Ingress 和 Service 资源的变更并根据规则配置负载均衡、路由规则和 DNS 等并提供访问入口。

## 如何开发 Ingress Controller 扩展

[NGINX Ingress Controller](https://github.com/kubernetes/ingress-nginx) 和 [GLBC](https://github.com/kubernetes/ingress-gce) 提供了两个 Ingress Controller 的完整示例，可以在此基础上方便的开发新的 Ingress Controller。

## 常见 Ingress Controller

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

具体 Ingress 的使用方法可以参考 [这里](../concepts/ingress.md)。
