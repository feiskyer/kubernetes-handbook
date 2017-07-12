# Calico

[Calico](https://www.projectcalico.org/) 是一个纯三层的数据中心网络方案（不需要Overlay），并且与OpenStack、Kubernetes、AWS、GCE等IaaS和容器平台都有良好的集成。

Calico在每一个计算节点利用Linux Kernel实现了一个高效的vRouter来负责数据转发，而每个vRouter通过BGP协议负责把自己上运行的workload的路由信息像整个Calico网络内传播——小规模部署可以直接互联，大规模下可通过指定的BGP route reflector来完成。 这样保证最终所有的workload之间的数据流量都是通过IP路由的方式完成互联的。Calico节点组网可以直接利用数据中心的网络结构（无论是L2或者L3），不需要额外的NAT，隧道或者Overlay Network。

此外，Calico基于iptables还提供了丰富而灵活的网络Policy，保证通过各个节点上的ACLs来提供Workload的多租户隔离、安全组以及其他可达性限制等功能。

## Calico架构

![](calico.png)

Calico主要由Felix、etcd、BGP client以及BGP Route Reflector组成

1.  Felix，Calico Agent，跑在每台需要运行Workload的节点上，主要负责配置路由及ACLs等信息来确保Endpoint的连通状态；
2.  etcd，分布式键值存储，主要负责网络元数据一致性，确保Calico网络状态的准确性；
3.  BGP Client（BIRD）, 主要负责把Felix写入Kernel的路由信息分发到当前Calico网络，确保Workload间的通信的有效性；
4.  BGP Route Reflector（BIRD），大规模部署时使用，摒弃所有节点互联的 mesh 模式，通过一个或者多个BGP Route Reflector来完成集中式的路由分发。

![](calico2.png)

## IP-in-IP

Calico控制平面的设计要求物理网络得是L2 Fabric，这样vRouter间都是直接可达的，路由不需要把物理设备当做下一跳。为了支持L3 Fabric，Calico推出了IPinIP的选项。

## Calico CNI

见<https://github.com/projectcalico/cni-plugin>。

## Calico CNM

Calico通过Pool和Profile的方式实现了docker CNM网络：

1.  Pool，定义可用于Docker Network的IP资源范围，比如：10.0.0.0/8或者192.168.0.0/16；
2.  Profile，定义Docker Network Policy的集合，由tags和rules组成；每个 Profile默认拥有一个和Profile名字相同的Tag，每个Profile可以有多个Tag，以List形式保存。

具体实现见<https://github.com/projectcalico/libnetwork-plugin>，而使用方法可以参考[http://docs.projectcalico.org/v2.1/getting-started/docker/](http://docs.projectcalico.org/v2.1/getting-started/docker/)。

## Calico Kubernetes

见[http://docs.projectcalico.org/v2.1/getting-started/kubernetes/](http://docs.projectcalico.org/v2.1/getting-started/kubernetes/).

For Kubeadm 1.5 with Kubernetes 1.5.x:

```
kubectl apply -f http://docs.projectcalico.org/v2.3/getting-started/kubernetes/installation/hosted/kubeadm/1.5/calico.yaml
```

For Kubeadm 1.6 with Kubernetes 1.6.x:

```
kubectl apply -f http://docs.projectcalico.org/v2.3/getting-started/kubernetes/installation/hosted/kubeadm/1.6/calico.yaml
```

## Calico的不足

- 既然是三层实现，当然不支持VRF
- 不支持多租户网络的隔离功能，在多租户场景下会有网络安全问题 
- Calico控制平面的设计要求物理网络得是L2 Fabric，这样vRouter间都是直接可达的

**参考文档**

- https://xuxinkun.github.io/2016/07/22/cni-cnm/
- https://www.projectcalico.org/
- http://blog.dataman-inc.com/shurenyun-docker-133/
