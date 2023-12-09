# CNI: The Heart of Container Networking

Originally launched by CoreOS, the Container Network Interface (CNI) has become the core of networking plugins for Kubernetes. At the heart of CNI lies a simple idea: the container runtime should first establish a network namespace (netns), then invoke the CNI plugin to configure the network for this netns, before finally starting the container's processes. Now under the wing of the Cloud Native Computing Foundation (CNCF), it has become the networking model primarily endorsed by the CNCF.

CNI plugins are split into two key components:

- **CNI Plugin**, responsible for setting up the container's network, includes two basic interfaces:
  - Network configuration: `AddNetwork(net_NetworkConfig, rt_RuntimeConf) (types.Result, error)`
  - Network cleanup: `DelNetwork(net_NetworkConfig, rt_RuntimeConf) error`
- **IPAM Plugin**, tasked with allocating IP addresses to the container. It typically implements host-local and DHCP options.

For Kubernetes Pods, the networking setup for containers within the Pod follows the network of the Pod's designated 'pause' container. The creation process involves:

1. kubelet first creates the 'pause' container, generating a network namespace,
2. then triggers the network CNI driver,
3. the CNI driver, based on the configuration, calls the specific CNI plugin,
4. the CNI plugin sets up the network for the 'pause' container,
5. and then all other containers in the Pod use the 'pause' container's network.

![](../../.gitbook/assets/Chart_Container-Network-Interface-Drivers%20(3).png)

All CNI plugins support passing parameters through environment variables and standard input:

```bash
$ echo '{"cniVersion": "0.3.1","name": "mynet","type": "macvlan","bridge": "cni0","isGateway": true,"ipMasq": true,"ipam": {"type": "host-local","subnet": "10.244.1.0/24","routes": [{ "dst": "0.0.0.0/0" }]}}' | sudo CNI_COMMAND=ADD CNI_NETNS=/var/run/netns/a CNI_PATH=./bin CNI_IFNAME=eth0 CNI_CONTAINERID=a CNI_VERSION=0.3.1 ./bin/bridge

$ echo '{"cniVersion": "0.3.1","type":"IGNORED", "name": "a","ipam": {"type": "host-local", "subnet":"10.1.2.3/24"}}' | sudo CNI_COMMAND=ADD CNI_NETNS=/var/run/netns/a CNI_PATH=./bin CNI_IFNAME=a CNI_CONTAINERID=a CNI_VERSION=0.3.1 ./bin/host-local
```

A selection of well-known CNI network plugins:

![](../../.gitbook/assets/cni-plugins%20(2).png)

### CNI Plugin Chains

