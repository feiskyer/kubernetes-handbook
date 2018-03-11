# Midonet

[Midonet](https://www.midonet.org/)是Midokura公司开源的OpenStack网络虚拟化方案。

- 从组件来看，Midonet以Zookeeper+Cassandra构建分布式数据库存储VPC资源的状态——Network State DB Cluster，并将controller分布在转发设备（包括vswitch和L3 Gateway）本地——Midolman（L3 Gateway上还有quagga bgpd），设备的转发则保留了ovs kernel作为fast datapath。可以看到，Midonet和DragonFlow、OVN一样，在架构的设计上都是沿着OVS-Neutron-Agent的思路，将controller分布到设备本地，并在neutron plugin和设备agent间嵌入自己的资源数据库作为super controller。
- 从接口来看，NSDB与Neutron间是REST API，Midolman与NSDB间是RPC，这俩没什么好说的。Controller的南向方面，Midolman并没有用OpenFlow和OVSDB，它干掉了user space中的vswitchd和ovsdb-server，直接通过linux netlink机制操作kernel space中的ovs datapath。

![](1.png)

![](2.png)

## Docker/Kubernetes集成

Midonet作为[Kuryr](https://github.com/openstack/kuryr)的一个driver，通过[kuryr-libnetwork](https://github.com/openstack/kuryr-libnetwork)和[kuryr-kubernetes](https://github.com/openstack/kuryr-kubernetes)应用到容器中。

其他方法：

- Midonet通过<https://github.com/midonet/bees>，已不再更新。
- Midonet通过[k8s-midonet](https://github.com/midonet/k8s-midonet)与Kubernetes集成，已不再更新。

**参考文档**

- <https://www.midonet.org/>
- <http://www.sdnlab.com/16974.html>
- <https://blog.midonet.org/introduction-mns-overlay-network-models-part-1-provider-router/>
- <https://blog.midonet.org/introduction-mns-overlay-network-models-part-2-tenant-routers-bridges/>
- <https://docs.midonet.org/docs/latest/reference-architecture/content/index.html>