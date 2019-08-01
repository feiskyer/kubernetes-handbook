# Kubernetes 部署指南

本章介紹創建的 Kubernetes 集群部署方法、 kubectl 客戶端的安裝方法以及推薦的配置。

其中 [Kubernetes-The-Hard-Way](kubernetes-the-hard-way/index.md) 介紹了在 GCE 的 Ubuntu 虛擬機中一步步部署一套 Kubernetes 高可用集群的詳細步驟，這些步驟也同樣適用於 CentOS 等其他系統以及 AWS、Azure 等其他公有云平臺。

在國內部署集群時，通常還會碰到鏡像無法拉取或者拉取過慢的問題。對這類問題的解決方法就是使用國內的鏡像，具體可以參考[國內鏡像列表](../appendix/mirrors.md)。

一般部署完成後，還需要運行一系列的測試來驗證部署是成功的。[sonobuoy](https://github.com/heptio/sonobuoy) 可以簡化這個驗證的過程，它通過一系列的測試來驗證集群的功能是否正常。其使用方法為

- 通過 [Sonobuoy Scanner tool](https://scanner.heptio.com/) 在線使用（需要集群公網可訪問）
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

## 版本依賴

| 依賴組件           | v1.13                                              | v1.12                                              |
| ------------------ | -------------------------------------------------- | -------------------------------------------------- |
| Etcd               | v3.2.24+或v3.3.0+                                  | v3.2.24+ 或 v3.3.0+ etcd2棄用                      |
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

- [1. 單機部署](single.md)
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
  - [準備部署環境](kubernetes-the-hard-way/01-prerequisites.md)
  - [安裝必要工具](kubernetes-the-hard-way/02-client-tools.md)
  - [創建計算資源](kubernetes-the-hard-way/03-compute-resources.md)
  - [配置創建證書](kubernetes-the-hard-way/04-certificate-authority.md)
  - [配置生成配置](kubernetes-the-hard-way/05-kubernetes-configuration-files.md)
  - [配置生成密鑰](kubernetes-the-hard-way/06-data-encryption-keys.md)
  - [部署Etcd群集](kubernetes-the-hard-way/07-bootstrapping-etcd.md)
  - [部署控制節點](kubernetes-the-hard-way/08-bootstrapping-kubernetes-controllers.md)
  - [部署計算節點](kubernetes-the-hard-way/09-bootstrapping-kubernetes-workers.md)
  - [配置Kubectl](kubernetes-the-hard-way/10-configuring-kubectl.md)
  - [配置網絡路由](kubernetes-the-hard-way/11-pod-network-routes.md)
  - [部署DNS擴展](kubernetes-the-hard-way/12-dns-addon.md)
  - [煙霧測試](kubernetes-the-hard-way/13-smoke-test.md)
  - [刪除集群](kubernetes-the-hard-way/14-cleanup.md)
- [4. kubectl客戶端](kubectl.md)
- [5. 附加組件](../addons/index.md)
  - [Addon-manager](../addons/addon-manager.md)
  - [DNS](../components/kube-dns.md)
  - [Dashboard](../addons/dashboard.md)
  - [監控](../addons/monitor.md)
  - [日誌](../addons/logging.md)
  - [Metrics](../addons/metrics.md)
  - [GPU](../practice/gpu.md)
  - [Cluster Autoscaler](../addons/cluster-autoscaler.md)
  - [ip-masq-agent](../addons/ip-masq-agent.md)
  - [Heapster (retired)](https://github.com/kubernetes-retired/heapster)
- [6. 推薦配置](kubernetes-configuration-best-practice.md)
- [7. 版本支持](upgrade.md)
