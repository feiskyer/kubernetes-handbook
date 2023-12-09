# Embracing Cluster Deployment of Frakti on CentOS

This informative guide is designed to ease the process of installing a Kubernetes cluster with Frakti runtime. Frakti isn't conventional—it's a hypervisor-based container runtime. It relies on a cluster of packages other than Kubernetes. These include the hyper container engine Hyperd (main container runtime), Docker container engine (the auxiliary container runtime), and the network plugin CNI.

## Exploring other Options: Generating Instances on GCE

Although it's preferable to operate Frakti-enabled Kubernetes on baremetal, you could test Frakti on public clouds if you're up for a unique experience. Just a heads-up: don't neglect to enable ip_forward on GCE!

## Prepping all Nodes

### How to Launch Hyperd

```sh
# Access Hyperd from https://docs.hypercontainer.io/get_started/install/linux.html
curl -sSL https://hypercontainer.io/install | bash

echo -e "Hypervisor=libvirt\n\
Kernel=/var/lib/hyper/kernel\n\
Initrd=/var/lib/hyper/hyper-initrd.img\n\
Hypervisor=qemu\n\
StorageDriver=overlay\n\
gRPCHost=127.0.0.1:22318" > /etc/hyper/config
systemctl enable hyperd
systemctl restart hyperd
```

### Running Docker

```sh
yum install -y docker
sed -i 's/native.cgroupdriver=systemd/native.cgroupdriver=cgroupfs/g' /usr/lib/systemd/system/docker.service
systemctl daemon-reload

systemctl enable docker
systemctl start docker
```

### Prepping Frakti

```sh
curl -sSL https://github.com/kubernetes/frakti/releases/download/v0.1/frakti -o /usr/bin/frakti
chmod +x /usr/bin/frakti
cat <<EOF > /lib/systemd/system/frakti.service
[Unit]
Description=Hypervisor-based container runtime for Kubernetes
Documentation=https://github.com/kubernetes/frakti
After=network.target

[Service]
ExecStart=/usr/bin/frakti --v=3 \
          --log-dir=/var/log/frakti \
          --logtostderr=false \
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

### Firing up CNI

Frakti calls for a CNI network to initiate, so let's lay the groundwork. Remember, you need to plot different subnet for different hosts. For instance:

- 10.244.1.0/24
- 10.244.2.0/24
- 10.244.3.0/24

Sure enough, you also need to configure host routes on GCE. 

```sh
cat <<EOF > /etc/yum.repos.d/kubernetes.repo
[kubernetes]
name=Kubernetes
baseurl=http://yum.kubernetes.io/repos/kubernetes-el7-x86_64-unstable
enabled=1
gpgcheck=1
repo_gpgcheck=1
gpgkey=https://packages.cloud.google.com/yum/doc/yum-key.gpg
       https://packages.cloud.google.com/yum/doc/rpm-package-key.gpg
EOF
setenforce 0
yum install -y kubernetes-cni bridge-utils
```

Now set up the CNI network. 

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

### Hasten Kubelet

```sh
yum install -y kubelet kubeadm kubectl 
# As there aren't any kubernete v1.6 rpms available on `yum.kubernetes.io`, you need to source it from `dl.k8s.io`:
# Download the most recent release of kubelet and kubectl
# Here's an important note: remove this command after the stable v1.6 release
cd /tmp/
curl -SL https://dl.k8s.io/v1.6.0-beta.4/kubernetes-server-linux-amd64.tar.gz -o kubernetes-server-linux-amd64.tar.gz
tar zxvf kubernetes-server-linux-amd64.tar.gz
/bin/cp -f kubernetes/server/bin/{kubelet,kubeadm,kubectl} /usr/bin/
rm -rf kubernetes-server-linux-amd64.tar.gz kubernetes
```

You can gear up the kubelet with Frakti runtime by doing this:

```sh
sed -i '2 i\Environment="KUBELET_EXTRA_ARGS=--container-runtime=remote --container-runtime-endpoint=/var/run/frakti.sock --feature-gates=AllAlpha=true"' /etc/systemd/system/kubelet.service.d/10-kubeadm.conf
```

## Harmonizing the Master Node

You can tailor the Hyperkube image via `KUBE_HYPERKUBE_IMAGE`:

- `VERSION=v1.6.0 make -C cluster/images/hyperkube build`
- `export KUBE_HYPERKUBE_IMAGE=xxxx`

```sh
kubeadm init kubeadm init --pod-network-cidr 10.244.0.0/16 --kubernetes-version latest
```

As an option, you can schedule pods on the master by doing:

```sh
export KUBECONFIG=/etc/kubernetes/admin.conf
kubectl taint nodes --all node-role.kubernetes.io/master:NoSchedule-
```

## Aligning the Worker Nodes

```sh
# Secure the token on master node
token=$(kubeadm token list | grep authentication,signing | awk '{print $1}')
# Connect\xa0worker nodes to the master with:
kubeadm join --token $token ${master_ip}:6443
```

Happy clustering!