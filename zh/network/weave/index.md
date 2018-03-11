# Weave Net

Weave Net是一个多主机容器网络方案，支持去中心化的控制平面，各个host上的wRouter间通过建立Full Mesh的TCP链接，并通过Gossip来同步控制信息。这种方式省去了集中式的K/V Store，能够在一定程度上减低部署的复杂性，Weave将其称为“data centric”，而非RAFT或者Paxos的“algorithm centric”。

数据平面上，Weave通过UDP封装实现L2 Overlay，封装支持两种模式：

- 运行在user space的sleeve mode：通过pcap设备在Linux bridge上截获数据包并由wRouter完成UDP封装，支持对L2 traffic进行加密，还支持Partial Connection，但是性能损失明显。
- 运行在kernal space的 fastpath mode：即通过OVS的odp封装VxLAN并完成转发，wRouter不直接参与转发，而是通过下发odp 流表的方式控制转发，这种方式可以明显地提升吞吐量，但是不支持加密等高级功能。

Sleeve Mode:

![](1.png)

Fastpath Mode:

![](2.png)

关于Service的发布，weave做的也比较完整。首先，wRouter集成了DNS功能，能够动态地进行服务发现和负载均衡，另外，与libnetwork 的overlay driver类似，weave要求每个POD有两个网卡，一个就连在lb/ovs上处理L2 流量，另一个则连在docker0上处理Service流量，docker0后面仍然是iptables作NAT。

![](3.png)

Weave已经集成了主流的容器系统

- Docker: https://www.weave.works/docs/net/latest/plugin/
- Kubernetes: https://www.weave.works/docs/net/latest/kube-addon/
  - `kubectl apply -f https://git.io/weave-kube`
- CNI: https://www.weave.works/docs/net/latest/cni-plugin/
- Prometheus: https://www.weave.works/docs/net/latest/metrics/

## Weave Kubernetes

```sh
kubectl apply -n kube-system -f "https://cloud.weave.works/k8s/net?k8s-version=$(kubectl version | base64 | tr -d '\n')"
```

这会在所有Node上启动Weave插件以及Network policy controller：

```sh
$ ps -ef | grep weave | grep -v grep
root     25147 25131  0 16:22 ?        00:00:00 /bin/sh /home/weave/launch.sh
root     25204 25147  0 16:22 ?        00:00:00 /home/weave/weaver --port=6783 --datapath=datapath --host-root=/host --http-addr=127.0.0.1:6784 --status-addr=0.0.0.0:6782 --docker-api= --no-dns --db-prefix=/weavedb/weave-net --ipalloc-range=10.32.0.0/12 --nickname=ubuntu-0 --ipalloc-init consensus=2 --conn-limit=30 --expect-npc 10.146.0.2 10.146.0.3
root     25669 25654  0 16:22 ?        00:00:00 /usr/bin/weave-npc
```

这样，容器网络为

- 所有容器都连接到weave网桥
- weave网桥通过veth pair连到内核的openvswitch模块
- 跨主机容器通过openvswitch vxlan通信
- policy controller通过配置iptables规则为容器设置网络策略

![](weave-flow.png)

## Weave Scope

Weave Scope是一个容器监控和故障排查工具，可以方便的生成整个集群的拓扑并智能分组（Automatic Topologies and Intelligent Grouping）。

Weave Scope主要由scope-probe和scope-app组成

```
+--Docker host----------+
|  +--Container------+  |    .---------------.
|  |                 |  |    | Browser       |
|  |  +-----------+  |  |    |---------------|
|  |  | scope-app |<---------|               |
|  |  +-----------+  |  |    |               |
|  |        ^        |  |    |               |
|  |        |        |  |    '---------------'
|  | +-------------+ |  |
|  | | scope-probe | |  |
|  | +-------------+ |  |
|  |                 |  |
|  +-----------------+  |
+-----------------------+
```

## 优点

- 去中心化
- 故障自动恢复
- 加密通信
- Multicast networking

## 缺点

- UDP模式性能损失较大



**参考文档**

- <https://github.com/weaveworks/weave>
- <https://www.weave.works/products/weave-net/>
- <https://github.com/weaveworks/scope>
- <https://www.weave.works/guides/monitor-docker-containers/>
- <http://www.sdnlab.com/17141.html>

