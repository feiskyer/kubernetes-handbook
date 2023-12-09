# Unveiling OpenContrail

OpenContrail represents Juniper Networks' venture into the open-source realm of network virtualization, complemented by its commercial counterpart known as Contrail.

## The Blueprint

The OpenContrail infrastructure primarily consists of two pivotal components:

* The **Controller** orchestrates the creation, control, and analytical operations for virtual networks.
* The **vRouter** facilitates distributed routing, eager to manage the establishment of virtual routers and networks, as well as the handling of data forwarding.

![](../../.gitbook/assets/Figure01%20%282%29.png)

The vRouter notably operates in three distinct flavors:

* **Kernel vRouter**: Carries a resemblance to the OVS kernel module.
* **DPDK vRouter**: Mirrors the capabilities of ovs-dpdk.
* **Netronome Agilio Solution (a commercial product)**: Ready to support a trifecta of advanced networking technologies including DPDK, SR-IOV, and Express Virtio (XVIO).

![](../../.gitbook/assets/image05%20%282%29.png)

**Further Reading**

* [Dive into the OpenContrail Architecture](http://www.opencontrail.org/opencontrail-architecture-documentation/)
* [A Deeper Understanding of Network Virtualization Architecture](http://www.opencontrail.org/network-virtualization-architecture-deep-dive/)