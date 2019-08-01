# SR-IOV

SR-IOV 技術是一種基於硬件的虛擬化解決方案，可提高性能和可伸縮性

> SR-IOV 標準允許在虛擬機之間高效共享 PCIe（Peripheral Component Interconnect Express，快速外設組件互連）設備，並且它是在硬件中實現的，可以獲得能夠與本機性能媲美的 I/O 性能。SR-IOV 規範定義了新的標準，根據該標準，創建的新設備可允許將虛擬機直接連接到 I/O 設備（SR-IOV 規範由 PCI-SIG 在 http://www.pcisig.com 上進行定義和維護）。單個 I/O 資源可由許多虛擬機共享。共享的設備將提供專用的資源，並且還使用共享的通用資源。這樣，每個虛擬機都可訪問唯一的資源。因此，啟用了 SR-IOV 並且具有適當的硬件和 OS 支持的 PCIe 設備（例如以太網端口）可以顯示為多個單獨的物理設備，每個都具有自己的 PCIe 配置空間。

SR-IOV主要用於虛擬化中，當然也可以用於容器。

![](sriov.png)

## SR-IOV配置

```sh
modprobe ixgbevf
lspci -Dvmm|grep -B 1 -A 4 Ethernet
echo 2 > /sys/bus/pci/devices/0000:82:00.0/sriov_numvfs
# check ifconfig -a. You should see a number of new interfaces created, starting with “eth”, e.g. eth4
```

## docker sriov plugin

Intel給docker寫了一個SR-IOV network plugin，源碼位於[https://github.com/clearcontainers/sriov](https://github.com/clearcontainers/sriov)，同時支持runc和clearcontainer。

## CNI插件

Intel維護了一個SR-IOV的[CNI插件](https://github.com/Intel-Corp/sriov-cni)，fork自[hustcat/sriov-cni](https://github.com/hustcat/sriov-cni)，並擴展了DPDK的支持。

項目主頁見<https://github.com/Intel-Corp/sriov-cni>。

## 優點

- 性能好
- 不佔用計算資源

## 缺點

- VF數量有限
- 硬件綁定，不支持容器遷移



**參考文檔**

- <http://blog.scottlowe.org/2009/12/02/what-is-sr-iov/>
- <https://github.com/clearcontainers/sriov>
- <https://software.intel.com/en-us/articles/single-root-inputoutput-virtualization-sr-iov-with-linux-containers>
- <http://jason.digitalinertia.net/exposing-docker-containers-with-sr-iov/>
