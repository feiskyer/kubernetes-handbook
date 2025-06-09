# Ingress Controller 和 Gateway API 控制器

[Ingress](../../concepts/objects/ingress.md) 为 Kubernetes 集群中的服务提供了外部入口以及路由，而 Ingress Controller 监测 Ingress 和 Service 资源的变更并根据规则配置负载均衡、路由规则和 DNS 等并提供访问入口。

随着 [Gateway API](https://gateway-api.sigs.k8s.io/) 的发展，新一代的 Gateway 控制器提供了更强大和更灵活的流量管理能力，是 Ingress 的演进版本。

## 如何开发 Ingress Controller 扩展

[NGINX Ingress Controller](https://github.com/kubernetes/ingress-nginx) 和 [GLBC](https://github.com/kubernetes/ingress-gce) 提供了两个 Ingress Controller 的完整示例，可以在此基础上方便的开发新的 Ingress Controller。

## Gateway API 控制器（推荐）

Gateway API v1.3.0 于 2025年4月发布，目前已有多个符合标准的 Gateway API 控制器实现：

### 符合标准的 Gateway API 控制器

* **[Envoy Gateway](https://gateway.envoyproxy.io/)**：基于 Envoy 代理的 Gateway API 实现
* **[Istio Gateway](https://istio.io/latest/docs/concepts/traffic-management/#gateways)**：Istio 服务网格的 Gateway API 支持
* **[Cilium Gateway](https://docs.cilium.io/en/latest/network/servicemesh/gateway-api/)**：基于 eBPF 的网络和安全解决方案
* **[Airlock Gateway](https://docs.airlock.com/gateway/)**：企业级安全网关解决方案

### Gateway API v1.3.0 新特性

* **基于百分比的请求镜像**：支持蓝绿部署和性能测试
* **CORS 过滤**：跨域资源共享配置
* **重试预算**：可配置的客户端重试策略
* **XListenerSets**：跨命名空间的监听器配置委托

## 传统 Ingress Controller

* [Nginx Ingress](https://github.com/kubernetes/ingress-nginx)

```bash
helm install stable/nginx-ingress --name nginx-ingress --set rbac.create=true
```

* [HAProxy Ingress controller](https://github.com/jcmoraisjr/haproxy-ingress)
* [Linkerd](https://linkerd.io/config/0.9.1/linkerd/index.html#ingress-identifier)
* [traefik](https://doc.traefik.io/traefik/providers/kubernetes-ingress/)（同时支持 Gateway API）
* [AWS Application Load Balancer Ingress Controller](https://github.com/coreos/alb-ingress-controller)
* [kube-ingress-aws-controller](https://github.com/zalando-incubator/kube-ingress-aws-controller)
* [Voyager: HAProxy Ingress Controller](https://github.com/appscode/voyager)

## Ingress 使用方法

具体 Ingress 的使用方法可以参考 [这里](../../concepts/objects/ingress.md)。
