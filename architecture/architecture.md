# Kubernetes 架構

Kubernetes 最初源於谷歌內部的 Borg，提供了面向應用的容器集群部署和管理系統。Kubernetes 的目標旨在消除編排物理 / 虛擬計算，網絡和存儲基礎設施的負擔，並使應用程序運營商和開發人員完全將重點放在以容器為中心的原語上進行自助運營。Kubernetes 也提供穩定、兼容的基礎（平臺），用於構建定製化的 workflows 和更高級的自動化任務。
Kubernetes 具備完善的集群管理能力，包括多層次的安全防護和准入機制、多租戶應用支撐能力、透明的服務註冊和服務發現機制、內建負載均衡器、故障發現和自我修復能力、服務滾動升級和在線擴容、可擴展的資源自動調度機制、多粒度的資源配額管理能力。
Kubernetes 還提供完善的管理工具，涵蓋開發、部署測試、運維監控等各個環節。

## Borg 簡介

Borg 是谷歌內部的大規模集群管理系統，負責對谷歌內部很多核心服務的調度和管理。Borg 的目的是讓用戶能夠不必操心資源管理的問題，讓他們專注於自己的核心業務，並且做到跨多個數據中心的資源利用率最大化。

Borg 主要由 BorgMaster、Borglet、borgcfg 和 Scheduler 組成，如下圖所示

![borg](images/borg.png)

* BorgMaster 是整個集群的大腦，負責維護整個集群的狀態，並將數據持久化到 Paxos 存儲中；
* Scheduer 負責任務的調度，根據應用的特點將其調度到具體的機器上去；
* Borglet 負責真正運行任務（在容器中）；
* borgcfg 是 Borg 的命令行工具，用於跟 Borg 系統交互，一般通過一個配置文件來提交任務。

## Kubernetes 架構

Kubernetes 借鑑了 Borg 的設計理念，比如 Pod、Service、Labels 和單 Pod 單 IP 等。Kubernetes 的整體架構跟 Borg 非常像，如下圖所示

![architecture](images/architecture.png)

Kubernetes 主要由以下幾個核心組件組成：

- etcd 保存了整個集群的狀態；
- kube-apiserver 提供了資源操作的唯一入口，並提供認證、授權、訪問控制、API 註冊和發現等機制；
- kube-controller-manager 負責維護集群的狀態，比如故障檢測、自動擴展、滾動更新等；
- kube-scheduler 負責資源的調度，按照預定的調度策略將 Pod 調度到相應的機器上；
- kubelet 負責維持容器的生命週期，同時也負責 Volume（CVI）和網絡（CNI）的管理；
- Container runtime 負責鏡像管理以及 Pod 和容器的真正運行（CRI），默認的容器運行時為 Docker；
- kube-proxy 負責為 Service 提供 cluster 內部的服務發現和負載均衡；

![](images/components.png)

除了核心組件，還有一些推薦的 Add-ons：

- kube-dns 負責為整個集群提供 DNS 服務
- Ingress Controller 為服務提供外網入口
- Heapster 提供資源監控
- Dashboard 提供 GUI
- Federation 提供跨可用區的集群
- Fluentd-elasticsearch 提供集群日誌採集、存儲與查詢




### 分層架構

Kubernetes 設計理念和功能其實就是一個類似 Linux 的分層架構，如下圖所示

![](images/14937095836427.jpg)

* 核心層：Kubernetes 最核心的功能，對外提供 API 構建高層的應用，對內提供插件式應用執行環境
* 應用層：部署（無狀態應用、有狀態應用、批處理任務、集群應用等）和路由（服務發現、DNS 解析等）
* 管理層：系統度量（如基礎設施、容器和網絡的度量），自動化（如自動擴展、動態 Provision 等）以及策略管理（RBAC、Quota、PSP、NetworkPolicy 等）
* 接口層：kubectl 命令行工具、客戶端 SDK 以及集群聯邦
* 生態系統：在接口層之上的龐大容器集群管理調度的生態系統，可以劃分為兩個範疇
  * Kubernetes 外部：日誌、監控、配置管理、CI、CD、Workflow、FaaS、OTS 應用、ChatOps 等
  * Kubernetes 內部：CRI、CNI、CVI、鏡像倉庫、Cloud Provider、集群自身的配置和管理等

### 核心組件

![](images/core-packages.png)

### 核心 API

![](images/core-apis.png)

### 生態系統

![](images/core-ecosystem.png)



關於分層架構，可以關注下 Kubernetes 社區正在推進的 [Kubernetes architectural roadmap](https://github.com/kubernetes/community/tree/master/sig-architecture)。

## 參考文檔

- [Kubernetes design and architecture](https://github.com/kubernetes/community/blob/master/contributors/design-proposals/architecture/architecture.md)
- <http://queue.acm.org/detail.cfm?id=2898444>
- <http://static.googleusercontent.com/media/research.google.com/zh-CN//pubs/archive/43438.pdf>
- <http://thenewstack.io/kubernetes-an-overview>
- [Kubernetes Architecture SIG](https://github.com/kubernetes/community/tree/master/sig-architecture)
