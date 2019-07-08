# 准备计算资源

Kubernetes 需要一些机器去搭建管理 Kubernetes 的控制平台, 也需要一些工作节点（work node）来运行容器。在这个实验中你将会创建一些虚拟机，并利用 GCE [Compute Zone](https://cloud.google.com/compute/docs/regions-zones/regions-zones) 来运行安全且高可用的 Kubernetes 集群。

> 请确定默认 Compute Zone 和 Region 已按照 [事前准备](01-prerequisites.md#set-a-default-compute-region-and-zone) 的设定步骤完成。

## 网络

Kubernetes [网络模型](https://kubernetes.io/docs/concepts/cluster-administration/networking/#kubernetes-model) 假设使用扁平网路能让每个容器与节点都可以相互通信。 在这里我们先忽略用于控制容器网络隔离的 Network policies（Network Policies 不在本指南的范围内）。

### 虚拟私有网络（VPC）

本节将会创建一个专用的 [Virtual Private Cloud](https://cloud.google.com/compute/docs/networks-and-firewalls#networks) (VPC) 网络来搭建我们的 Kubernetes 集群。

首先创建一个名为 kubernetes-the-hard-way 的 VPC 网络：

```sh
gcloud compute networks create kubernetes-the-hard-way --subnet-mode custom
```

为了给 Kubernetes 集群的每个节点分配私有 IP 地址，需要创建一个含有足够大 IP 地址池的子网。 在 `kubernetes-the-hard-way` VPC 网络中创建 `kubernetes` 子网：

```sh
gcloud compute networks subnets create kubernetes \
  --network kubernetes-the-hard-way \
  --range 10.240.0.0/24
```

> `10.240.0.0/24` IP 地址范围, 可以分配 254 个计算节点。

### 防火墙规则

创建一个防火墙规则允许内部网路通过所有协议进行通信：

```sh
gcloud compute firewall-rules create kubernetes-the-hard-way-allow-internal \
  --allow tcp,udp,icmp \
  --network kubernetes-the-hard-way \
  --source-ranges 10.240.0.0/24,10.200.0.0/16
```

创建一个防火墙规则允许外部 SSH、ICMP 以及 HTTPS 等通信：

```sh
gcloud compute firewall-rules create kubernetes-the-hard-way-allow-external \
  --allow tcp:22,tcp:6443,icmp \
  --network kubernetes-the-hard-way \
  --source-ranges 0.0.0.0/0
```

>  [外部负载均衡器](https://cloud.google.com/compute/docs/load-balancing/network/) 被用来暴露 Kubernetes API Servers 给远端客户端。

列出在 `kubernetes-the-hard-way` VPC 网络中的防火墙规则：

```sh
gcloud compute firewall-rules list --filter="network:kubernetes-the-hard-way"
```

> 输出为

```sh
NAME                                    NETWORK                  DIRECTION  PRIORITY  ALLOW                 DENY
kubernetes-the-hard-way-allow-external  kubernetes-the-hard-way  INGRESS    1000      tcp:22,tcp:6443,icmp
kubernetes-the-hard-way-allow-internal  kubernetes-the-hard-way  INGRESS    1000      tcp,udp,icmp
```

### Kubernetes 公网 IP 地址

分配固定的 IP 地址, 被用来连接外部的负载平衡器至 Kubernetes API Servers:

```sh
gcloud compute addresses create kubernetes-the-hard-way \
  --region $(gcloud config get-value compute/region)
```

验证 `kubernetes-the-hard-way` 固定 IP 地址已经在默认的 Compute Region 中创建出来：

```sh
gcloud compute addresses list --filter="name=('kubernetes-the-hard-way')"
```

> 输出为

```sh
NAME                     REGION    ADDRESS        STATUS
kubernetes-the-hard-way  us-west1  XX.XXX.XXX.XX  RESERVED
```

## 计算实例

本节将会创建基于 [Ubuntu Server 18.04](https://www.ubuntu.com/server) 的计算实例，原因是它对 [containerd](https://github.com/containerd/containerd) 容器引擎有很好的支持。每个虚拟机将会分配一个私有 IP 地址用以简化 Kubernetes 的设置。

### Kubernetes 控制节点

建立三个计算节点用以配置 Kubernetes 控制平面：

```sh
for i in 0 1 2; do
  gcloud compute instances create controller-${i} \
    --async \
    --boot-disk-size 200GB \
    --can-ip-forward \
    --image-family ubuntu-1804-lts \
    --image-project ubuntu-os-cloud \
    --machine-type n1-standard-1 \
    --private-network-ip 10.240.0.1${i} \
    --scopes compute-rw,storage-ro,service-management,service-control,logging-write,monitoring \
    --subnet kubernetes \
    --tags kubernetes-the-hard-way,controller
done
```

### Kubernetes 工作节点

每台 worker 节点都需要从 Kubernetes 集群 CIDR 范围中分配一个 Pod 子网。 Pod 子网分配将会在之后的容器网路章节做练习。在 worker 节点内部可以通过 `pod-cidr` 元数据来获得 Pod 子网的分配结果。

> Kubernetes 集群 CIDR 的范围可以通过 Controller Manager 的 `--cluster-cidr` 参数来设定。在本次教学中我们会设置为 `10.200.0.0/16`，它支持 254 个子网。

创建三个计算节点用来作为 Kubernetes Worker 节点：

```sh
for i in 0 1 2; do
  gcloud compute instances create worker-${i} \
    --async \
    --boot-disk-size 200GB \
    --can-ip-forward \
    --image-family ubuntu-1804-lts \
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

列出所有在默认 Compute Zone 的计算节点：

```sh
gcloud compute instances list
```

输出为：

```sh
NAME          ZONE        MACHINE_TYPE   PREEMPTIBLE  INTERNAL_IP  EXTERNAL_IP     STATUS
controller-0  us-west1-c  n1-standard-1               10.240.0.10  XX.XXX.XXX.XXX  RUNNING
controller-1  us-west1-c  n1-standard-1               10.240.0.11  XX.XXX.X.XX     RUNNING
controller-2  us-west1-c  n1-standard-1               10.240.0.12  XX.XXX.XXX.XX   RUNNING
worker-0      us-west1-c  n1-standard-1               10.240.0.20  XXX.XXX.XXX.XX  RUNNING
worker-1      us-west1-c  n1-standard-1               10.240.0.21  XX.XXX.XX.XXX   RUNNING
worker-2      us-west1-c  n1-standard-1               10.240.0.22  XXX.XXX.XX.XX   RUNNING
```

## 配置 SSH

本教程使用 SSH 来配置控制节点和工作节点。当通过 `gcloud compute ssh` 第一次连接计算实例时，会自动生成 SSH 证书，并[保存在项目或者实例的元数据中](https://cloud.google.com/compute/docs/instances/connecting-to-instance)。

验证 `controller-0` 的 SSH 访问

```sh
gcloud compute ssh controller-0
```

因为这是第一次访问，此时会生成 SSH 证书。按照提示操作

```sh
WARNING: The public SSH key file for gcloud does not exist.
WARNING: The private SSH key file for gcloud does not exist.
WARNING: You do not have an SSH key for gcloud.
WARNING: SSH keygen will be executed to generate a key.
Generating public/private rsa key pair.
Enter passphrase (empty for no passphrase):
Enter same passphrase again:
```

此时，SSH 证书回保存在你的项目中：

```sh
Your identification has been saved in /home/$USER/.ssh/google_compute_engine.
Your public key has been saved in /home/$USER/.ssh/google_compute_engine.pub.
The key fingerprint is:
SHA256:nz1i8jHmgQuGt+WscqP5SeIaSy5wyIJeL71MuV+QruE $USER@$HOSTNAME
The key's randomart image is:
+---[RSA 2048]----+
|                 |
|                 |
|                 |
|        .        |
|o.     oS        |
|=... .o .o o     |
|+.+ =+=.+.X o    |
|.+ ==O*B.B = .   |
| .+.=EB++ o      |
+----[SHA256]-----+
Updating project ssh metadata...-Updated [https://www.googleapis.com/compute/v1/projects/$PROJECT_ID].
Updating project ssh metadata...done.
Waiting for SSH key to propagate.
```

SSH 证书更新后，你就可以登录到 `controller-0` 实例中了：

```sh
Welcome to Ubuntu 18.04 LTS (GNU/Linux 4.15.0-1006-gcp x86_64)

...

Last login: Sun May 13 14:34:27 2018 from XX.XXX.XXX.XX
```

下一步：[配置 CA 和创建 TLS 证书](04-certificate-authority.md)
