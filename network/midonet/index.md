# Midonet

[Midonet](https://www.midonet.org/) is an open-source network virtualization solution for OpenStack, developed by Midokura.

- In terms of components, Midonet uses Zookeeper+Cassandra to construct a distributed database (Network State DB Cluster) to store the state of VPC resources. It distributes controllers to the local sites of forwarding devices (including vswitches and L3 Gateways) as Midolman (with quagga bgpd also present on L3 Gateway). The device forwarding retains ovs kernel for a fast datapath. It is evident that Midonet, like DragonFlow and OVN, has designed its architecture following the OVS-Neutron-Agent approach, decentralizing the controller to local devices and embedding its resource database between the neutron plugin and device agent as a super controller.
- Regarding interfaces, the communication between NSDB and Neutron is via REST API, and between Midolman and NSDB is via RPC, which are straightforward. On the southbound side of the controller, Midolman doesn't use OpenFlow or OVSDB. Instead, it eliminates the vswitchd and ovsdb-server in user space and operates the ovs datapath in kernel space directly through the linux netlink mechanism.

![](1.png)

![](2.png)

## Docker/Kubernetes Integration

Midonet serves as a driver within [Kuryr](https://github.com/openstack/kuryr), applied to containers through [kuryr-libnetwork](https://github.com/openstack/kuryr-libnetwork) and [kuryr-kubernetes](https://github.com/openstack/kuryr-kubernetes).

Other methods:

- Midonet integrated through <https://github.com/midonet/bees>, no longer updated.
- Midonet interoperation with Kubernetes via [k8s-midonet](https://github.com/midonet/k8s-midonet), no longer updated.

**Reference Documents**

- <https://www.midonet.org/>
- <http://www.sdnlab.com/16974.html>
- <https://blog.midonet.org/introduction-mns-overlay-network-models-part-1-provider-router/>
- <https://blog.midonet.org/introduction-mns-overlay-network-models-part-2-tenant-routers-bridges/>
- <https://docs.midonet.org/docs/latest/reference-architecture/content/index.html>