# CNI (Container Network Interface)

Container Network Interface (CNI) 最早是由CoreOS發起的容器網絡規範，是Kubernetes網絡插件的基礎。其基本思想為：Container Runtime在創建容器時，先創建好network namespace，然後調用CNI插件為這個netns配置網絡，其後再啟動容器內的進程。現已加入CNCF，成為CNCF主推的網絡模型。

CNI插件包括兩部分：

- CNI Plugin負責給容器配置網絡，它包括兩個基本的接口
  - 配置網絡: AddNetwork(net *NetworkConfig, rt *RuntimeConf) (types.Result, error)
  - 清理網絡: DelNetwork(net *NetworkConfig, rt *RuntimeConf) error
- IPAM Plugin負責給容器分配IP地址，主要實現包括host-local和dhcp。

Kubernetes Pod 中的其他容器都是Pod所屬pause容器的網絡，創建過程為：

1. kubelet 先創建pause容器生成network namespace
2. 調用網絡CNI driver
3. CNI driver 根據配置調用具體的cni 插件
4. cni 插件給pause 容器配置網絡
5. pod 中其他的容器都使用 pause 容器的網絡

![](Chart_Container-Network-Interface-Drivers.png)

所有CNI插件均支持通過環境變量和標準輸入傳入參數：

```sh
$ echo '{"cniVersion": "0.3.1","name": "mynet","type": "macvlan","bridge": "cni0","isGateway": true,"ipMasq": true,"ipam": {"type": "host-local","subnet": "10.244.1.0/24","routes": [{ "dst": "0.0.0.0/0" }]}}' | sudo CNI_COMMAND=ADD CNI_NETNS=/var/run/netns/a CNI_PATH=./bin CNI_IFNAME=eth0 CNI_CONTAINERID=a CNI_VERSION=0.3.1 ./bin/bridge

$ echo '{"cniVersion": "0.3.1","type":"IGNORED", "name": "a","ipam": {"type": "host-local", "subnet":"10.1.2.3/24"}}' | sudo CNI_COMMAND=ADD CNI_NETNS=/var/run/netns/a CNI_PATH=./bin CNI_IFNAME=a CNI_CONTAINERID=a CNI_VERSION=0.3.1 ./bin/host-local
```

常見的CNI網絡插件有

![](cni-plugins.png)

**CNI Plugin Chains**

