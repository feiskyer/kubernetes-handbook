# Kubernetes 部署指南

本章介绍创建的 Kubernetes 集群部署方法、 kubectl 客户端的安装方法以及推荐的配置。

其中 [Kubernetes-The-Hard-Way](kubernetes-the-hard-way/index.md) 介绍了在 GCE 的 Ubuntu 虚拟机中一步步部署一套 Kubernetes 高可用集群的详细步骤，这些步骤也同样适用于 CentOS 等其他系统以及 AWS、Azure 等其他公有云平台。

在国内部署集群时，通常还会碰到镜像无法拉取或者拉取过慢的问题。对这类问题的解决方法就是使用国内的镜像，具体可以参考[国内镜像列表](../appendix/mirrors.md)。

一般部署完成后，还需要运行一系列的测试来验证部署是成功的。[sonobuoy](https://github.com/heptio/sonobuoy) 可以简化这个验证的过程，它通过一系列的测试来验证集群的功能是否正常。其使用方法为

- 通过 [Sonobuoy Scanner tool](https://scanner.heptio.com/) 在线使用（需要集群公网可访问）
- 或者使用命令行工具

```sh
# Install
$ go get -u -v github.com/heptio/sonobuoy

# Run
$ sonobuoy run
$ sonobuoy status
$ sonobuoy logs
$ sonobuoy retrieve .

# Cleanup
$ sonobuoy delete
```

## 版本依赖

| 依赖组件           | v1.13                                              | v1.12                                              |
| ------------------ | -------------------------------------------------- | -------------------------------------------------- |
| Etcd               | v3.2.24+或v3.3.0+                                  | v3.2.24+ 或 v3.3.0+ etcd2弃用                      |
| Docker             | 1.11.1, 1.12.1, 1.13.1, 17.03, 17.06, 17.09, 18.06 | 1.11.1, 1.12.1, 1.13.1, 17.03, 17.06, 17.09, 18.06 |
| Go                 | 1.11.2                                             | 1.10.4                                             |
| CNI                | v0.6.0                                             | v0.6.0                                             |
| CSI                | 1.0.0                                              | 0.3.0                                              |
| Dashboard          | v1.10.0                                            | v1.8.3                                             |
| Heapster           | Remains v1.6.0-beta but retired                    | v1.6.0-beta                                        |
| Cluster Autoscaler | v1.13.0                                            | v1.12.0                                            |
| kube-dns           | v1.14.13                                           | v1.14.13                                           |
| Influxdb           | v1.3.3                                             | v1.3.3                                             |
| Grafana            | v4.4.3                                             | v4.4.3                                             |
| Kibana             | v6.3.2                                             | v6.3.2                                             |
| cAdvisor           | v0.32.0                                            | v0.30.1                                            |
| Fluentd            | v1.2.4                                             | v1.2.4                                             |
| Elasticsearch      | v6.3.2                                             | v6.3.2                                             |
| go-oidc            | v2.0.0                                             | v2.0.0                                             |
| calico             | v3.3.1                                             | v2.6.7                                             |
| crictl             | v1.12.0                                            | v1.12.0                                            |
| CoreDNS            | v1.2.6                                             | v1.2.2                                             |
| event-exporter     | v0.2.3                                             | v0.2.3                                             |
| metrics-server     | v0.3.1                                             | v0.3.1                                             |
| ingress-gce        | v1.2.3                                             | v1.2.3                                             |
| ingress-nginx      | v0.21.0                                            | v0.21.0                                            |
| ip-masq-agent      | v2.1.1                                             | v2.1.1                                             |
| hcsshim            | v0.6.11                                            | v0.6.11                                            |

## 部署方法

- [1. 单机部署](single.md)
- [2. 集群部署](cluster.md)
  - [kubeadm](kubeadm.md)
  - [kops](kops.md)
  - [Kubespray](kubespray.md)
  - [Azure](azure.md)
  - [Windows](windows.md)
  - [LinuxKit](k8s-linuxkit.md)
  - [Frakti](frakti/index.md)
  - [kubeasz](https://github.com/gjmzj/kubeasz)
- [3. Kubernetes-The-Hard-Way](kubernetes-the-hard-way/index.md)
  - [准备部署环境](kubernetes-the-hard-way/01-prerequisites.md)
  - [安装必要工具](kubernetes-the-hard-way/02-client-tools.md)
  - [创建计算资源](kubernetes-the-hard-way/03-compute-resources.md)
  - [配置创建证书](kubernetes-the-hard-way/04-certificate-authority.md)
  - [配置生成配置](kubernetes-the-hard-way/05-kubernetes-configuration-files.md)
  - [配置生成密钥](kubernetes-the-hard-way/06-data-encryption-keys.md)
  - [部署Etcd群集](kubernetes-the-hard-way/07-bootstrapping-etcd.md)
  - [部署控制节点](kubernetes-the-hard-way/08-bootstrapping-kubernetes-controllers.md)
  - [部署计算节点](kubernetes-the-hard-way/09-bootstrapping-kubernetes-workers.md)
  - [配置Kubectl](kubernetes-the-hard-way/10-configuring-kubectl.md)
  - [配置网络路由](kubernetes-the-hard-way/11-pod-network-routes.md)
  - [部署DNS扩展](kubernetes-the-hard-way/12-dns-addon.md)
  - [烟雾测试](kubernetes-the-hard-way/13-smoke-test.md)
  - [删除集群](kubernetes-the-hard-way/14-cleanup.md)
- [4. kubectl客户端](kubectl.md)
- [5. 附加组件](../addons/index.md)
  - [Addon-manager](../addons/addon-manager.md)
  - [DNS](../components/kube-dns.md)
  - [Dashboard](../addons/dashboard.md)
  - [监控](../addons/monitor.md)
  - [日志](../addons/logging.md)
  - [Metrics](../addons/metrics.md)
  - [GPU](../practice/gpu.md)
  - [Cluster Autoscaler](../addons/cluster-autoscaler.md)
  - [ip-masq-agent](../addons/ip-masq-agent.md)
  - [Heapster (retired)](https://github.com/kubernetes-retired/heapster)
- [6. 推荐配置](kubernetes-configuration-best-practice.md)
- [7. 版本支持](upgrade.md)
