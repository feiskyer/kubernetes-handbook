# Network Policy 扩展

[Network Policy](../concepts/network-policy.md) 提供了基于策略的网络控制，用于隔离应用并减少攻击面。它使用标签选择器模拟传统的分段网络，并通过策略控制它们之间的流量以及来自外部的流量。Network Policy 需要网络插件来监测这些策略和 Pod 的变更，并为 Pod 配置流量控制。

## 如何开发 Network Policy 扩展

实现一个支持 Network Policy 的网络扩展需要至少包含两个组件

- CNI 网络插件：负责给 Pod 配置网络接口
- Policy controller：监听 Network Policy 的变化，并将 Policy 应用到相应的网络接口

![](images/policy-controller.jpg)

## 支持 Network Policy 的网络插件

- [Calico](https://www.projectcalico.org/)
- [Romana](https://github.com/romana/romana)
- [Weave Net](https://www.weave.works/)
- [Trireme](https://github.com/aporeto-inc/trireme-kubernetes)
- [OpenContrail](http://www.opencontrail.org/)

## Network Policy 使用方法

具体 Network Policy 的使用方法可以参考 [这里](../concepts/network-policy.md)。
