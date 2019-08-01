# Kubernetes 網絡模型

## 網絡模型

- IP-per-Pod，每個 Pod 都擁有一個獨立 IP 地址，Pod 內所有容器共享一個網絡命名空間
- 集群內所有 Pod 都在一個直接連通的扁平網絡中，可通過 IP 直接訪問
  - 所有容器之間無需 NAT 就可以直接互相訪問
  - 所有 Node 和所有容器之間無需 NAT 就可以直接互相訪問
  - 容器自己看到的 IP 跟其他容器看到的一樣
- Service cluster IP 儘可在集群內部訪問，外部請求需要通過 NodePort、LoadBalance 或者 Ingress 來訪問

## 官方插件

目前，Kubernetes 支持以下兩種插件：

* kubenet：這是一個基於 CNI bridge 的網絡插件（在 bridge 插件的基礎上擴展了 port mapping 和 traffic shaping ），是目前推薦的默認插件
* CNI：CNI 網絡插件，需要用戶將網絡配置放到 `/etc/cni/net.d` 目錄中，並將 CNI 插件的二進制文件放入 `/opt/cni/bin`
* ~~exec：通過第三方的可執行文件來為容器配置網絡，已在 v1.6 中移除，見 [kubernetes#39254](https://github.com/kubernetes/kubernetes/pull/39254)~~

## kubenet

kubenet 是一個基於 CNI bridge 的網絡插件，它為每個容器建立一對 veth pair 並連接到 cbr0 網橋上。kubenet 在 bridge 插件的基礎上拓展了很多功能，包括

- 使用 host-local IPAM 插件為容器分配 IP 地址， 並定期釋放已分配但未使用的 IP 地址

- 設置 sysctl `net.bridge.bridge-nf-call-iptables = 1`

- 為 Pod IP 創建 SNAT 規則

  - `-A POSTROUTING ! -d 10.0.0.0/8 -m comment --comment "kubenet: SNAT for outbound traffic from cluster" -m addrtype ! --dst-type LOCAL -j MASQUERADE`

- 開啟網橋的 hairpin 和 promisc 模式，允許 Pod 訪問它自己所在的 Service IP（即通過 NAT 後再訪問 Pod 自己）

  ```sh
  -A OUTPUT -j KUBE-DEDUP
  -A KUBE-DEDUP -p IPv4 -s a:58:a:f4:2:1 -o veth+ --ip-src 10.244.2.1 -j ACCEPT
  -A KUBE-DEDUP -p IPv4 -s a:58:a:f4:2:1 -o veth+ --ip-src 10.244.2.0/24 -j DROP
  ```

- HostPort 管理以及設置端口映射

- Traffic shaping，支持通過 `kubernetes.io/ingress-bandwidth` 和 `kubernetes.io/egress-bandwidth` 等 Annotation 設置 Pod 網絡帶寬限制

下圖是一個 Kubernetes on Azure 多節點的 Pod 之間相互通信的原理：

![image-20190316183639488](assets/image-20190316183639488.png)

跨節點 Pod 之間相互通信時，會通過雲平臺或者交換機配置的路由轉發到正確的節點中：

![image-20190316183650404](assets/image-20190316183650404.png)



未來 kubenet 插件會遷移到標準的 CNI 插件（如 ptp），具體計劃見 [這裡](https://docs.google.com/document/d/1glJLMHrE2eqwRrAN4fdsz4Vg3R1Iqt6bm5GJQ4GdjlQ/edit#)。

## CNI plugin

安裝 CNI：

```sh
cat <<EOF> /etc/yum.repos.d/kubernetes.repo
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

配置 CNI brige 插件：

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
            {"dst": "0.0.0.0/0"}
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

更多 CNI 網絡插件的說明請參考 [CNI 網絡插件](cni/index.md)。

## [Flannel](flannel/index.md)

[Flannel](https://github.com/coreos/flannel/blob/master/Documentation/kube-flannel.yml) 是一個為 Kubernetes 提供 overlay network 的網絡插件，它基於 Linux TUN/TAP，使用 UDP 封裝 IP 包來創建 overlay 網絡，並藉助 etcd 維護網絡的分配情況。

```sh
kubectl create -f https://github.com/coreos/flannel/raw/master/Documentation/kube-flannel-rbac.yml
kubectl create -f https://github.com/coreos/flannel/raw/master/Documentation/kube-flannel.yml
```

## [Weave Net](weave/index.md)

Weave Net 是一個多主機容器網絡方案，支持去中心化的控制平面，各個 host 上的 wRouter 間通過建立 Full Mesh 的 TCP 鏈接，並通過 Gossip 來同步控制信息。這種方式省去了集中式的 K/V Store，能夠在一定程度上減低部署的複雜性，Weave 將其稱為 “data centric”，而非 RAFT 或者 Paxos 的 “algorithm centric”。

數據平面上，Weave 通過 UDP 封裝實現 L2 Overlay，封裝支持兩種模式，一種是運行在 user space 的 sleeve mode，另一種是運行在 kernal space 的 fastpath mode。Sleeve mode 通過 pcap 設備在 Linux bridge 上截獲數據包並由 wRouter 完成 UDP 封裝，支持對 L2 traffic 進行加密，還支持 Partial Connection，但是性能損失明顯。Fastpath mode 即通過 OVS 的 odp 封裝 VxLAN 並完成轉發，wRouter 不直接參與轉發，而是通過下發 odp 流表的方式控制轉發，這種方式可以明顯地提升吞吐量，但是不支持加密等高級功能。

```sh
kubectl apply -f https://git.io/weave-kube
```

## [Calico](calico/index.md)

[Calico](https://www.projectcalico.org/) 是一個基於 BGP 的純三層的數據中心網絡方案（不需要 Overlay），並且與 OpenStack、Kubernetes、AWS、GCE 等 IaaS 和容器平臺都有良好的集成。

Calico 在每一個計算節點利用 Linux Kernel 實現了一個高效的 vRouter 來負責數據轉發，而每個 vRouter 通過 BGP 協議負責把自己上運行的 workload 的路由信息像整個 Calico 網絡內傳播——小規模部署可以直接互聯，大規模下可通過指定的 BGP route reflector 來完成。 這樣保證最終所有的 workload 之間的數據流量都是通過 IP 路由的方式完成互聯的。Calico 節點組網可以直接利用數據中心的網絡結構（無論是 L2 或者 L3），不需要額外的 NAT，隧道或者 Overlay Network。

此外，Calico 基於 iptables 還提供了豐富而靈活的網絡 Policy，保證通過各個節點上的 ACLs 來提供 Workload 的多租戶隔離、安全組以及其他可達性限制等功能。

```sh
kubectl apply -f http://docs.projectcalico.org/v2.1/getting-started/kubernetes/installation/hosted/kubeadm/1.6/calico.yaml
```

## [OVN](ovn-kubernetes.md)

[OVN (Open Virtual Network)](http://openvswitch.org/support/dist-docs/ovn-architecture.7.html) 是 OVS 提供的原生虛擬化網絡方案，旨在解決傳統 SDN 架構（比如 Neutron DVR）的性能問題。

OVN 為 Kubernetes 提供了兩種網絡方案：

* Overaly: 通過 ovs overlay 連接容器
* Underlay: 將 VM 內的容器連到 VM 所在的相同網絡（開發中）

其中，容器網絡的配置是通過 OVN 的 CNI 插件來實現。

## [Contiv](contiv/index.md)

[Contiv](http://contiv.github.io) 是思科開源的容器網絡方案，主要提供基於 Policy 的網絡管理，並與主流容器編排系統集成。Contiv 最主要的優勢是直接提供了多租戶網絡，並支持 L2(VLAN), L3(BGP), Overlay (VXLAN) 以及思科自家的 ACI。

## [Romana](romana/index.md)

Romana 是 Panic Networks 在 2016 年提出的開源項目，旨在借鑑 route aggregation 的思路來解決 Overlay 方案給網絡帶來的開銷。

## [OpenContrail](opencontrail/index.md)

OpenContrail 是 Juniper 推出的開源網絡虛擬化平臺，其商業版本為 Contrail。其主要由控制器和 vRouter 組成：

* 控制器提供虛擬網絡的配置、控制和分析功能
* vRouter 提供分佈式路由，負責虛擬路由器、虛擬網絡的建立以及數據轉發

其中，vRouter 支持三種模式

* Kernel vRouter：類似於 ovs 內核模塊
* DPDK vRouter：類似於 ovs-dpdk
* Netronome Agilio Solution (商業產品)：支持 DPDK, SR-IOV and Express Virtio (XVIO)

[Juniper/contrail-kubernetes](https://github.com/Juniper/contrail-kubernetes) 提供了 Kubernetes 的集成，包括兩部分：

* kubelet network plugin 基於 kubernetes v1.6 已經刪除的 [exec network plugin](https://github.com/kubernetes/kubernetes/pull/39254)
* kube-network-manager 監聽 kubernetes API，並根據 label 信息來配置網絡策略

## [Midonet](midonet/index.md)

[Midonet](https://www.midonet.org/) 是 Midokura 公司開源的 OpenStack 網絡虛擬化方案。

- 從組件來看，Midonet 以 Zookeeper+Cassandra 構建分佈式數據庫存儲 VPC 資源的狀態——Network State DB Cluster，並將 controller 分佈在轉發設備（包括 vswitch 和 L3 Gateway）本地——Midolman（L3 Gateway 上還有 quagga bgpd），設備的轉發則保留了 ovs kernel 作為 fast datapath。可以看到，Midonet 和 DragonFlow、OVN 一樣，在架構的設計上都是沿著 OVS-Neutron-Agent 的思路，將 controller 分佈到設備本地，並在 neutron plugin 和設備 agent 間嵌入自己的資源數據庫作為 super controller。
- 從接口來看，NSDB 與 Neutron 間是 REST API，Midolman 與 NSDB 間是 RPC，這倆沒什麼好說的。Controller 的南向方面，Midolman 並沒有用 OpenFlow 和 OVSDB，它幹掉了 user space 中的 vswitchd 和 ovsdb-server，直接通過 linux netlink 機制操作 kernel space 中的 ovs datapath。

## Host network

最簡單的網絡模型就是讓容器共享 Host 的 network namespace，使用宿主機的網絡協議棧。這樣，不需要額外的配置，容器就可以共享宿主的各種網絡資源。

優點

- 簡單，不需要任何額外配置
- 高效，沒有 NAT 等額外的開銷

缺點

- 沒有任何的網絡隔離
- 容器和 Host 的端口號容易衝突
- 容器內任何網絡配置都會影響整個宿主機

> 注意：HostNetwork 是在 Pod 配置文件中設置的，kubelet 在啟動時還是需要配置使用 CNI 或者 kubenet 插件（默認 kubenet）。

## 其他

### [ipvs](ipvs/index.md)

Kubernetes v1.8 已經支持 ipvs 負載均衡模式（alpha 版）。

### [Canal](https://github.com/tigera/canal)

[Canal](https://github.com/tigera/canal) 是 Flannel 和 Calico 聯合發佈的一個統一網絡插件，提供 CNI 網絡插件，並支持 network policy。

### [kuryr-kubernetes](https://github.com/openstack/kuryr-kubernetes)

[kuryr-kubernetes](https://github.com/openstack/kuryr-kubernetes) 是 OpenStack 推出的集成 Neutron 網絡插件，主要包括 Controller 和 CNI 插件兩部分，並且也提供基於 Neutron LBaaS 的 Service 集成。

### [Cilium](https://github.com/cilium/cilium)

[Cilium](https://github.com/cilium/cilium) 是一個基於 eBPF 和 XDP 的高性能容器網絡方案，提供了 CNI 和 CNM 插件。

項目主頁為 <https://github.com/cilium/cilium>。

### [kope](https://github.com/kopeio/kope-routing)

[kope](https://github.com/kopeio/kope-routing) 是一個旨在簡化 Kubernetes 網絡配置的項目，支持三種模式：

- Layer2：自動為每個 Node 配置路由
- Vxlan：為主機配置 vxlan 連接，並建立主機和 Pod 的連接（通過 vxlan interface 和 ARP entry）
- ipsec：加密鏈接

項目主頁為 <https://github.com/kopeio/kope-routing>。

### [Kube-router](https://github.com/cloudnativelabs/kube-router)

[Kube-router](https://github.com/cloudnativelabs/kube-router) 是一個基於 BGP 的網絡插件，並提供了可選的 ipvs 服務發現（替代 kube-proxy）以及網絡策略功能。

部署 Kube-router：

```sh
kubectl apply -f https://raw.githubusercontent.com/cloudnativelabs/kube-router/master/daemonset/kubeadm-kuberouter.yaml
```

部署 Kube-router 並替換 kube-proxy（這個功能其實不需要了，kube-proxy 已經內置了 ipvs 模式的支持）：

```sh
kubectl apply -f https://raw.githubusercontent.com/cloudnativelabs/kube-router/master/daemonset/kubeadm-kuberouter-all-features.yaml
# Remove kube-proxy
kubectl -n kube-system delete ds kube-proxy
docker run --privileged --net=host gcr.io/google_containers/kube-proxy-amd64:v1.7.3 kube-proxy --cleanup-iptables
```