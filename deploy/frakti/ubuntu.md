# Building Frakti-Based Kubernetes Clusters on Ubuntu

This guide provides a quick how-to on setting up a Kubernetes cluster using the Frakti runtime on Ubuntu.

Frakti is a container runtime powered by a hypervisor, which requires a few additional packages other than Kubernetes:

- Hyperd: The Hyper container engine (main container runtime)
- Docker: The Docker container engine (auxiliary container runtime)
- CNI: The networking plugin

## Step One (Optional): Set Up Instances on GCE

Though it's recommended to run a Frakti-enabled Kubernetes on bare metal setups, it's also possible to experiment with Frakti on public clouds like Google Cloud Engine (GCE). Just make sure you remember to enable IP forwarding on GCE!

## Step Two: Prep All Nodes 

### Install hyperd

*To install from: https://docs.hypercontainer.io/get_started/install/linux.html*
```sh
apt-get update && apt-get install -y qemu libvirt-bin
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

### Install docker

```sh
apt-get update
apt-get install -y docker.io

systemctl enable docker
systemctl start docker
```

### Install frakti

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

### Install CNI

Frakti needs CNI networking to get started. Please note to configure different subnets for different hosts, like 10.244.1.0/24, 10.244.2.0/24, and 10.244.3.0/24. Also, set up host routes on GCE accordingly.

```sh
apt-get update && apt-get install -y apt-transport-https
curl -s https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key add -
cat <<EOF > /etc/apt/sources.list.d/kubernetes.list
deb http://apt.kubernetes.io/ kubernetes-xenial-unstable main
EOF
apt-get update
apt-get install -y kubernetes-cni
```

*To configure CNI network:*

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

### Start frakti

```sh
systemctl enable frakti
systemctl start frakti
```

### Install kubelet

```sh
apt-get install -y kubelet kubeadm kubectl
```

*To configure kubelet with Frakti runtime, use:*

```sh
sed -i '2 i\Environment="KUBELET_EXTRA_ARGS=--container-runtime=remote --container-runtime-endpoint=/var/run/frakti.sock --feature-gates=AllAlpha=true"' /etc/systemd/system/kubelet.service.d/10-kubeadm.conf
```

## Step Three: Set Up The Master Node

The Hyperkube image can be customized via `KUBE_HYPERKUBE_IMAGE`:

- `VERSION=v1.6.0 make -C cluster/images/hyperkube build`
- `export KUBE_HYPERKUBE_IMAGE=xxxx`

```sh
kubeadm init kubeadm init --pod-network-cidr 10.244.0.0/16 --kubernetes-version latest
```

Optional: To enable scheduling pods on the master, use:

```sh
export KUBECONFIG=/etc/kubernetes/admin.conf
kubectl taint nodes --all node-role.kubernetes.io/master:NoSchedule-
```

## Step Four: Set Up The Worker Nodes

```sh
# get token on master node
token=$(kubeadm token list | grep authentication,signing | awk '{print $1}')

# join master on worker nodes
kubeadm join --token $token ${master_ip}
```