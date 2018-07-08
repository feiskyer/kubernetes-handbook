# Frakti

## 简介

Frakti是一个基于Kubelet CRI的运行时，它提供了hypervisor级别的隔离性，特别适用于运行不可信应用以及多租户场景下。Frakti实现了一个混合运行时：

- 特权容器以Docker container的方式运行
- 而普通容器则以hyper container的方法运行在VM内

## Allinone安装方法

Frakti提供了一个简便的安装脚本，可以一键在Ubuntu或CentOS上启动一个本机的Kubernetes+frakti集群。

```sh
curl -sSL https://github.com/kubernetes/frakti/raw/master/cluster/allinone.sh | bash
```

## 集群部署

首先需要在所有机器上安装hyperd, docker, frakti, CNI 和 kubelet。

### 安装hyperd

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

### 安装docker

Ubuntu 16.04+:

```sh
apt-get update
apt-get install -y docker.io
```

CentOS 7:

```sh
yum install -y docker
```

启动docker:

```sh
systemctl enable docker
systemctl start docker
```

### 安装frakti

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

### 安装CNI

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

配置CNI网络，注意

- frakti目前仅支持bridge插件
- 所有机器上Pod的子网不能相同，比如master上可以用`10.244.1.0/24`，而第一个Node上可以用`10.244.2.0/24`

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

### 安装Kubelet

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

### 配置CNI网络路由

在集群模式下，需要为容器网络配置直接路由，假设有一台master和两台Node：

```
NODE   IP_ADDRESS   CONTAINER_CIDR
master 10.140.0.1  10.244.1.0/24
node-1 10.140.0.2  10.244.2.0/24
node-2 10.140.0.3  10.244.3.0/24
```

CNI的网络路由可以这么配置：

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

## 参考文档

- [Frakti部署指南](https://github.com/kubernetes/frakti/blob/master/docs/deploy.md)
