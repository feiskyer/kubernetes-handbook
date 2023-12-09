# Frakti: The Runtime Revolution

## Introduction

Frakti serves as a revolutionary runtime based on Kubelet CRI that provides hypervisor-level isolation. It proves to be especially beneficial when running untrusted applications and in multi-tenant scenarios. Frakti has ingeniously invented a mixed runtime:

* Privileged containers operate just like Docker containers
* While standard containers run within VMs using the hyper container method

## Allinone Installation Guide

Frakti extends the convenience of an installation script that kick-starts a local Kubernetes plus Frakti cluster on either Ubuntu or CentOS platforms within one click.

```bash
curl -sSL https://github.com/kubernetes/frakti/raw/master/cluster/allinone.sh | bash
```

## Cluster Deployment

First off, make sure to install hyperd, docker, frakti, CNI and kubelet on all machines.

### Installation of hyperd

Ubuntu 16.04+:

```bash
apt-get update && apt-get install -y qemu libvirt-bin
curl -sSL https://hypercontainer.io/install | bash
```

CentOS 7:

```bash
curl -sSL https://hypercontainer.io/install | bash
```

Hyperd Configuration:

```bash
echo -e "Kernel=/var/lib/hyper/kernel\n\
Initrd=/var/lib/hyper/hyper-initrd.img\n\
Hypervisor=qemu\n\
StorageDriver=overlay\n\
gRPCHost=127.0.0.1:22318" > /etc/hyper/config
systemctl enable hyperd
systemctl restart hyperd
```

### Docker Installation

Ubuntu 16.04+:

```bash
apt-get update
apt-get install -y docker.io
```

CentOS 7:

```bash
yum install -y docker
```

Starting Docker:

```bash
systemctl enable docker
systemctl start docker
```

### Installation of frakti

```bash
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

### Installation of CNI

Ubuntu 16.04+:

```bash
apt-get update && apt-get install -y apt-transport-https
curl -s https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key add -
cat <<EOF > /etc/apt/sources.list.d/kubernetes.list
deb http://apt.kubernetes.io/ kubernetes-xenial main
EOF
apt-get update
apt-get install -y kubernetes-cni
```

CentOS 7:

```bash
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

CNI network configuration (Note)

* Currently, frakti only supports the bridge plugin
* The Pod subnet should not be the same on all machines, for instance, the master can use `10.244.1.0/24`, while the first Node can use `10.244.2.0/24`

```bash
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

### Installation of Kubelet

Ubuntu 16.04+:

```bash
apt-get install -y kubelet kubeadm kubectl
```

CentOS 7:

```bash
yum install -y kubelet kubeadm kubectl
```

Configuration of Kubelet to utilize frakti runtime:

```bash
sed -i '2 i\Environment="KUBELET_EXTRA_ARGS=--container-runtime=remote --container-runtime-endpoint=/var/run/frakti.sock --feature-gates=AllAlpha=true"' /etc/systemd/system/kubelet.service.d/10-kubeadm.conf
systemctl daemon-reload
```

### Master Configuration

```bash
kubeadm init kubeadm init --pod-network-cidr 10.244.0.0/16 --kubernetes-version latest

# Optional: enable schedule pods on the master
export KUBECONFIG=/etc/kubernetes/admin.conf
kubectl taint nodes --all node-role.kubernetes.io/master:NoSchedule-
```

### Node Configuration

```bash
# get token on master node
token=$(kubeadm token list | grep authentication,signing | awk '{print $1}')

# join master on worker nodes
kubeadm join --token $token ${master_ip}
```

### CNI Network Routing Configuration

In cluster mode, direct routing needs to be configured for the container network. Assume there is a master and two Nodes:

```text
NODE   IP_ADDRESS   CONTAINER_CIDR
master 10.140.0.1  10.244.1.0/24
node-1 10.140.0.2  10.244.2.0/24
node-2 10.140.0.3  10.244.3.0/24
```

CNI network routes can be configured like this:

```bash
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

## Additional Resources

* [Guide to Frakti Deployment](https://github.com/kubernetes/frakti/blob/master/docs/deploy.md)
