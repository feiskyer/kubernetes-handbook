# Kubernetes网络插件

Kubernetes有着丰富的网络插件，方便用户自定义所需的网络。

## 官方插件

* kubenet：这是一个基于CNI bridge的网络插件，也是目前推荐的默认插件
* CNI：CNI网络插件，需要用户将网络配置放到`/etc/cni/net.d`目录中，并将CNI插件的二进制文件放入`/opt/cni/bin`
* ~~exec：通过第三方的可执行文件来为容器配置网络，已在v1.6中移除([#39254](https://github.com/kubernetes/kubernetes/pull/39254))~~

## CNI plugin

安装CNI：

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

yum install -y kubernetes-cni
```

配置CNI brige插件：

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
        "subnet": "10.244.0.0/16",
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

更多CNI网络插件的说明请参考[sdn-handbook CNI 网络插件](https://feisky.gitbooks.io/sdn/container/cni/)。

## calico

```sh
kubectl apply -f http://docs.projectcalico.org/v2.1/getting-started/kubernetes/installation/hosted/kubeadm/1.6/calico.yaml
```

calico详细介绍见[这里](https://sdn.feisky.xyz/container/calico/)。

## flannel

```sh
kubectl create -f https://github.com/coreos/flannel/raw/master/Documentation/kube-flannel-rbac.yml
kubectl create -f https://github.com/coreos/flannel/raw/master/Documentation/kube-flannel.yml
```

flannel详细介绍见[这里](https://sdn.feisky.xyz/container/calico/)。

## weave

```sh
kubectl apply -f https://git.io/weave-kube
```

weave详细介绍见[这里](https://sdn.feisky.xyz/container/weave/)。

## 第三方插件

- [Calico](http://docs.projectcalico.org/v2.0/getting-started/kubernetes/installation/hosted/)是一个基于BGP的三层网络插件，并且也支持Network Policy来实现网络的访问控制。它在每台机器上运行一个vRouter，利用Linux内核来转发网络数据包，并借助iptables实现防火墙等功能。
- [Flannel](https://github.com/coreos/flannel/blob/master/Documentation/kube-flannel.yml)是一个为Kubernetes提供overlay network的网络插件，它基于Linux TUN/TAP，使用UDP封装IP包来创建overlay网络，并借助etcd维护网络的分配情况。
- [Contiv](http://contiv.github.io)是一个基于openvswitch的多租户网络插件，支持VLAN和VXLAN，并基于openflow实现访问控制和QoS的功能。
- [Canal](https://github.com/tigera/canal/tree/master/k8s-install/kubeadm)则是Flannel和Calico联合发布的一个统一网络插件，提供CNI网络插件，并且也支持network policy。
- [Weave Net](https://www.weave.works/docs/net/latest/kube-addon/) provides networking and network policy, will carry on working on both sides of a network partition, and does not require an external database.
- [Romana](http://romana.io/) is a Layer 3 networking solution for pod networks that also supports the NetworkPolicy API.
- [cilium](https://github.com/cilium/cilium): BPF & XDP for containers.
- [ovn-kubernetes](https://github.com/openvswitch/ovn-kubernetes)
- [kuryr-kubernetes](https://github.com/openstack/kuryr-kubernetes)

更多Kubernetes网络插件的说明可以参见[sdn-handbook Kubernetes网络插件](https://feisky.gitbooks.io/sdn/container/kubernetes.html)。

