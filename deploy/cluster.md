# 集群部署

## Kubernetes 集群架构

![](images/ha.png)

### etcd 集群

从 `https://discovery.etcd.io/new?size=3` 获取 token 后，把 `etcd.yaml` 放到每台机器的 `/etc/kubernetes/manifests/etcd.yaml`，并替换掉 `${DISCOVERY_TOKEN}`, `${NODE_NAME}` 和 `${NODE_IP}`，即可以由 kubelet 来启动一个 etcd 集群。

对于运行在 kubelet 外部的 etcd，可以参考 [etcd clustering guide](https://github.com/coreos/etcd/blob/master/Documentation/op-guide/clustering.md) 来手动配置集群模式。

### kube-apiserver

把 `kube-apiserver.yaml` 放到每台 Master 节点的 `/etc/kubernetes/manifests/`，并把相关的配置放到 `/srv/kubernetes/`，即可由 kubelet 自动创建并启动 apiserver:

- basic_auth.csv - basic auth user and password
- ca.crt - Certificate Authority cert
- known_tokens.csv - tokens that entities (e.g. the kubelet) can use to talk to the apiserver
- kubecfg.crt - Client certificate, public key
- kubecfg.key - Client certificate, private key
- server.cert - Server certificate, public key
- server.key - Server certificate, private key

apiserver 启动后，还需要为它们做负载均衡，可以使用云平台的弹性负载均衡服务或者使用 haproxy/lvs/nginx 等为 master 节点配置负载均衡。

另外，还可以借助 Keepalived、OSPF、Pacemaker 等来保证负载均衡节点的高可用。

注意：

- 大规模集群注意增加 `--max-requests-inflight`（默认 400）
- 使用 nginx 时注意增加 `proxy_timeout: 10m`

### controller manager 和 scheduler

controller manager 和 scheduler 需要保证任何时刻都只有一个实例运行，需要一个选主的过程，所以在启动时要设置 `--leader-elect=true`，比如

```
kube-scheduler --master=127.0.0.1:8080 --v=2 --leader-elect=true
kube-controller-manager --master=127.0.0.1:8080 --cluster-cidr=10.245.0.0/16 --allocate-node-cidrs=true --service-account-private-key-file=/srv/kubernetes/server.key --v=2 --leader-elect=true
```

把 `kube-scheduler.yaml` 和 `kube-controller-manager` 放到每台 Master 节点的 `/etc/kubernetes/manifests/`，并把相关的配置放到 `/srv/kubernetes/`，即可由 kubelet 自动创建并启动 kube-scheduler 和 kube-controller-manager。

### kube-dns

kube-dns 可以通过 Deployment 的方式来部署，默认 kubeadm 会自动创建。但在大规模集群的时候，需要放宽资源限制，比如

```
dns_replicas: 6
dns_cpu_limit: 100m
dns_memory_limit: 512Mi
dns_cpu_requests 70m
dns_memory_requests: 70Mi
```

另外，也需要给 dnsmasq 增加资源，比如增加缓存大小到 10000，增加并发处理数量 `--dns-forward-max=1000` 等。

### 数据持久化

除了上面提到的这些配置，持久化存储也是高可用 Kubernetes 集群所必须的。

- 对于公有云上部署的集群，可以考虑使用云平台提供的持久化存储，比如 aws ebs 或者 gce persistent disk
- 对于物理机部署的集群，可以考虑使用 iSCSI、NFS、Gluster 或者 Ceph 等网络存储，也可以使用 RAID

## Azure

在 Azure 上可以使用 AKS 或者 acs-engine 来部署 Kubernetes 集群，具体部署方法参考 [这里](azure.md)。

## GCE

在 GCE 上可以利用 cluster 脚本方便的部署集群：

```
# gce,aws,gke,azure-legacy,vsphere,openstack-heat,rackspace,libvirt-coreos
export KUBERNETES_PROVIDER=gce
curl -sS https://get.k8s.io | bash
cd kubernetes
cluster/kube-up.sh
```

## AWS

在 aws 上建议使用 [kops](https://kubernetes.io/docs/setup/production-environment/tools/kops/) 来部署。

## 物理机或虚拟机

在 Linux 物理机或虚拟机中，建议使用 [kubeadm](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/install-kubeadm/) 或 [kubespray](kubespray.md) 来部署 Kubernetes 集群。
