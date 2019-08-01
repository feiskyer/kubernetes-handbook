# Calico

[Calico](https://www.projectcalico.org/) 是一個純三層的數據中心網絡方案（不需要 Overlay），並且與 OpenStack、Kubernetes、AWS、GCE 等 IaaS 和容器平臺都有良好的集成。

Calico 在每一個計算節點利用 Linux Kernel 實現了一個高效的 vRouter 來負責數據轉發，而每個 vRouter 通過 BGP 協議負責把自己上運行的 workload 的路由信息像整個 Calico 網絡內傳播——小規模部署可以直接互聯，大規模下可通過指定的 BGP route reflector 來完成。 這樣保證最終所有的 workload 之間的數據流量都是通過 IP 路由的方式完成互聯的。Calico 節點組網可以直接利用數據中心的網絡結構（無論是 L2 或者 L3），不需要額外的 NAT，隧道或者 Overlay Network。

此外，Calico 基於 iptables 還提供了豐富而靈活的網絡 Policy，保證通過各個節點上的 ACLs 來提供 Workload 的多租戶隔離、安全組以及其他可達性限制等功能。

## Calico 架構

![](calico.png)

Calico 主要由 Felix、etcd、BGP client 以及 BGP Route Reflector 組成

1.  Felix，Calico Agent，跑在每臺需要運行 Workload 的節點上，主要負責配置路由及 ACLs 等信息來確保 Endpoint 的連通狀態；
2.  etcd，分佈式鍵值存儲，主要負責網絡元數據一致性，確保 Calico 網絡狀態的準確性；
3.  BGP Client（BIRD）, 主要負責把 Felix 寫入 Kernel 的路由信息分發到當前 Calico 網絡，確保 Workload 間的通信的有效性；
4.  BGP Route Reflector（BIRD），大規模部署時使用，摒棄所有節點互聯的 mesh 模式，通過一個或者多個 BGP Route Reflector 來完成集中式的路由分發。
5.  calico/calico-ipam，主要用作 Kubernetes 的 CNI 插件

![](calico2.png)

## IP-in-IP

Calico 控制平面的設計要求物理網絡得是 L2 Fabric，這樣 vRouter 間都是直接可達的，路由不需要把物理設備當做下一跳。為了支持 L3 Fabric，Calico 推出了 IPinIP 的選項。

## Calico CNI

見 <https://github.com/projectcalico/cni-plugin>。

## Calico CNM

Calico 通過 Pool 和 Profile 的方式實現了 docker CNM 網絡：

1. Pool，定義可用於 Docker Network 的 IP 資源範圍，比如：10.0.0.0/8 或者 192.168.0.0/16；
2. Profile，定義 Docker Network Policy 的集合，由 tags 和 rules 組成；每個 Profile 默認擁有一個和 Profile 名字相同的 Tag，每個 Profile 可以有多個 Tag，以 List 形式保存。

具體實現見 <https://github.com/projectcalico/libnetwork-plugin>。

## Calico Kubernetes

對於使用 kubeadm 創建的 Kubernetes 集群，使用以下配置安裝 calico 時需要配置

- `--pod-network-cidr=192.168.0.0/16`
- `--service-cidr=10.96.0.0/12` （不能與 Calico 網絡重疊）

然後運行

```sh
kubectl apply -f https://docs.projectcalico.org/v3.1/getting-started/kubernetes/installation/hosted/rbac-kdd.yaml
kubectl apply -f https://docs.projectcalico.org/v3.1/getting-started/kubernetes/installation/hosted/kubernetes-datastore/calico-networking/1.7/calico.yaml
```

更詳細的自定義配置方法見 [https://docs.projectcalico.org/v3.0/getting-started/kubernetes](https://docs.projectcalico.org/v3.0/getting-started/kubernetes)。

這會在 Pod 中啟動 Calico-etcd，在所有 Node 上啟動 bird6、felix 以及 confd，並配置 CNI 網絡為 calico 插件：

![](calico-components.png)

```sh
# Calico 相關進程
$ ps -ef | grep calico | grep -v grep
root      9012  8995  0 14:51 ?        00:00:00 /bin/sh -c /usr/local/bin/etcd --name=calico --data-dir=/var/etcd/calico-data --advertise-client-urls=http://$CALICO_ETCD_IP:6666 --listen-client-urls=http://0.0.0.0:6666 --listen-peer-urls=http://0.0.0.0:6667
root      9038  9012  0 14:51 ?        00:00:01 /usr/local/bin/etcd --name=calico --data-dir=/var/etcd/calico-data --advertise-client-urls=http://10.146.0.2:6666 --listen-client-urls=http://0.0.0.0:6666 --listen-peer-urls=http://0.0.0.0:6667
root      9326  9325  0 14:51 ?        00:00:00 bird6 -R -s /var/run/calico/bird6.ctl -d -c /etc/calico/confd/config/bird6.cfg
root      9327  9322  0 14:51 ?        00:00:00 confd -confdir=/etc/calico/confd -interval=5 -watch --log-level=debug -node=http://10.96.232.136:6666 -client-key= -client-cert= -client-ca-keys=
root      9328  9324  0 14:51 ?        00:00:00 bird -R -s /var/run/calico/bird.ctl -d -c /etc/calico/confd/config/bird.cfg
root      9329  9323  1 14:51 ?        00:00:04 calico-felix
```

```sh
# CNI 網絡插件配置
$ cat /etc/cni/net.d/10-calico.conf
{
    "name": "k8s-pod-network",
    "cniVersion": "0.1.0",
    "type": "calico",
    "etcd_endpoints": "http://10.96.232.136:6666",
    "log_level": "info",
    "ipam": {
        "type": "calico-ipam"
    },
    "policy": {
        "type": "k8s",
         "k8s_api_root": "https://10.96.0.1:443",
         "k8s_auth_token": "<token>"
    },
    "kubernetes": {
        "kubeconfig": "/etc/cni/net.d/calico-kubeconfig"
    }
}

$ cat /etc/cni/net.d/calico-kubeconfig
# Kubeconfig file for Calico CNI plugin.
apiVersion: v1
kind: Config
clusters:
- name: local
  cluster:
    insecure-skip-tls-verify: true
users:
- name: calico
contexts:
- name: calico-context
  context:
    cluster: local
    user: calico
current-context: calico-context
```

![](calico-flow.png)

## Calico 的不足

- 既然是三層實現，當然不支持 VRF
- 不支持多租戶網絡的隔離功能，在多租戶場景下會有網絡安全問題
- Calico 控制平面的設計要求物理網絡得是 L2 Fabric，這樣 vRouter 間都是直接可達的

** 參考文檔 **

- https://xuxinkun.github.io/2016/07/22/cni-cnm/
- https://www.projectcalico.org/
- http://blog.dataman-inc.com/shurenyun-docker-133/
