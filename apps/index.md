# Kubernetes 服務治理

本章介紹 Kubernetes 服務治理，包括容器應用管理、Service Mesh 以及 Operator 等。

目前最常用的是手動管理 Manifests，比如 kubernetes github 代碼庫就提供了很多的 manifest 示例

- https://github.com/kubernetes/kubernetes/tree/master/cluster/addons
- https://github.com/kubernetes/examples
- https://github.com/kubernetes/contrib
- https://github.com/kubernetes/ingress-nginx

手動管理的一個問題就是繁瑣，特別是應用複雜並且 Manifest 比較多的時候，還需要考慮他們之間部署關係。Kubernetes 開源社區正在推動更易用的管理方法，如

- [一般準則](patterns.md)
- [滾動升級](service-rolling-update.md)
- [Helm](helm.md)
- [Operator](operator.md)
- [Service Mesh](service-mesh.md)
- [Linkerd](linkerd.md)
- [Istio](istio.md)
  - [安裝](istio-deploy.md)
  - [流量管理](istio-traffic-management.md)
  - [安全管理](istio-security.md)
  - [策略管理](istio-policy.md)
  - [Metrics](istio-metrics.md)
  - [排錯](istio-troubleshoot.md)
  - [社區](istio-community.md)
- [Devops](devops.md)
  - [Draft](draft.md)
  - [Jenkins X](jenkinsx.md)
  - [Spinnaker](spinnaker.md)
  - [Kompose](kompose.md)
  - [Skaffold](skaffold.md)
  - [Argo](argo.md)
  - [Flux GitOps](flux.md)
