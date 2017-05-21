# 容器运行时

容器运行时（Container Runtime）是Kubernetes最重要的组件之一，负责真正管理镜像和容器的生命周期。Kubelet通过[Container Runtime Interface (CRI)](../plugins/CRI.md)与容器运行时交互，以管理镜像和容器。

## CRI

Container Runtime Interface (CRI)是Kubelet 1.5/1.6中主要负责的一块项目，它重新定义了Kubelet Container Runtime API，将原来完全面向Pod级别的API拆分成面向Sandbox和Container的API，并分离镜像管理和容器引擎到不同的服务。

![](images/cri.png)

## Docker

Docker runtime的核心代码在kubelet内部，是最稳定和特性支持最好的Runtime。

开源电子书[《Docker从入门到实践》](https://yeasy.gitbooks.io/docker_practice/)是docker入门和实践不错的参考。

## Hyper

[Hyper](http://hypercontainer.io)是一个基于Hypervisor的容器运行时，为Kubernetes带来了强隔离，适用于多租户和运行不可信容器的场景。

Hyper在Kubernetes的集成项目为frakti，<https://github.com/kubernetes/frakti>，目前已支持Kubernetes v1.6+。

## Rkt

rkt是另一个集成在kubelet内部的容器运行时，但也正在迁往CRI的路上，<https://github.com/kubernetes-incubator/rktlet>。

## Runc

Runc有两个实现，cri-o和cri-containerd

- [cri-containerd](https://github.com/kubernetes-incubator/cri-containerd)，还在开发中
- [cri-o](https://github.com/kubernetes-incubator/cri-o)，已支持Kubernetes v1.6
