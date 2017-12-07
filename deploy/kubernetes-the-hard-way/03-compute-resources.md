
# 準备计算资源
Kubernetes 需要一些机器去搭建管理 Kubernetes 的控制平台, 也需要一些工作节点(work node)让 container 运行, 在这个实验你将会準备计算资源, 透过single [compute zone](https://cloud.google.com/compute/docs/regions-zones/regions-zones)来运行安全且高可用的 Kubernetes 丛集 

> 请确定 default compute zone 和 region 已照着 [事前準备](01-prerequisites.md#set-a-default-compute-region-and-zone)的设定步骤完成


## Networking

Kubernetes [networking model](https://kubernetes.io/docs/concepts/cluster-administration/networking/#kubernetes-model) 假设使用flat 
网路能让每个 container 与节点都互相沟通。 在这边我们不去提及 network policies ,一个用来控管 container 之间相互的连线, 或是连到外网的终端的机制


> 设定network policies 不在这次教学范围内


### Virtual Private Cloud Network

这个部份会搭建一个可靠的 [Virtual Private Cloud](https://cloud.google.com/compute/docs/networks-and-firewalls#networks) (VPC) network 来搭建我们 Kubernetes 丛集

产生一个自订 kubernetes-the-hard-way 的 网路环境


```
gcloud compute networks create kubernetes-the-hard-way --mode custom
```

一个子网必须提供足够的虚拟 IP , 用以分配给 Kubernetes 丛集的每个节点

在`kubernetes-the-hard-way` VPC network产生`kubernetes`子网,


```
gcloud compute networks subnets create kubernetes \
  --network kubernetes-the-hard-way \
  --range 10.240.0.0/24
```

> `10.240.0.0/24` IP address范围, 可以分配 254 计算节点

### Firewall Rules


建立一个防火墙规则允许内部网路可以通过所有的网路协定:

```
gcloud compute firewall-rules create kubernetes-the-hard-way-allow-internal \
  --allow tcp,udp,icmp \
  --network kubernetes-the-hard-way \
  --source-ranges 10.240.0.0/24,10.200.0.0/16
```
建立一个防火墙规则允许外部SSH, ICMP, HTTPS等连线

```
gcloud compute firewall-rules create kubernetes-the-hard-way-allow-external \
  --allow tcp:22,tcp:6443,icmp \
  --network kubernetes-the-hard-way \
  --source-ranges 0.0.0.0/0
```

>  [外部负载均衡伺服器](https://cloud.google.com/compute/docs/load-balancing/network/) 被用来暴露 Kubernetes API Servers 给远端Client

列出所有防火墙在`kubernetes-the-hard-way` VPC network的规则：

```
gcloud compute firewall-rules list --filter "network: kubernetes-the-hard-way"
```

> 输出为

```
NAME                                         NETWORK                  DIRECTION  PRIORITY  ALLOW                 DENY
kubernetes-the-hard-way-allow-external       kubernetes-the-hard-way  INGRESS    1000      tcp:22,tcp:6443,icmp
kubernetes-the-hard-way-allow-internal       kubernetes-the-hard-way  INGRESS    1000      tcp,udp,icmp
```

### Kubernetes Public IP Address

分配固定的ＩＰ 地址, 被用来连接外部的负载平衡器至Kubernetes API Servers:


```
gcloud compute addresses create kubernetes-the-hard-way \
  --region $(gcloud config get-value compute/region)
```

验证 `kubernetes-the-hard-way` 固定IP地址被 你的default compute region 建立出来:

```
gcloud compute addresses list --filter="name=('kubernetes-the-hard-way')"
```

> 输出为

```
NAME                     REGION    ADDRESS        STATUS
kubernetes-the-hard-way  us-west1  XX.XXX.XXX.XX  RESERVED
```

## 计算节点



计算节点 将会使用[Ubuntu Server](https://www.ubuntu.com/server) 16.04, 原因是它对[cri-containerd container runtime](https://github.com/kubernetes-incubator/cri-containerd)有很好的支持 每个计算instance 会被分到一个私有 IP address 用以简化Kubernetes 的建置



### Kubernetes Controllers

建立三个计算节点用以配置Kubernetes的控制平台

```
for i in 0 1 2; do
  gcloud compute instances create controller-${i} \
    --async \
    --boot-disk-size 200GB \
    --can-ip-forward \
    --image-family ubuntu-1604-lts \
    --image-project ubuntu-os-cloud \
    --machine-type n1-standard-1 \
    --private-network-ip 10.240.0.1${i} \
    --scopes compute-rw,storage-ro,service-management,service-control,logging-write,monitoring \
    --subnet kubernetes \
    --tags kubernetes-the-hard-way,controller
done
```


### Kubernetes Workers
每个worker 节点 需要一个Pod子网分配从Kubernetes 丛集CIDR的范围, Pod的网路分配会在之后的容器网路章节做练习, 在运行时, `pod-cidr` 节点 会被用来暴露pod的网路给计算节点

> Kubernetes 丛集CIDR的范围被定义在Controller Manager `--cluster-cidr` 参数, 在本次教学中我们会设定`10.200.0.0/16`, 将支援到254个子网

产生三个计算节点 用以配置 Kubernetes Worker节点

```
for i in 0 1 2; do
  gcloud compute instances create worker-${i} \
    --async \
    --boot-disk-size 200GB \
    --can-ip-forward \
    --image-family ubuntu-1604-lts \
    --image-project ubuntu-os-cloud \
    --machine-type n1-standard-1 \
    --metadata pod-cidr=10.200.${i}.0/24 \
    --private-network-ip 10.240.0.2${i} \
    --scopes compute-rw,storage-ro,service-management,service-control,logging-write,monitoring \
    --subnet kubernetes \
    --tags kubernetes-the-hard-way,worker
done
```

### 验证

列出所有在你的Default compute zone的计算节点


```
gcloud compute instances list
```

> output

```
NAME          ZONE        MACHINE_TYPE   PREEMPTIBLE  INTERNAL_IP  EXTERNAL_IP     STATUS
controller-0  us-west1-c  n1-standard-1               10.240.0.10  XX.XXX.XXX.XXX  RUNNING
controller-1  us-west1-c  n1-standard-1               10.240.0.11  XX.XXX.X.XX     RUNNING
controller-2  us-west1-c  n1-standard-1               10.240.0.12  XX.XXX.XXX.XX   RUNNING
worker-0      us-west1-c  n1-standard-1               10.240.0.20  XXX.XXX.XXX.XX  RUNNING
worker-1      us-west1-c  n1-standard-1               10.240.0.21  XX.XXX.XX.XXX   RUNNING
worker-2      us-west1-c  n1-standard-1               10.240.0.22  XXX.XXX.XX.XX   RUNNING
```

Next: [配置CA 和 产生 TLS 凭证](04-certificate-authority.md)
