# Kubernetes 服务治理

本章介绍 Kubernetes 服务治理，包括容器应用管理、Service Mesh 以及 Operator 等。

目前最常用的是手动管理 Manifests，比如 kubernetes github 代码库就提供了很多的 manifest 示例

- https://github.com/kubernetes/kubernetes/tree/master/cluster/addons
- https://github.com/kubernetes/examples
- https://github.com/kubernetes/contrib
- https://github.com/kubernetes/ingress-nginx

手动管理的一个问题就是繁琐，特别是应用复杂并且 Manifest 比较多的时候，还需要考虑他们之间部署关系。Kubernetes 开源社区正在推动更易用的管理方法，如

- [一般准则](patterns.md)
- [滚动升级](service-rolling-update.md)
- [Helm](helm.md)
- [Operator](operator.md)
- [Service Mesh](service-mesh.md)
- [Linkerd](linkerd.md)
- [Istio](istio.md)
  - [安装](istio-deploy.md)
  - [流量管理](istio-traffic-management.md)
  - [安全管理](istio-security.md)
  - [策略管理](istio-policy.md)
  - [Metrics](istio-metrics.md)
  - [排错](istio-troubleshoot.md)
  - [社区](istio-community.md)
- [Devops](devops.md)
  - [Draft](draft.md)
  - [Jenkins X](jenkinsx.md)
  - [Spinnaker](spinnaker.md)
  - [Kompose](kompose.md)
  - [Skaffold](skaffold.md)
  - [Argo](argo.md)
  - [Flux GitOps](flux.md)
