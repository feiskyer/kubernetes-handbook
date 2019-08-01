# Network Policy 擴展

[Network Policy](../concepts/network-policy.md) 提供了基於策略的網絡控制，用於隔離應用並減少攻擊面。它使用標籤選擇器模擬傳統的分段網絡，並通過策略控制它們之間的流量以及來自外部的流量。Network Policy 需要網絡插件來監測這些策略和 Pod 的變更，併為 Pod 配置流量控制。

## 如何開發 Network Policy 擴展

實現一個支持 Network Policy 的網絡擴展需要至少包含兩個組件

- CNI 網絡插件：負責給 Pod 配置網絡接口
- Policy controller：監聽 Network Policy 的變化，並將 Policy 應用到相應的網絡接口

![](images/policy-controller.jpg)

## 支持 Network Policy 的網絡插件

- [Calico](https://www.projectcalico.org/)
- [Romana](https://github.com/romana/romana)
- [Weave Net](https://www.weave.works/)
- [Trireme](https://github.com/aporeto-inc/trireme-kubernetes)
- [OpenContrail](http://www.opencontrail.org/)

## Network Policy 使用方法

具體 Network Policy 的使用方法可以參考 [這裡](../concepts/network-policy.md)。
