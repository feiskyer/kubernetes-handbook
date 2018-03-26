# 容器运行时

容器运行时（Container Runtime）是 Kubernetes 最重要的组件之一，负责真正管理镜像和容器的生命周期。Kubelet 通过 [Container Runtime Interface (CRI)](../plugins/CRI.md) 与容器运行时交互，以管理镜像和容器。

## CRI

Container Runtime Interface (CRI) 是 Kubelet 中负责容器运行的接口，它重新定义了 Kubelet Container Runtime API，将原来完全面向 Pod 级别的 API 拆分成面向 Sandbox 和 Container 的 API，并分离镜像管理和容器引擎到不同的服务。

![](images/cri.png)

## Docker

Docker runtime 的核心代码在 kubelet 内部（`pkg/kubelet/dockershim`），是最稳定和特性支持最全的 Runtime。

开源电子书 [《Docker 从入门到实践》](https://yeasy.gitbooks.io/docker_practice/) 是 docker 入门和实践不错的参考。

## Runc

Runc 有两个实现，cri-o 和 cri-containerd

- [cri-containerd](https://github.com/kubernetes-incubator/cri-containerd)，已支持 Kubernetes v1.7 及以上版本
- [cri-o](https://github.com/kubernetes-incubator/cri-o)，已支持 Kubernetes v1.6 及以上版本

## Hyper

[Hyper](http://hypercontainer.io) 是一个基于 Hypervisor 的容器运行时，为 Kubernetes 带来了强隔离，适用于多租户和运行不可信容器的场景。

Hyper 在 Kubernetes 的集成项目为 frakti，<https://github.com/kubernetes/frakti>，目前已支持 Kubernetes v1.6 及以上版本。

## Rkt

rkt 是另一个集成在 kubelet 内部的容器运行时，但也正在迁往 CRI 的路上，<https://github.com/kubernetes-incubator/rktlet>。
