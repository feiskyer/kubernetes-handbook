# Kubernetes 大規模集群

Kubernetes v1.6-v1.11 單集群最大支持 5000 個節點，也就是說 Kubernetes 最新穩定版的單個集群支持

* 不超過 5000 個節點
* 不超過 150000 個 Pod
* 不超過 300000 個容器
* 每臺 Node 上不超過 100 個 Pod

## 公有云配額

對於公有云上的 Kubernetes 集群，規模大了之後很容器碰到配額問題，需要提前在雲平臺上增大配額。這些需要增大的配額包括

* 虛擬機個數
* vCPU 個數
* 內網 IP 地址個數
* 公網 IP 地址個數
* 安全組條數
* 路由表條數
* 持久化存儲大小

### Etcd 存儲

除了常規的 [Etcd 高可用集群](https://coreos.com/etcd/docs/3.2.15/op-guide/clustering.html)配置、使用 SSD 存儲等，還需要為 Events 配置單獨的 Etcd 集群。即部署兩套獨立的 Etcd 集群，並配置 kube-apiserver

```sh
--etcd-servers="http://etcd1:2379,http://etcd2:2379,http://etcd3:2379" --etcd-servers-overrides="/events#http://etcd4:2379,http://etcd5:2379,http://etcd6:2379"
```

另外，Etcd 默認存儲限制為 2GB，可以通過 `--quota-backend-bytes` 選項增大。

## Master 節點大小

可以參考 AWS 配置 Master 節點的大小：

* 1-5 nodes: m3.medium
* 6-10 nodes: m3.large
* 11-100 nodes: m3.xlarge
* 101-250 nodes: m3.2xlarge
* 251-500 nodes: c4.4xlarge
* more than 500 nodes: c4.8xlarge

## 為擴展分配更多資源

Kubernetes 集群內的擴展也需要分配更多的資源，包括為這些 Pod 分配更大的 CPU 和內存以及增大容器副本數量等。當 Node 本身的容量太小時，還需要增大 Node 本身的 CPU 和內存（特別是在公有云平臺上）。

以下擴展服務需要增大 CPU 和內存：

* [DNS (kube-dns or CoreDNS)](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/dns)
* [InfluxDB and Grafana](http://releases.k8s.io/master/cluster/addons/cluster-monitoring/influxdb/influxdb-grafana-controller.yaml)
* [Kibana](http://releases.k8s.io/master/cluster/addons/fluentd-elasticsearch/kibana-deployment.yaml)
* [FluentD with ElasticSearch Plugin](http://releases.k8s.io/master/cluster/addons/fluentd-elasticsearch/fluentd-es-ds.yaml)
* [FluentD with GCP Plugin](http://releases.k8s.io/master/cluster/addons/fluentd-gcp/fluentd-gcp-ds.yaml)

以下擴展服務需要增大副本數：

* [elasticsearch](http://releases.k8s.io/master/cluster/addons/fluentd-elasticsearch/es-statefulset.yaml)
* [DNS (kube-dns or CoreDNS)](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/dns)

另外，為了保證多個副本分散調度到不同的 Node 上，需要為容器配置 [AntiAffinity](https://kubernetes.io/docs/concepts/configuration/assign-pod-node/#affinity-and-anti-affinity)。比如，對 kube-dns，可以增加如下的配置：

```yaml
affinity:
 podAntiAffinity:
   requiredDuringSchedulingIgnoredDuringExecution:
   - weight: 100
     labelSelector:
       matchExpressions:
       - key: k8s-app
         operator: In
         values:
         - kube-dns
     topologyKey: kubernetes.io/hostname
```

## Kube-apiserver 配置

* 設置 `--max-requests-inflight=3000`
* 設置 `--max-mutating-requests-inflight=1000`

## Kube-scheduler 配置

* 設置 `--kube-api-qps=100`

## Kube-controller-manager 配置

* 設置 `--kube-api-qps=100`
* 設置 `--kube-api-burst=100`

## Kubelet 配置

* 設置 `--image-pull-progress-deadline=30m`
* 設置 `--serialize-image-pulls=false`（需要 Docker 使用 overlay2 ）
* Kubelet 單節點允許運行的最大 Pod 數：`--max-pods=110`（默認是 110，可以根據實際需要設置）

## Docker 配置

* 設置 `max-concurrent-downloads=10`
* 使用 SSD 存儲 `graph=/ssd-storage-path`
* 預加載 pause 鏡像，比如 `docker image save -o /opt/preloaded_docker_images.tar` 和 `docker image load -i /opt/preloaded_docker_images.tar`

## 節點配置

增大內核選項配置 `/etc/sysctl.conf`：

```sh
fs.file-max=1000000

net.ipv4.ip_forward=1
net.netfilter.nf_conntrack_max=10485760
net.netfilter.nf_conntrack_tcp_timeout_established=300
net.netfilter.nf_conntrack_buckets=655360
net.core.netdev_max_backlog=10000

net.ipv4.neigh.default.gc_thresh1=1024
net.ipv4.neigh.default.gc_thresh2=4096
net.ipv4.neigh.default.gc_thresh3=8192

net.netfilter.nf_conntrack_max=10485760
net.netfilter.nf_conntrack_tcp_timeout_established=300
net.netfilter.nf_conntrack_buckets=655360
net.core.netdev_max_backlog=10000

fs.inotify.max_user_instances=524288
fs.inotify.max_user_watches=524288
```

## 應用配置

在運行 Pod 的時候也需要注意遵循一些最佳實踐，比如

* 為容器設置資源請求和限制
  * `spec.containers[].resources.limits.cpu`
  * `spec.containers[].resources.limits.memory`
  * `spec.containers[].resources.requests.cpu`
  * `spec.containers[].resources.requests.memory`
  * `spec.containers[].resources.limits.ephemeral-storage`
  * `spec.containers[].resources.requests.ephemeral-storage`
* 對關鍵應用使用 PodDisruptionBudget、nodeAffinity、podAffinity 和 podAntiAffinity 等保護
* 儘量使用控制器來管理容器（如 Deployment、StatefulSet、DaemonSet、Job 等）
* 更多內容參考[這裡](../deploy/kubernetes-configuration-best-practice.md)

## 必要的擴展

監控、告警以及可視化（如 Prometheus 和 Grafana）至關重要，推薦部署並開啟。

## 參考文檔

* [Building Large Clusters](https://kubernetes.io/docs/setup/cluster-large/)
* [Scaling Kubernetes to 2,500 Nodes](https://blog.openai.com/scaling-kubernetes-to-2500-nodes/)
* [Scaling Kubernetes for 25M users](https://medium.com/@brendanrius/scaling-kubernetes-for-25m-users-a7937e3536a0)
