# OpenContrail

OpenContrail是Juniper推出的開源網絡虛擬化平臺，其商業版本為Contrail。

## 架構

OpenContrail主要由控制器和vRouter組成：

* 控制器提供虛擬網絡的配置、控制和分析功能
* vRouter提供分佈式路由，負責虛擬路由器、虛擬網絡的建立以及數據轉發

![](Figure01.png)

vRouter支持三種模式

* Kernel vRouter：類似於ovs內核模塊
* DPDK vRouter：類似於ovs-dpdk
* Netronome Agilio Solution (商業產品)：支持DPDK, SR-IOV and Express Virtio (XVIO) 

![](image05.png)

**參考文檔**

- <http://www.opencontrail.org/opencontrail-architecture-documentation/>
- <http://www.opencontrail.org/network-virtualization-architecture-deep-dive/>

