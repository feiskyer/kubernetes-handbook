# Kubernetes 服务治理

本章介绍 Kubernetes 服务治理，包括容器应用管理、Service Mesh 以及 Operator 等。

目前最常用的是手动管理 Manifests，比如 kubernetes github 代码库就提供了很多的 manifest 示例

- https://github.com/kubernetes/kubernetes/tree/master/examples
- https://github.com/kubernetes/contrib
- https://github.com/kubernetes/ingress

手动管理的一个问题就是繁琐，特别是应用复杂并且 Manifest 比较多的时候，还需要考虑他们之间部署关系。Kubernetes 开源社区正在推动更易用的管理方法，如

- [Helm](helm-app.md) 提供了一些常见应用的模版
- [operator](operator.md) 则提供了一种有状态应用的管理模式
- [Deis](deis.md) 在 Kubernetes 之上提供了一个 PaaS 平台
- [Draft](draft.md) 是微软 Deis 团队开源的容器应用开发辅助工具，可以帮助开发人员简化容器应用程序的开发流程
- [Kompose ](kompose.md)是一个将 docker-compose 配置转换成 Kubernetes manifests 的工具
