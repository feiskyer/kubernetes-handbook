# OpenContrail

OpenContrail 是 Juniper 推出的开源网络虚拟化平台，其商业版本为 Contrail。

## 架构

OpenContrail 主要由控制器和 vRouter 组成：

* 控制器提供虚拟网络的配置、控制和分析功能
* vRouter 提供分布式路由，负责虚拟路由器、虚拟网络的建立以及数据转发

![](../../.gitbook/assets/Figure01%20%282%29.png)

vRouter 支持三种模式

* Kernel vRouter：类似于 ovs 内核模块
* DPDK vRouter：类似于 ovs-dpdk
* Netronome Agilio Solution \(商业产品 \)：支持 DPDK, SR-IOV and Express Virtio \(XVIO\)

![](../../.gitbook/assets/image05%20%282%29.png)

**参考文档**

* [http://www.opencontrail.org/opencontrail-architecture-documentation/](http://www.opencontrail.org/opencontrail-architecture-documentation/)
* [http://www.opencontrail.org/network-virtualization-architecture-deep-dive/](http://www.opencontrail.org/network-virtualization-architecture-deep-dive/)
