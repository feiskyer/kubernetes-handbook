# Network Policy扩展

[Network Policy](../concepts/network-policy.md)提供了基于策略的网络控制，用于隔离应用并减少攻击面。它使用标签选择器模拟传统的分段网络，并通过策略控制它们之间的流量以及来自外部的流量。Network Policy需要网络插件来监测这些策略和Pod的变更，并为Pod配置流量控制。

## 如何开发Network Policy扩展

实现一个支持Network Policy的网络扩展需要至少包含两个组件

- CNI网络插件：负责给Pod配置网络接口
- Policy controller：监听Network Policy的变化，并将Policy应用到相应的网络接口

![](images/policy-controller.jpg)

## 支持Network Policy的网络插件

- [Calico](https://www.projectcalico.org/)
- [Romana](https://github.com/romana/romana)
- [Weave Net](https://www.weave.works/)
- [Trireme](https://github.com/aporeto-inc/trireme-kubernetes)
- [OpenContrail](http://www.opencontrail.org/)

## Network Policy使用方法

具体Network Policy的使用方法可以参考[这里](../concepts/network-policy.md)。
