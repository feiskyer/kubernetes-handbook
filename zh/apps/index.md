# Kubernetes 服务治理

本章介绍 Kubernetes 服务治理，包括容器应用管理、Service Mesh 以及 Operator 等。

目前最常用的是手动管理 Manifests，比如 kubernetes github 代码库就提供了很多的 manifest 示例

- https://github.com/kubernetes/kubernetes/tree/master/examples
- https://github.com/kubernetes/contrib
- https://github.com/kubernetes/ingress

手动管理的一个问题就是繁琐，特别是应用复杂并且 Manifest 比较多的时候，还需要考虑他们之间部署关系。Kubernetes 开源社区正在推动更易用的管理方法，如

- [一般准则](patterns.md)
- [滚动升级](service-rolling-update.md)
- [Helm](helm-app.md)
  - [Helm 参考](helm.md)
  - [Helm 原理](helm-basic.md)
- [Service Mesh](service-mesh.md)
  - [Istio](istio.md)
  - [Linkerd](linkerd.md)
- [Draft](draft.md)
- [Operator](operator.md)
- [Kompose](kompose.md)
- [CI/CD](cicd.md)
  - [Jenkins X](jenkinsx.md)
  - [Spinnaker](spinnaker.md)
