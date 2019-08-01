# Frakti

## 簡介

Frakti是一個基於Kubelet CRI的運行時，它提供了hypervisor級別的隔離性，特別適用於運行不可信應用以及多租戶場景下。Frakti實現了一個混合運行時：

- 特權容器以Docker container的方式運行
- 而普通容器則以hyper container的方法運行在VM內

## Allinone安裝方法

Frakti提供了一個簡便的安裝腳本，可以一鍵在Ubuntu或CentOS上啟動一個本機的Kubernetes+frakti集群。

```sh
curl -sSL https://github.com/kubernetes/frakti/raw/master/cluster/allinone.sh | bash
```

## 集群部署

首先需要在所有機器上安裝hyperd, docker, frakti, CNI 和 kubelet。

### 安裝hyperd

Ubuntu 16.04+:

```sh
apt-get update && apt-get install -y qemu libvirt-bin
curl -sSL https://hypercontainer.io/install | bash
```

CentOS 7:

```sh
curl -sSL https://hypercontainer.io/install | bash
```

配置hyperd:

```sh
echo -e "Kernel=/var/lib/hyper/kernel\n\
Initrd=/var/lib/hyper/hyper-initrd.img\n\
Hypervisor=qemu\n\
StorageDriver=overlay\n\
gRPCHost=127.0.0.1:22318" > /etc/hyper/config
systemctl enable hyperd
systemctl restart hyperd
```

### 安裝docker

Ubuntu 16.04+:

```sh
apt-get update
apt-get install -y docker.io
```

CentOS 7:

```sh
yum install -y docker
```

啟動docker:

```sh
systemctl enable docker
systemctl start docker
```

### 安裝frakti

```sh
curl -sSL https://github.com/kubernetes/frakti/releases/download/v0.2/frakti -o /usr/bin/frakti
chmod +x /usr/bin/frakti
cgroup_driver=$(docker info | awk '/Cgroup Driver/{print $3}')
cat <<EOF > /lib/systemd/system/frakti.service
[Unit]
Description=Hypervisor-based container runtime for Kubernetes
Documentation=https://github.com/kubernetes/frakti
After=network.target

[Service]
ExecStart=/usr/bin/frakti --v=3 \
          --log-dir=/var/log/frakti \
          --logtostderr=false \
          --cgroup-driver=${cgroup_driver} \
          --listen=/var/run/frakti.sock \
          --streaming-server-addr=%H \
          --hyper-endpoint=127.0.0.1:22318
MountFlags=shared
TasksMax=8192
LimitNOFILE=1048576
LimitNPROC=1048576
LimitCORE=infinity
TimeoutStartSec=0
Restart=on-abnormal

[Install]
WantedBy=multi-user.target
EOF
```

### 安裝CNI

Ubuntu 16.04+:

```sh
apt-get update && apt-get install -y apt-transport-https
curl -s https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key add -
cat <<EOF > /etc/apt/sources.list.d/kubernetes.list
deb http://apt.kubernetes.io/ kubernetes-xenial main
EOF
apt-get update
apt-get install -y kubernetes-cni
```

CentOS 7:

```sh
cat <<EOF > /etc/yum.repos.d/kubernetes.repo
[kubernetes]
name=Kubernetes
baseurl=http://yum.kubernetes.io/repos/kubernetes-el7-x86_64
enabled=1
gpgcheck=1
repo_gpgcheck=1
gpgkey=https://packages.cloud.google.com/yum/doc/yum-key.gpg
       https://packages.cloud.google.com/yum/doc/rpm-package-key.gpg
EOF
setenforce 0
yum install -y kubernetes-cni
```

配置CNI網絡，注意

- frakti目前僅支持bridge插件
- 所有機器上Pod的子網不能相同，比如master上可以用`10.244.1.0/24`，而第一個Node上可以用`10.244.2.0/24`

```sh
mkdir -p /etc/cni/net.d
cat >/etc/cni/net.d/10-mynet.conf <<-EOF
{
    "cniVersion": "0.3.0",
    "name": "mynet",
    "type": "bridge",
    "bridge": "cni0",
    "isGateway": true,
    "ipMasq": true,
    "ipam": {
        "type": "host-local",
        "subnet": "10.244.1.0/24",
        "routes": [
            { "dst": "0.0.0.0/0"  }
        ]
    }
}
EOF
cat >/etc/cni/net.d/99-loopback.conf <<-EOF
{
    "cniVersion": "0.3.0",
    "type": "loopback"
}
EOF
```

### 安裝Kubelet

Ubuntu 16.04+:

```sh
apt-get install -y kubelet kubeadm kubectl
```

CentOS 7:

```sh
yum install -y kubelet kubeadm kubectl
```

配置Kubelet使用frakti runtime:

```sh
sed -i '2 i\Environment="KUBELET_EXTRA_ARGS=--container-runtime=remote --container-runtime-endpoint=/var/run/frakti.sock --feature-gates=AllAlpha=true"' /etc/systemd/system/kubelet.service.d/10-kubeadm.conf
systemctl daemon-reload
```

### 配置Master

```sh
kubeadm init kubeadm init --pod-network-cidr 10.244.0.0/16 --kubernetes-version latest

# Optional: enable schedule pods on the master
export KUBECONFIG=/etc/kubernetes/admin.conf
kubectl taint nodes --all node-role.kubernetes.io/master:NoSchedule-
```

### 配置Node

```sh
# get token on master node
token=$(kubeadm token list | grep authentication,signing | awk '{print $1}')

# join master on worker nodes
kubeadm join --token $token ${master_ip}
```

### 配置CNI網絡路由

在集群模式下，需要為容器網絡配置直接路由，假設有一臺master和兩臺Node：

```
NODE   IP_ADDRESS   CONTAINER_CIDR
master 10.140.0.1  10.244.1.0/24
node-1 10.140.0.2  10.244.2.0/24
node-2 10.140.0.3  10.244.3.0/24
```

CNI的網絡路由可以這麼配置：

```sh
# on master
ip route add 10.244.2.0/24 via 10.140.0.2
ip route add 10.244.3.0/24 via 10.140.0.3

# on node-1
ip route add 10.244.1.0/24 via 10.140.0.1
ip route add 10.244.3.0/24 via 10.140.0.3

# on node-2
ip route add 10.244.1.0/24 via 10.140.0.1
ip route add 10.244.2.0/24 via 10.140.0.2
```

## 參考文檔

- [Frakti部署指南](https://github.com/kubernetes/frakti/blob/master/docs/deploy.md)
