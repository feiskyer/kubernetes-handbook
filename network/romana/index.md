# Romana

Romana是Panic Networks在2016年提出的开源项目，旨在解决Overlay方案给网络带来的开销。

## 工作原理

![](romana.png)

![](routeagg.png)

- layer 3 networking，消除overlay带来的开销
- 基于iptables ACL的网络隔离
- 基于hierarchy CIDR管理Host/Tenant/Segment ID

![](cidr.png)

## 优点

- 纯三层网络，性能好

## 缺点

- 基于IP管理租户，有规模上的限制
- 物理设备变更或地址规划变更麻烦

**参考文档**

- <http://romana.io/>
- <https://github.com/romana/romana>
- <http://romana.io/how/background/>