CNI還支持Plugin Chains，即指定一個插件列表，由Runtime依次執行每個插件。這對支持端口映射（portmapping）、虛擬機等非常有幫助。配置方法可以參考後面的[端口映射示例](#端口映射示例)。

## Bridge

Bridge是最簡單的CNI網絡插件，它首先在Host創建一個網橋，然後再通過veth pair連接該網橋到container netns。

![](cni-bridge.png)

注意：**Bridge模式下，多主機網絡通信需要額外配置主機路由，或使用overlay網絡**。可以藉助[Flannel](../flannel/index.html)或者Quagga動態路由等來自動配置。比如overlay情況下的網絡結構為

![](cni-overlay.png)

配置示例

```json
{
    "cniVersion": "0.3.0",
    "name": "mynet",
    "type": "bridge",
    "bridge": "mynet0",
    "isDefaultGateway": true,
    "forceAddress": false,
    "ipMasq": true,
    "hairpinMode": true,
    "ipam": {
        "type": "host-local",
        "subnet": "10.10.0.0/16"
    }
}
```

```
# export CNI_PATH=/opt/cni/bin
# ip netns add ns
# /opt/cni/bin/cnitool add mynet /var/run/netns/ns
{
    "interfaces": [
        {
            "name": "mynet0",
            "mac": "0a:58:0a:0a:00:01"
        },
        {
            "name": "vethc763e31a",
            "mac": "66:ad:63:b4:c6:de"
        },
        {
            "name": "eth0",
            "mac": "0a:58:0a:0a:00:04",
            "sandbox": "/var/run/netns/ns"
        }
    ],
    "ips": [
        {
            "version": "4",
            "interface": 2,
            "address": "10.10.0.4/16",
            "gateway": "10.10.0.1"
        }
    ],
    "routes": [
        {
            "dst": "0.0.0.0/0",
            "gw": "10.10.0.1"
        }
    ],
    "dns": {}
}
# ip netns exec ns ip addr
1: lo: <LOOPBACK> mtu 65536 qdisc noop state DOWN group default qlen 1
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
9: eth0@if8: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default
    link/ether 0a:58:0a:0a:00:04 brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet 10.10.0.4/16 scope global eth0
       valid_lft forever preferred_lft forever
    inet6 fe80::8c78:6dff:fe19:f6bf/64 scope link tentative dadfailed
       valid_lft forever preferred_lft forever
# ip netns exec ns ip route
default via 10.10.0.1 dev eth0
10.10.0.0/16 dev eth0  proto kernel  scope link  src 10.10.0.4
```

## IPAM

### DHCP

DHCP插件是最主要的IPAM插件之一，用來通過DHCP方式給容器分配IP地址，在macvlan插件中也會用到DHCP插件。

在使用DHCP插件之前，需要先啟動dhcp daemon:

```sh
/opt/cni/bin/dhcp daemon &
```

然後配置網絡使用dhcp作為IPAM插件

```json
{
    ...
    "ipam": {
        "type": "dhcp",
    }
}
```

### host-local

host-local是最常用的CNI IPAM插件，用來給container分配IP地址。

IPv4:

```json
{
	"ipam": {
		"type": "host-local",
		"subnet": "10.10.0.0/16",
		"rangeStart": "10.10.1.20",
		"rangeEnd": "10.10.3.50",
		"gateway": "10.10.0.254",
		"routes": [
			{ "dst": "0.0.0.0/0" },
			{ "dst": "192.168.0.0/16", "gw": "10.10.5.1" }
		],
		"dataDir": "/var/my-orchestrator/container-ipam-state"
	}
}
```

IPv6:

```json
{
  "ipam": {
		"type": "host-local",
		"subnet": "3ffe:ffff:0:01ff::/64",
		"rangeStart": "3ffe:ffff:0:01ff::0010",
		"rangeEnd": "3ffe:ffff:0:01ff::0020",
		"routes": [
			{ "dst": "3ffe:ffff:0:01ff::1/64" }
		],
		"resolvConf": "/etc/resolv.conf"
	}
}
```

## ptp

ptp插件通過veth pair給容器和host創建點對點連接：veth pair一端在container netns內，另一端在host上。可以通過配置host端的IP和路由來讓ptp連接的容器之前通信。

```json
{
	"name": "mynet",
	"type": "ptp",
	"ipam": {
		"type": "host-local",
		"subnet": "10.1.1.0/24"
	},
	"dns": {
		"nameservers": [ "10.1.1.1", "8.8.8.8" ]
	}
}
```

## IPVLAN

IPVLAN 和 MACVLAN 類似，都是從一個主機接口虛擬出多個虛擬網絡接口。一個重要的區別就是所有的虛擬接口都有相同的 mac 地址，而擁有不同的 ip 地址。因為所有的虛擬接口要共享 mac 地址，所以有些需要注意的地方：

- DHCP 協議分配 ip 的時候一般會用 mac 地址作為機器的標識。這個情況下，客戶端動態獲取 ip 的時候需要配置唯一的 ClientID 字段，並且 DHCP server 也要正確配置使用該字段作為機器標識，而不是使用 mac 地址

IPVLAN支持兩種模式：

- L2 模式：此時跟macvlan bridge 模式工作原理很相似，父接口作為交換機來轉發子接口的數據。同一個網絡的子接口可以通過父接口來轉發數據，而如果想發送到其他網絡，報文則會通過父接口的路由轉發出去。
- L3 模式：此時ipvlan 有點像路由器的功能，它在各個虛擬網絡和主機網絡之間進行不同網絡報文的路由轉發工作。只要父接口相同，即使虛擬機/容器不在同一個網絡，也可以互相 ping 通對方，因為 ipvlan 會在中間做報文的轉發工作。注意 L3 模式下的虛擬接口 不會接收到多播或者廣播的報文（這個模式下，所有的網絡都會發送給父接口，所有的 ARP 過程或者其他多播報文都是在底層的父接口完成的）。另外外部網絡默認情況下是不知道 ipvlan 虛擬出來的網絡的，如果不在外部路由器上配置好對應的路由規則，ipvlan 的網絡是不能被外部直接訪問的。

創建ipvlan的簡單方法為

```
ip link add link <master-dev> <slave-dev> type ipvlan mode { l2 | L3 }
```

cni配置格式為

```
{
    "name": "mynet",
    "type": "ipvlan",
    "master": "eth0",
    "ipam": {
        "type": "host-local",
        "subnet": "10.1.2.0/24"
    }
}
```

需要注意的是

- ipvlan插件下，容器不能跟Host網絡通信
- 主機接口（也就是master interface）不能同時作為ipvlan和macvlan的master接口

## MACVLAN

MACVLAN可以從一個主機接口虛擬出多個macvtap，且每個macvtap設備都擁有不同的mac地址（對應不同的linux字符設備）。MACVLAN支持四種模式

- bridge模式：數據可以在同一master設備的子設備之間轉發
- vepa模式：VEPA 模式是對 802.1Qbg 標準中的 VEPA 機制的軟件實現，MACVTAP 設備簡單的將數據轉發到master設備中，完成數據匯聚功能，通常需要外部交換機支持 Hairpin 模式才能正常工作
- private模式：Private 模式和 VEPA 模式類似，區別是子 MACVTAP 之間相互隔離
- passthrough模式：內核的 MACVLAN 數據處理邏輯被跳過，硬件決定數據如何處理，從而釋放了 Host CPU 資源

創建macvlan的簡單方法為

```sh
ip link add link <master-dev> name macvtap0 type macvtap
```

cni配置格式為

```
{
	"name": "mynet",
	"type": "macvlan",
	"master": "eth0",
	"ipam": {
		"type": "dhcp"
	}
}
```

需要注意的是

- macvlan需要大量 mac 地址，每個虛擬接口都有自己的 mac 地址
- 無法和 802.11(wireless) 網絡一起工作
- 主機接口（也就是master interface）不能同時作為ipvlan和macvlan的master接口

## [Flannel](../flannel/index.md)

[Flannel](https://github.com/coreos/flannel)通過給每臺宿主機分配一個子網的方式為容器提供虛擬網絡，它基於Linux TUN/TAP，使用UDP封裝IP包來創建overlay網絡，並藉助etcd維護網絡的分配情況。

## [Weave Net](../weave/index.md)

Weave Net是一個多主機容器網絡方案，支持去中心化的控制平面，各個host上的wRouter間通過建立Full Mesh的TCP鏈接，並通過Gossip來同步控制信息。這種方式省去了集中式的K/V Store，能夠在一定程度上減低部署的複雜性，Weave將其稱為“data centric”，而非RAFT或者Paxos的“algorithm centric”。

數據平面上，Weave通過UDP封裝實現L2 Overlay，封裝支持兩種模式，一種是運行在user space的sleeve mode，另一種是運行在kernal space的 fastpath mode。Sleeve mode通過pcap設備在Linux bridge上截獲數據包並由wRouter完成UDP封裝，支持對L2 traffic進行加密，還支持Partial Connection，但是性能損失明顯。Fastpath mode即通過OVS的odp封裝VxLAN並完成轉發，wRouter不直接參與轉發，而是通過下發odp 流表的方式控制轉發，這種方式可以明顯地提升吞吐量，但是不支持加密等高級功能。

## [Contiv](../contiv/index.md)

[Contiv](http://contiv.github.io)是思科開源的容器網絡方案，主要提供基於Policy的網絡管理，並與主流容器編排系統集成。Contiv最主要的優勢是直接提供了多租戶網絡，並支持L2(VLAN), L3(BGP), Overlay (VXLAN)以及思科自家的ACI。

## [Calico](../calico/index.md)

[Calico](https://www.projectcalico.org/) 是一個基於BGP的純三層的數據中心網絡方案（不需要Overlay），並且與OpenStack、Kubernetes、AWS、GCE等IaaS和容器平臺都有良好的集成。

Calico在每一個計算節點利用Linux Kernel實現了一個高效的vRouter來負責數據轉發，而每個vRouter通過BGP協議負責把自己上運行的workload的路由信息像整個Calico網絡內傳播——小規模部署可以直接互聯，大規模下可通過指定的BGP route reflector來完成。 這樣保證最終所有的workload之間的數據流量都是通過IP路由的方式完成互聯的。Calico節點組網可以直接利用數據中心的網絡結構（無論是L2或者L3），不需要額外的NAT，隧道或者Overlay Network。

此外，Calico基於iptables還提供了豐富而靈活的網絡Policy，保證通過各個節點上的ACLs來提供Workload的多租戶隔離、安全組以及其他可達性限制等功能。

## [OVN](../ovn-kubernetes.md)

[OVN (Open Virtual Network)](http://openvswitch.org/support/dist-docs/ovn-architecture.7.html) 是OVS提供的原生虛擬化網絡方案，旨在解決傳統SDN架構（比如Neutron DVR）的性能問題。

OVN為Kubernetes提供了兩種網絡方案：

* Overaly: 通過ovs overlay連接容器
* Underlay: 將VM內的容器連到VM所在的相同網絡（開發中）

其中，容器網絡的配置是通過OVN的CNI插件來實現。

## SR-IOV

Intel維護了一個SR-IOV的[CNI插件](https://github.com/Intel-Corp/sriov-cni)，fork自[hustcat/sriov-cni](https://github.com/hustcat/sriov-cni)，並擴展了DPDK的支持。

項目主頁見<https://github.com/Intel-Corp/sriov-cni>。

## [Romana](../romana/index.md)

Romana是Panic Networks在2016年提出的開源項目，旨在借鑑 route aggregation的思路來解決Overlay方案給網絡帶來的開銷。

## [OpenContrail](../opencontrail/index.md)

OpenContrail是Juniper推出的開源網絡虛擬化平臺，其商業版本為Contrail。其主要由控制器和vRouter組成：

* 控制器提供虛擬網絡的配置、控制和分析功能
* vRouter提供分佈式路由，負責虛擬路由器、虛擬網絡的建立以及數據轉發

其中，vRouter支持三種模式

* Kernel vRouter：類似於ovs內核模塊
* DPDK vRouter：類似於ovs-dpdk
* Netronome Agilio Solution (商業產品)：支持DPDK, SR-IOV and Express Virtio (XVIO)

[michaelhenkel/opencontrail-cni-plugin](https://github.com/michaelhenkel/opencontrail-cni-plugin)提供了一個OpenContrail的CNI插件。

### Network Configuration Lists

[CNI SPEC](https://github.com/containernetworking/cni/blob/master/SPEC.md#network-configuration-lists) 支持指定網絡配置列表，包含多個網絡插件，由 Runtime 依次執行。注意

- ADD 操作，按順序依次調用每個插件；而 DEL 操作調用順序相反
- ADD 操作，除最後一個插件，前面每個插件需要增加 `prevResult` 傳遞給其後的插件
- 第一個插件必須要包含 ipam 插件

### 端口映射示例

下面的例子展示了 bridge+[portmap](https://github.com/containernetworking/plugins/tree/master/plugins/meta/portmap) 插件的用法。

首先，配置 CNI 網絡使用 bridge+portmap 插件：

```sh
# cat /root/mynet.conflist
{
  "name": "mynet",
  "cniVersion": "0.3.0",
  "plugins": [
    {
      "type": "bridge",
      "bridge": "mynet",
      "ipMasq": true,
      "isGateway": true,
      "ipam": {
      "type": "host-local",
      "subnet": "10.244.10.0/24",
      "routes": [
          {"dst": "0.0.0.0/0"}
      ]
      }
    },
    {
       "type": "portmap",
       "capabilities": {"portMappings": true}
    }
  ]
}
```

然後通過 `CAP_ARGS` 設置端口映射參數：

```sh
# export CAP_ARGS='{
    "portMappings": [
        {
            "hostPort":      9090,
            "containerPort": 80,
            "protocol":      "tcp",
            "hostIP":        "127.0.0.1"
        }
    ]
}'
```

測試添加網絡接口：

```sh
# ip netns add test
# CNI_PATH=/opt/cni/bin NETCONFPATH=/root ./cnitool add mynet /var/run/netns/test
{
    "interfaces": [
        {
            "name": "mynet",
            "mac": "0a:58:0a:f4:0a:01"
        },
        {
            "name": "veth2cfb1d64",
            "mac": "4a:dc:1f:b7:56:b1"
        },
        {
            "name": "eth0",
            "mac": "0a:58:0a:f4:0a:07",
            "sandbox": "/var/run/netns/test"
        }
    ],
    "ips": [
        {
            "version": "4",
            "interface": 2,
            "address": "10.244.10.7/24",
            "gateway": "10.244.10.1"
        }
    ],
    "routes": [
        {
            "dst": "0.0.0.0/0"
        }
    ],
    "dns": {}
}
```

可以從 iptables 規則中看到添加的規則：

```sh
# iptables-save | grep 10.244.10.7
-A CNI-DN-be1eedf7a76853f303ebd -d 127.0.0.1/32 -p tcp -m tcp --dport 9090 -j DNAT --to-destination 10.244.10.7:80
-A CNI-SN-be1eedf7a76853f303ebd -s 127.0.0.1/32 -d 10.244.10.7/32 -p tcp -m tcp --dport 80 -j MASQUERADE
```

最後，清理網絡接口：

```
# CNI_PATH=/opt/cni/bin NETCONFPATH=/root ./cnitool del mynet /var/run/netns/test
```

## 其他

### [Canal](https://github.com/tigera/canal)

[Canal](https://github.com/tigera/canal)是Flannel和Calico聯合發佈的一個統一網絡插件，提供CNI網絡插件，並支持network policy。

### [kuryr-kubernetes](https://github.com/openstack/kuryr-kubernetes)

[kuryr-kubernetes](https://github.com/openstack/kuryr-kubernetes)是OpenStack推出的集成Neutron網絡插件，主要包括Controller和CNI插件兩部分，並且也提供基於Neutron LBaaS的Service集成。

### [Cilium](https://github.com/cilium/cilium)

[Cilium](https://github.com/cilium/cilium)是一個基於eBPF和XDP的高性能容器網絡方案，提供了CNI和CNM插件。

項目主頁為<https://github.com/cilium/cilium>。

## [CNI-Genie](https://github.com/Huawei-PaaS/CNI-Genie)

[CNI-Genie](https://github.com/Huawei-PaaS/CNI-Genie)是華為PaaS團隊推出的同時支持多種網絡插件（支持calico, canal, romana, weave等）的CNI插件。

項目主頁為<https://github.com/Huawei-PaaS/CNI-Genie>。
