# Weave: A Powerful Network Fabric for Containers

Weave Net presents a robust container networking solution that operates across multiple hosts. It's designed with a decentralized control plane, where routers (wRouters) on each host establish Full Mesh TCP links and sync control information through a Gossip protocol. This strategy eliminates the need for a centralized Key/Value Store, simplifying deployment. Weave refers to this as "data centric", distinguishing it from an "algorithm centric" approach typical of RAFT or Paxos.

On the data plane, Weave implements an L2 Overlay via UDP encapsulation, supporting two modes:

* *Sleeve mode* operating in user space: Captures packets on the Linux bridge with pcap devices and wraps them with UDP through wRouter. It supports encryption for L2 traffic and Partial Connection, but at the cost of relatively noticeable performance impact.
* *Fastpath mode* operating in kernel space: Employs OVS's odp for VxLAN encapsulation and forwarding. Instead of directly forwarding packets, wRouter manages them through odp flow tables, significantly boosting throughput. However, advanced features like encryption are not supported in this mode.

**Sleeve Mode:**

![](../../.gitbook/assets/1%20%282%29.png)

**Fastpath Mode:**

![](../../.gitbook/assets/2%20%282%29.png)

Service publishing in Weave is also well-executed. wRouter integrates DNS functionality for dynamic service discovery and load balancing. Like the overlay driver in libnetwork, Weave requires each POD to have two network cards—one connected to lb/ovs handling L2 traffic, and the other to docker0 managing Service traffic—with iptables performing NAT behind docker0.

![](../../.gitbook/assets/3%20%282%29.png)

Weave is integrated with mainstream container systems:

* Docker: [https://www.weave.works/docs/net/latest/plugin/](https://www.weave.works/docs/net/latest/plugin/)
* Kubernetes: [https://www.weave.works/docs/net/latest/kube-addon/](https://www.weave.works/docs/net/latest/kube-addon/)
  * `kubectl apply -f https://git.io/weave-kube`
* CNI: [https://www.weave.works/docs/net/latest/cni-plugin/](https://www.weave.works/docs/net/latest/cni-plugin/)
* Prometheus: [https://www.weave.works/docs/net/latest/metrics/](https://www.weave.works/docs/net/latest/metrics/)

## Weave for Kubernetes

```bash
kubectl apply -n kube-system -f "https://cloud.weave.works/k8s/net?k8s-version=$(kubectl version | base64 | tr -d '\n')"
```

This launches the Weave plugin and Network policy controller on all nodes:

```bash
$ ps -ef | grep weave | grep -v grep
root     25147 25131  0 16:22 ?        00:00:00 /bin/sh /home/weave/launch.sh
root     25204 25147  0 16:22 ?        00:00:00 /home/weave/weaver --port=6783 --datapath=datapath --host-root=/host --http-addr=127.0.0.1:6784 --status-addr=0.0.0.0:6782 --docker-api= --no-dns --db-prefix=/weavedb/weave-net --ipalloc-range=10.32.0.0/12 --nickname=ubuntu-0 --ipalloc-init consensus=2 --conn-limit=30 --expect-npc 10.146.0.2 10.146.0.3
root     25669 25654  0 16:22 ?        00:00:00 /usr/bin/weave-npc
```

The result is a container network where:

* All containers are linked to the Weave bridge
* The Weave bridge is connected to the kernel's openvswitch module via veth pairs
* Cross-host containers communicate through openvswitch vxlan
* The policy controller sets network policies for containers using iptables rules

![](../../.gitbook/assets/weave-flow%20%283%29.png)

## Weave Scope: Monitoring and Troubleshooting

Weave Scope is a tool for monitoring containers and troubleshooting, featuring the ability to automatically generate and intelligently group the entire cluster's topology.

It primarily consists of two components: scope-probe and scope-app

```text
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

## Advantages

* Decentralized architecture
* Automatic fault recovery
* Encrypted communication
* Multicast networking

## Drawbacks

* Performance degradation in UDP mode

**References**

* [https://github.com/weaveworks/weave](https://github.com/weaveworks/weave)
* [https://www.weave.works/products/weave-net/](https://www.weave.works/products/weave-net/)
* [https://github.com/weaveworks/scope](https://github.com/weaveworks/scope)
* [https://www.weave.works/guides/monitor-docker-containers/](https://www.weave.works/guides/monitor-docker-containers/)
* [http://www.sdnlab.com/17141.html](http://www.sdnlab.com/17141.html)