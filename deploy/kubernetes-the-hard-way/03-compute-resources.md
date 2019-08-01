# 準備計算資源

Kubernetes 需要一些機器去搭建管理 Kubernetes 的控制平臺, 也需要一些工作節點（work node）來運行容器。在這個實驗中你將會創建一些虛擬機，並利用 GCE [Compute Zone](https://cloud.google.com/compute/docs/regions-zones/regions-zones) 來運行安全且高可用的 Kubernetes 集群。

> 請確定默認 Compute Zone 和 Region 已按照 [事前準備](01-prerequisites.md#set-a-default-compute-region-and-zone) 的設定步驟完成。

## 網絡

Kubernetes [網絡模型](https://kubernetes.io/docs/concepts/cluster-administration/networking/#kubernetes-model) 假設使用扁平網路能讓每個容器與節點都可以相互通信。 在這裡我們先忽略用於控制容器網絡隔離的 Network policies（Network Policies 不在本指南的範圍內）。

### 虛擬私有網絡（VPC）

本節將會創建一個專用的 [Virtual Private Cloud](https://cloud.google.com/compute/docs/networks-and-firewalls#networks) (VPC) 網絡來搭建我們的 Kubernetes 集群。

首先創建一個名為 kubernetes-the-hard-way 的 VPC 網絡：

```sh
gcloud compute networks create kubernetes-the-hard-way --subnet-mode custom
```

為了給 Kubernetes 集群的每個節點分配私有 IP 地址，需要創建一個含有足夠大 IP 地址池的子網。 在 `kubernetes-the-hard-way` VPC 網絡中創建 `kubernetes` 子網：

```sh
gcloud compute networks subnets create kubernetes \
  --network kubernetes-the-hard-way \
  --range 10.240.0.0/24
```

> `10.240.0.0/24` IP 地址範圍, 可以分配 254 個計算節點。

### 防火牆規則

創建一個防火牆規則允許內部網路通過所有協議進行通信：

```sh
gcloud compute firewall-rules create kubernetes-the-hard-way-allow-internal \
  --allow tcp,udp,icmp \
  --network kubernetes-the-hard-way \
  --source-ranges 10.240.0.0/24,10.200.0.0/16
```

創建一個防火牆規則允許外部 SSH、ICMP 以及 HTTPS 等通信：

```sh
gcloud compute firewall-rules create kubernetes-the-hard-way-allow-external \
  --allow tcp:22,tcp:6443,icmp \
  --network kubernetes-the-hard-way \
  --source-ranges 0.0.0.0/0
```

>  [外部負載均衡器](https://cloud.google.com/compute/docs/load-balancing/network/) 被用來暴露 Kubernetes API Servers 給遠端客戶端。

列出在 `kubernetes-the-hard-way` VPC 網絡中的防火牆規則：

```sh
gcloud compute firewall-rules list --filter="network:kubernetes-the-hard-way"
```

> 輸出為

```sh
NAME                                    NETWORK                  DIRECTION  PRIORITY  ALLOW                 DENY
kubernetes-the-hard-way-allow-external  kubernetes-the-hard-way  INGRESS    1000      tcp:22,tcp:6443,icmp
kubernetes-the-hard-way-allow-internal  kubernetes-the-hard-way  INGRESS    1000      tcp,udp,icmp
```

### Kubernetes 公網 IP 地址

分配固定的 IP 地址, 被用來連接外部的負載平衡器至 Kubernetes API Servers:

```sh
gcloud compute addresses create kubernetes-the-hard-way \
  --region $(gcloud config get-value compute/region)
```

驗證 `kubernetes-the-hard-way` 固定 IP 地址已經在默認的 Compute Region 中創建出來：

```sh
gcloud compute addresses list --filter="name=('kubernetes-the-hard-way')"
```

> 輸出為

```sh
NAME                     REGION    ADDRESS        STATUS
kubernetes-the-hard-way  us-west1  XX.XXX.XXX.XX  RESERVED
```

## 計算實例

本節將會創建基於 [Ubuntu Server 18.04](https://www.ubuntu.com/server) 的計算實例，原因是它對 [containerd](https://github.com/containerd/containerd) 容器引擎有很好的支持。每個虛擬機將會分配一個私有 IP 地址用以簡化 Kubernetes 的設置。

### Kubernetes 控制節點

建立三個計算節點用以配置 Kubernetes 控制平面：

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

### Kubernetes 工作節點

每臺 worker 節點都需要從 Kubernetes 集群 CIDR 範圍中分配一個 Pod 子網。 Pod 子網分配將會在之後的容器網路章節做練習。在 worker 節點內部可以通過 `pod-cidr` 元數據來獲得 Pod 子網的分配結果。

> Kubernetes 集群 CIDR 的範圍可以通過 Controller Manager 的 `--cluster-cidr` 參數來設定。在本次教學中我們會設置為 `10.200.0.0/16`，它支持 254 個子網。

創建三個計算節點用來作為 Kubernetes Worker 節點：

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

### 驗證

列出所有在默認 Compute Zone 的計算節點：

```sh
gcloud compute instances list
```

輸出為：

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

本教程使用 SSH 來配置控制節點和工作節點。當通過 `gcloud compute ssh` 第一次連接計算實例時，會自動生成 SSH 證書，並[保存在項目或者實例的元數據中](https://cloud.google.com/compute/docs/instances/connecting-to-instance)。

驗證 `controller-0` 的 SSH 訪問

```sh
gcloud compute ssh controller-0
```

因為這是第一次訪問，此時會生成 SSH 證書。按照提示操作

```sh
WARNING: The public SSH key file for gcloud does not exist.
WARNING: The private SSH key file for gcloud does not exist.
WARNING: You do not have an SSH key for gcloud.
WARNING: SSH keygen will be executed to generate a key.
Generating public/private rsa key pair.
Enter passphrase (empty for no passphrase):
Enter same passphrase again:
```

此時，SSH 證書回保存在你的項目中：

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

SSH 證書更新後，你就可以登錄到 `controller-0` 實例中了：

```sh
Welcome to Ubuntu 18.04 LTS (GNU/Linux 4.15.0-1006-gcp x86_64)

...

Last login: Sun May 13 14:34:27 2018 from XX.XXX.XXX.XX
```

下一步：[配置 CA 和創建 TLS 證書](04-certificate-authority.md)