CNI also supports the concept of Plugin Chains, where a list of plugins is specified, and each is executed in turn by the Runtime. This is particularly useful for supporting features like port mapping and virtual machines. An example configuration method is outlined in the [port mapping example](cni.md#端口映射示例) section below.

## Bridge

The Bridge plugin, one of the simplest CNI network plugins, creates a network bridge on the Host before connecting the container netns via a veth pair.

![](../../.gitbook/assets/cni-bridge%20(1).png)

Important: **In Bridge mode, multi-host network communication requires additional host routing configuration or an overlay network.** Tools like [Flannel](https://github.com/feiskyer/kubernetes-handbook/tree/549e0e3c9ba0175e64b2d4719b5a46e9016d532b/network/flannel/index.html) or Quagga for dynamic routing can be used to automate the process. An overlay network structure example:

![](../../.gitbook/assets/cni-overlay%20(1).png)

Configuration example:

```javascript
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

Testing network setup and teardown with cnitool:

```text
# export CNI_PATH=/opt/cni/bin
# ip netns add ns
# /opt/cni/bin/cnitool add mynet /var/run/netns/ns
... (Output showing network interfaces, IPs, routes, and DNS configuration) ...
# ip netns exec ns ip addr
... (Output showing network interface details inside network namespace 'ns') ...
# ip netns exec ns ip route
... (Output showing routing information inside network namespace 'ns') ...
```

## IPAM

### DHCP

The DHCP plugin is a primary IPAM plugin that assigns IP addresses to containers using DHCP. This plugin is also utilized in the macvlan setup.

To use the DHCP plugin, you first need to start a dhcp daemon:

```bash
/opt/cni/bin/dhcp daemon &
```

Then configure the network to use dhcp as the IPAM plugin:

```javascript
{
    ...
    "ipam": {
        "type": "dhcp",
    }
}
```

### host-local

The host-local plugin is one of the most commonly used CNI IPAM plugins, designed to allocate IP addresses to containers.

IPv4 example:

```javascript
{
    "ipam": {
        "type": "host-local",
        "subnet": "10.10.0.0/16",
        ... (IPv4 configuration details) ...
    }
}
```

IPv6 example:

```javascript
{
    "ipam": {
        "type": "host-local",
        ... (IPv6 configuration details) ...
    }
}
```

## ptp

The ptp (point-to-point) plugin establishes point-to-point connectivity between the container and the host using a veth pair.

Configuration example:

```javascript
{
    "name": "mynet",
    "type": "ptp",
    ... (ptp plugin configuration details) ...
}
```

## IPVLAN

IPVLAN is similar to MACVLAN as it also virtualizes multiple network interfaces from a single host interface. A key difference is that all virtual interfaces share the same MAC address but have unique IP addresses. 

IPVLAN supports two modes:

- L2 mode works similarly to macvlan bridge mode, where the parent interface acts like a switch forwarding data to its child interfaces.
- L3 mode functions more like a router, handling routing of packets between the various virtual networks and the host network.

Creating an ipvlan is straightforward:

```text
ip link add link <master-dev> <slave-dev> type ipvlan mode { l2 | L3 }
```

The CNI configuration looks like:

```text
{
    "name": "mynet",
    "type": "ipvlan",
    "master": "eth0",
    ... (ipvlan plugin configuration details) ...
}
```

It's important to note:

- Containers cannot communicate with the host network under the ipvlan plugin.
- The host interface (the master interface) cannot simultaneously serve as a master for both ipvlan and macvlan.

## MACVLAN

MACVLAN allows virtualization of multiple macvtap devices from a host interface, each with its own unique MAC address.

There are four modes for MACVLAN:

- bridge mode allows data forwarding among children of the same master.
- vepa mode requires external switch support for Hairpin mode.
- private mode ensures isolation among MACVTAPs.
- passthrough mode offloads data handling to hardware, liberating Host CPU resources.

The simple creation method for macvlan is:

```bash
ip link add link <master-dev> name macvtap0 type macvtap
```

The CNI configuration format:

```text
{
    "name": "mynet",
    "type": "macvlan",
    "master": "eth0",
    ... (macvlan plugin configuration details) ...
}
```

Keep in mind:

- macvlan requires many MAC addresses, one per virtual interface.
- It cannot work with 802.11 (wireless) networks.
- The host interface cannot serve as a master for both ipvlan and macvlan.

For further details and other networking solutions, including Flannel, Weave Net, Contiv, Calico, OVN, SR-IOV, Canal, kuryr-kubernetes, Cilium, CNI-Genie, and more, please visit the respective project pages.

### Network Configuration Lists

CNI SPEC supports network configuration lists that include multiple network plugins to be executed by the Runtime in sequence. Note:

- For ADD operations, the plugins are called in order; for DEL operations, the order is reversed.
- For ADD operations, all but the last plugin need to append a `prevResult` to pass to the subsequent plugin.
- The first plugin in the list must include an IPAM plugin.

### Port Mapping Example

An example illustrating the use of the bridge and [portmap](https://github.com/containernetworking/plugins/tree/master/plugins/meta/portmap) plugins.

First, configure the CNI network to use bridge+portmap plugins:

```bash
# cat /root/mynet.conflist
... (Configuration details for bridge+portmap plugins) ...
```

Set port mapping arguments with `CAP_ARGS`:

```bash
# export CAP_ARGS='... (port mapping configurations) ...'
```

Test adding the network interface:

```bash
# ip netns add test
# CNI_PATH=/opt/cni/bin NETCONFPATH=/root ./cnitool add mynet /var/run/netns/test
... (Output of network setup command) ...
```

See added rules in iptables:

```bash
# iptables-save | grep 10.244.10.7
... (Iptables rules related to port mapping) ...
```

Finally, remove the network interface:

```text
# CNI_PATH=/opt/cni/bin NETCONFPATH=/root ./cnitool del mynet /var/run/netns/test
```

Other noteworthy projects include [Canal](https://github.com/tigera/canal), which combines Flannel and Calico, and [CNI-Genie](https://github.com/Huawei-PaaS/CNI-Genie) from Huawei PaaS, which supports multiple network plugins simultaneously.