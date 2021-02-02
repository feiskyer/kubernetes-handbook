# 服务治理

本章介绍 Kubernetes 服务治理，包括容器应用管理、Service Mesh 以及 Operator 等。

目前最常用的是手动管理 Manifests，比如 kubernetes github 代码库就提供了很多的 manifest 示例

* [https://github.com/kubernetes/kubernetes/tree/master/cluster/addons](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons)
* [https://github.com/kubernetes/examples](https://github.com/kubernetes/examples)
* [https://github.com/kubernetes/contrib](https://github.com/kubernetes/contrib)
* [https://github.com/kubernetes/ingress-nginx](https://github.com/kubernetes/ingress-nginx)

手动管理的一个问题就是繁琐，特别是应用复杂并且 Manifest 比较多的时候，还需要考虑他们之间部署关系。Kubernetes 开源社区正在推动更易用的管理方法，如

* [一般准则](patterns.md)
* [滚动升级](service-rolling-update.md)
* [Helm](helm.md)
* [Operator](operator.md)
* [Service Mesh](service-mesh.md)
* [Linkerd](linkerd.md)
* [Istio](../istio/)
  * [安装](../istio/istio-deploy.md)
  * [流量管理](../istio/istio-traffic-management.md)
  * [安全管理](../istio/istio-security.md)
  * [策略管理](../istio/istio-policy.md)
  * [Metrics](../istio/istio-metrics.md)
  * [排错](../istio/istio-troubleshoot.md)
  * [社区](../istio/istio-community.md)
* [Devops](../devops/)
  * [Draft](../devops/draft.md)
  * [Jenkins X](../devops/jenkinsx.md)
  * [Spinnaker](../devops/spinnaker.md)
  * [Kompose](../devops/kompose.md)
  * [Skaffold](../devops/skaffold.md)
  * [Argo](../devops/argo.md)
  * [Flux GitOps](../devops/flux.md)

