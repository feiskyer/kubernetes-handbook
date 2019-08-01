# Flannel

[Flannel](https://github.com/coreos/flannel)通過給每臺宿主機分配一個子網的方式為容器提供虛擬網絡，它基於Linux TUN/TAP，使用UDP封裝IP包來創建overlay網絡，並藉助etcd維護網絡的分配情況。

## Flannel原理

控制平面上host本地的flanneld負責從遠端的ETCD集群同步本地和其它host上的subnet信息，併為POD分配IP地址。數據平面flannel通過Backend（比如UDP封裝）來實現L3 Overlay，既可以選擇一般的TUN設備又可以選擇VxLAN設備。

```json
{
    "Network": "10.0.0.0/8",
    "SubnetLen": 20,
    "SubnetMin": "10.10.0.0",
    "SubnetMax": "10.99.0.0",
    "Backend": {
        "Type": "udp",
        "Port": 7890
    }
}
```

![](flannel.png)

除了UDP，Flannel還支持很多其他的Backend：

- udp：使用用戶態udp封裝，默認使用8285端口。由於是在用戶態封裝和解包，性能上有較大的損失
- vxlan：vxlan封裝，需要配置VNI，Port（默認8472）和[GBP](https://github.com/torvalds/linux/commit/3511494ce2f3d3b77544c79b87511a4ddb61dc89)
- host-gw：直接路由的方式，將容器網絡的路由信息直接更新到主機的路由表中，僅適用於二層直接可達的網絡
- aws-vpc：使用 Amazon VPC route table 創建路由，適用於AWS上運行的容器
- gce：使用Google Compute Engine Network創建路由，所有instance需要開啟IP forwarding，適用於GCE上運行的容器
- ali-vpc：使用阿里雲VPC route table 創建路由，適用於阿里雲上運行的容器

## Docker集成

```sh
source /run/flannel/subnet.env
docker daemon --bip=${FLANNEL_SUBNET} --mtu=${FLANNEL_MTU} &
```

## CNI集成

CNI flannel插件會將flannel網絡配置轉換為bridge插件配置，並調用bridge插件給容器netns配置網絡。比如下面的flannel配置

```json
{
    "name": "mynet",
    "type": "flannel",
    "delegate": {
        "bridge": "mynet0",
        "mtu": 1400
    }
}
```

會被cni flannel插件轉換為

```json
{
	"name": "mynet",
	"type": "bridge",
	"mtu": 1472,
	"ipMasq": false,
	"isGateway": true,
	"ipam": {
		"type": "host-local",
		"subnet": "10.1.17.0/24"
	}
}
```

## Kubernetes集成

使用flannel前需要配置` kube-controller-manager --allocate-node-cidrs=true --cluster-cidr=10.244.0.0/16`。

```sh
kubectl apply -f https://raw.githubusercontent.com/coreos/flannel/master/Documentation/kube-flannel.yml
```

這會啟動flanneld容器，並配置CNI網絡插件：

```sh
$ ps -ef | grep flannel | grep -v grep
root      3625  3610  0 13:57 ?        00:00:00 /opt/bin/flanneld --ip-masq --kube-subnet-mgr
root      9640  9619  0 13:51 ?        00:00:00 /bin/sh -c set -e -x; cp -f /etc/kube-flannel/cni-conf.json /etc/cni/net.d/10-flannel.conf; while true; do sleep 3600; done

$ cat /etc/cni/net.d/10-flannel.conf
{
  "name": "cbr0",
  "type": "flannel",
  "delegate": {
    "isDefaultGateway": true
  }
}
```

![](flannel-components.png)

flanneld自動連接kubernetes API，根據`node.Spec.PodCIDR`配置本地的flannel網絡子網，併為容器創建vxlan和相關的子網路由。

```sh
$ cat /run/flannel/subnet.env
FLANNEL_NETWORK=10.244.0.0/16
FLANNEL_SUBNET=10.244.0.1/24
FLANNEL_MTU=1410
FLANNEL_IPMASQ=true

$ ip -d link show flannel.1
12: flannel.1: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1410 qdisc noqueue state UNKNOWN mode DEFAULT group default
    link/ether 8e:5a:0d:07:0f:0d brd ff:ff:ff:ff:ff:ff promiscuity 0
    vxlan id 1 local 10.146.0.2 dev ens4 srcport 0 0 dstport 8472 nolearning ageing 300 udpcsum addrgenmode eui64
```

![](flannel-network.png)

## 優點

- 配置安裝簡單，使用方便
- 與雲平臺集成較好，VPC的方式沒有額外的性能損失

## 缺點

- VXLAN模式對zero-downtime restarts支持不好

> When running with a backend other than udp, the kernel is providing the data path with flanneld acting as the control plane. As such, flanneld can be restarted (even to do an upgrade) without disturbing existing flows. However in the case of vxlan backend, this needs to be done within a few seconds as ARP entries can start to timeout requiring the flannel daemon to refresh them. Also, to avoid interruptions during restart, the configuration must not be changed (e.g. VNI, --iface values).



**參考文檔**

- <https://github.com/coreos/flannel>
- <https://coreos.com/flannel/docs/latest/>

