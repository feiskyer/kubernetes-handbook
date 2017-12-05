# Kubernetes The Hard Way

本部分翻译自 [kubernetes-the-hard-way](https://github.com/kelseyhightower/kubernetes-the-hard-way)，译者 [@kweisamx](https://github.com/kweisamx)。

如有翻译不好的地方或文字上的错误, 都欢迎提出 issue 或是 PR。

繁中版: [Kubernetes-The-Hard-Way-ZH-tw](https://github.com/kweisamx/Kubernetes-The-Hard-Way-ZH-tw)

---

这份教学将带领你走上安装kubernetes的艰辛之路。这份文件不适用于想要一键自动化部属kubernetes丛集的人。如果你想要轻松部属, 可以参考[Google Container Engine](https://cloud.google.com/container-engine) 或[Getting Started Guides](http://kubernetes.io/docs/getting-started-guides/)

Kubernetes The Hard Way 是个学习的最佳方式, 会花上许多时间确保你真正了解每项组件的任务以及需求,去搭建整个kubernetes 丛集
> 这份文件不应该出现在production 文件中, 也无获得kubernetes社区的许多支持, 但这都不影响你想真正了解Kubernetes的决心！

---

## 谁适合看这份文件？

这份文件的目标是给那些计画要使用kubernetes 当作production环境的人, 并想了解每个有关kubernetes的环节以及他们如何运作的

## 有关丛集的详细资讯

Kubernetes The Hard Way 将引导你建立高可用的Kubernetes的丛集, 包括每个组件之间的加密以及RBAC认证

* [Kubernetes](https://github.com/kubernetes/kubernetes) 1.8.0
* [cri-containerd Container Runtime](https://github.com/kubernetes-incubator/cri-containerd) 1.0.0-alpha.0
* [CNI Container Networking](https://github.com/containernetworking/cni) 0.6.0
* [etcd](https://github.com/coreos/etcd) 3.2.8

## 实验步骤

这份教学假设你已经有办法登入[Google Cloud Platform](https://cloud.google.com), GCP被用来作为这篇教学的基础需求,你也可以将这篇教学应用在其他平台上

* [事前準备](kubernetes-the-hard-way/01-prerequisites.md)
* [安装 Client 工具](kubernetes-the-hard-way/02-client-tools.md)
* [準备计算资源](kubernetes-the-hard-way/03-compute-resources.md)
* [提供 CA 和产生 TLS 凭证](kubernetes-the-hard-way/04-certificate-authority.md)
* [建立认证用Kubernetes 设定档](kubernetes-the-hard-way/05-kubernetes-configuration-files.md)
* [建立资料加密设定档与密钥](kubernetes-the-hard-way/06-data-encryption-keys.md)
* [启动etcd 群集](kubernetes-the-hard-way/07-bootstrapping-etcd.md)
* [启动 Kubernetes 控制平台](kubernetes-the-hard-way/08-bootstrapping-kubernetes-controllers.md)
* [启动 Kubernetes Worker 节点](kubernetes-the-hard-way/09-bootstrapping-kubernetes-workers.md)
* [远端请求Kubectl相关设定](kubernetes-the-hard-way/10-configuring-kubectl.md)
* [提供Pod网路路由](kubernetes-the-hard-way/11-pod-network-routes.md)
* [部属DNS群集插件](kubernetes-the-hard-way/12-dns-addon.md)
* [烟雾测试](kubernetes-the-hard-way/13-smoke-test.md)
* [删除集群](kubernetes-the-hard-way/14-cleanup.md)
