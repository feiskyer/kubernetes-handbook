# Ingress Controller扩展

[Ingress](../concepts/ingress.md) 为Kubernetes集群中的服务提供了外部入口以及路由，而Ingress Controller监测Ingress和Service资源的变更并根据规则配置负载均衡、路由规则和DNS等并提供访问入口。

## 如何开发Ingress Controller扩展

[NGINX Ingress Controller](https://github.com/kubernetes/ingress-nginx)和[GLBC](https://github.com/kubernetes/ingress-gce)提供了两个Ingress Controller的完整示例，可以在此基础上方便的开发新的Ingress Controller。

## 常见Ingress Controller

* [Ingress Examples](https://github.com/kubernetes/ingress-nginx)
* [Dummy controller backend](https://github.com/kubernetes/ingress/tree/master/examples/custom-controller)
* [HAProxy Ingress controller](https://github.com/jcmoraisjr/haproxy-ingress)
* [Linkerd](https://linkerd.io/config/0.9.1/linkerd/index.html#ingress-identifier)
* [traefik](https://docs.traefik.io/toml/#kubernetes-ingress-backend)
* [AWS Application Load Balancer Ingress Controller](https://github.com/coreos/alb-ingress-controller)
* [kube-ingress-aws-controller](https://github.com/zalando-incubator/kube-ingress-aws-controller)
* [Voyager: HAProxy Ingress Controller](https://github.com/appscode/voyager)

## Ingress使用方法

具体Ingress的使用方法可以参考[这里](../concepts/ingress.md)。
