# Kubernetes The Hard Way

翻译注：本部分翻译自 [Kubernetes The Hard Way](https://github.com/kelseyhightower/kubernetes-the-hard-way)，译者 [@kweisamx](https://github.com/kweisamx) 和 [@feiskyer](https://github.com/feiskyer)。该教程指引用户在 [Google Cloud Platform](https://cloud.google.com) 上面一步步搭建一个高可用的 Kubernetes 集群。

如果你正在使用 [Microsoft Azure](https://azure.microsoft.com)，那么请参考 [kubernetes-the-hard-way-on-azure](https://github.com/ivanfioravanti/kubernetes-the-hard-way-on-azure) 在 Azure 上面搭建 Kubernetes 集群。

如有翻译不好的地方或文字上的错误, 欢迎提出 [Issue](https://github.com/feiskyer/kubernetes-handbook) 或是 [PR](https://github.com/feiskyer/kubernetes-handbook)。

---

本教程将带领你一步步配置和部署一套高可用的 Kubernetes 集群。它不适用于想要一键自动化部署 Kubernetes 集群的人。如果你想要一键自动化部署，请参考 [Google Container Engine](https://cloud.google.com/container-engine) 或 [Getting Started Guides](https://kubernetes.io/docs/setup/)。

Kubernetes The Hard Way 的主要目的是学习, 也就是说它会花很多时间来保障读者可以真正理解搭建 Kubernetes 的每个步骤。

> 使用该教程部署的集群不应该直接视为生产环境可用，并且也可能无法获得 Kubernetes 社区的许多支持，但这都不影响你想真正了解 Kubernetes 的决心！

---

## 目标读者

该教程的目标是给那些计划要将 Kubernetes 应用到生产环境的人, 并想了解每个有关 Kubernetes 的环节以及他们如何运作的。

## 集群版本

Kubernetes The Hard Way 将引导你建立高可用的 Kubernetes 集群, 包括每个组件之间的加密以及 RBAC 认证

* [Kubernetes](https://github.com/kubernetes/kubernetes) 1.12.0
* [Containerd Container Runtime](https://github.com/containerd/containerd) 1.2.0-rc0
* [CNI Container Networking](https://github.com/containernetworking/cni) 0.6.0
* [gVisor](https://github.com/google/gvisor) 50c283b9f56bb7200938d9e207355f05f79f0d17
* [etcd](https://github.com/coreos/etcd) 3.3.9
* [CoreDNS](https://github.com/coredns/coredns) v1.2.2

## 实验步骤

这份教程假设你已经创建并配置好了 [Google Cloud Platform](https://cloud.google.com) 账户。该教程只是将 GCP 作为最基础的架构，教程的内容也同样适用于其他的平台。

* [准备部署环境](01-prerequisites.md)
* [安装必要工具](02-client-tools.md)
* [创建计算资源](03-compute-resources.md)
* [配置创建证书](04-certificate-authority.md)
* [配置生成配置](05-kubernetes-configuration-files.md)
* [配置生成密钥](06-data-encryption-keys.md)
* [部署Etcd群集](07-bootstrapping-etcd.md)
* [部署控制节点](08-bootstrapping-kubernetes-controllers.md)
* [部署计算节点](09-bootstrapping-kubernetes-workers.md)
* [配置Kubectl](10-configuring-kubectl.md)
* [配置网络路由](11-pod-network-routes.md)
* [部署DNS扩展](12-dns-addon.md)
* [烟雾测试](13-smoke-test.md)
* [删除集群](14-cleanup.md)
