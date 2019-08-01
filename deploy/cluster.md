# 集群部署

## Kubernetes 集群架構

![](images/ha.png)

### etcd 集群

從 `https://discovery.etcd.io/new?size=3` 獲取 token 後，把 `etcd.yaml` 放到每臺機器的 `/etc/kubernetes/manifests/etcd.yaml`，並替換掉 `${DISCOVERY_TOKEN}`, `${NODE_NAME}` 和 `${NODE_IP}`，即可以由 kubelet 來啟動一個 etcd 集群。

對於運行在 kubelet 外部的 etcd，可以參考 [etcd clustering guide](https://github.com/coreos/etcd/blob/master/Documentation/op-guide/clustering.md) 來手動配置集群模式。

### kube-apiserver

把 `kube-apiserver.yaml` 放到每臺 Master 節點的 `/etc/kubernetes/manifests/`，並把相關的配置放到 `/srv/kubernetes/`，即可由 kubelet 自動創建並啟動 apiserver:

- basic_auth.csv - basic auth user and password
- ca.crt - Certificate Authority cert
- known_tokens.csv - tokens that entities (e.g. the kubelet) can use to talk to the apiserver
- kubecfg.crt - Client certificate, public key
- kubecfg.key - Client certificate, private key
- server.cert - Server certificate, public key
- server.key - Server certificate, private key

apiserver 啟動後，還需要為它們做負載均衡，可以使用雲平臺的彈性負載均衡服務或者使用 haproxy/lvs/nginx 等為 master 節點配置負載均衡。

另外，還可以藉助 Keepalived、OSPF、Pacemaker 等來保證負載均衡節點的高可用。

注意：

- 大規模集群注意增加 `--max-requests-inflight`（默認 400）
- 使用 nginx 時注意增加 `proxy_timeout: 10m`

### controller manager 和 scheduler

controller manager 和 scheduler 需要保證任何時刻都只有一個實例運行，需要一個選主的過程，所以在啟動時要設置 `--leader-elect=true`，比如

```
kube-scheduler --master=127.0.0.1:8080 --v=2 --leader-elect=true
kube-controller-manager --master=127.0.0.1:8080 --cluster-cidr=10.245.0.0/16 --allocate-node-cidrs=true --service-account-private-key-file=/srv/kubernetes/server.key --v=2 --leader-elect=true
```

把 `kube-scheduler.yaml` 和 `kube-controller-manager` 放到每臺 Master 節點的 `/etc/kubernetes/manifests/`，並把相關的配置放到 `/srv/kubernetes/`，即可由 kubelet 自動創建並啟動 kube-scheduler 和 kube-controller-manager。

### kube-dns

kube-dns 可以通過 Deployment 的方式來部署，默認 kubeadm 會自動創建。但在大規模集群的時候，需要放寬資源限制，比如

```
dns_replicas: 6
dns_cpu_limit: 100m
dns_memory_limit: 512Mi
dns_cpu_requests 70m
dns_memory_requests: 70Mi
```

另外，也需要給 dnsmasq 增加資源，比如增加緩存大小到 10000，增加併發處理數量 `--dns-forward-max=1000` 等。

### 數據持久化

除了上面提到的這些配置，持久化存儲也是高可用 Kubernetes 集群所必須的。

- 對於公有云上部署的集群，可以考慮使用雲平臺提供的持久化存儲，比如 aws ebs 或者 gce persistent disk
- 對於物理機部署的集群，可以考慮使用 iSCSI、NFS、Gluster 或者 Ceph 等網絡存儲，也可以使用 RAID

## Azure

在 Azure 上可以使用 AKS 或者 acs-engine 來部署 Kubernetes 集群，具體部署方法參考 [這裡](azure.md)。

## GCE

在 GCE 上可以利用 cluster 腳本方便的部署集群：

```
# gce,aws,gke,azure-legacy,vsphere,openstack-heat,rackspace,libvirt-coreos
export KUBERNETES_PROVIDER=gce
curl -sS https://get.k8s.io | bash
cd kubernetes
cluster/kube-up.sh
```

## AWS

在 aws 上建議使用 [kops](https://kubernetes.io/docs/setup/production-environment/tools/kops/) 來部署。

## 物理機或虛擬機

在 Linux 物理機或虛擬機中，建議使用 [kubeadm](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/install-kubeadm/) 或 [kubespray](kubespray.md) 來部署 Kubernetes 集群。
