# Kubernetes 簡介

Kubernetes 是谷歌開源的容器集群管理系統，是 Google 多年大規模容器管理技術 Borg 的開源版本，主要功能包括：

- 基於容器的應用部署、維護和滾動升級
- 負載均衡和服務發現
- 跨機器和跨地區的集群調度
- 自動伸縮
- 無狀態服務和有狀態服務
- 廣泛的 Volume 支持
- 插件機制保證擴展性

Kubernetes 發展非常迅速，已經成為容器編排領域的領導者。

## Kubernetes 是一個平臺

Kubernetes 提供了很多的功能，它可以簡化應用程序的工作流，加快開發速度。通常，一個成功的應用編排系統需要有較強的自動化能力，這也是為什麼 Kubernetes 被設計作為構建組件和工具的生態系統平臺，以便更輕鬆地部署、擴展和管理應用程序。

用戶可以使用 Label 以自己的方式組織管理資源，還可以使用 Annotation 來自定義資源的描述信息，比如為管理工具提供狀態檢查等。

此外，Kubernetes 控制器也是構建在跟開發人員和用戶使用的相同的 API 之上。用戶還可以編寫自己的控制器和調度器，也可以通過各種插件機制擴展系統的功能。

這種設計使得可以方便地在 Kubernetes 之上構建各種應用系統。

## Kubernetes 不是什麼

Kubernetes 不是一個傳統意義上，包羅萬象的 PaaS (平臺即服務) 系統。它給用戶預留了選擇的自由。

- 不限制支持的應用程序類型，它不插手應用程序框架, 也不限制支持的語言 (如 Java, Python, Ruby 等)，只要應用符合 [12 因素](http://12factor.net/) 即可。Kubernetes 旨在支持極其多樣化的工作負載，包括無狀態、有狀態和數據處理工作負載。只要應用可以在容器中運行，那麼它就可以很好的在 Kubernetes 上運行。
- 不提供內置的中間件 (如消息中間件)、數據處理框架 (如 Spark)、數據庫 (如 mysql) 或集群存儲系統 (如 Ceph) 等。這些應用直接運行在 Kubernetes 之上。
- 不提供點擊即部署的服務市場。
- 不直接部署代碼，也不會構建您的應用程序，但您可以在 Kubernetes 之上構建需要的持續集成 (CI) 工作流。
- 允許用戶選擇自己的日誌、監控和告警系統。
- 不提供應用程序配置語言或系統 (如 [jsonnet](https://github.com/google/jsonnet))。
- 不提供機器配置、維護、管理或自愈系統。

另外，已經有很多 PaaS 系統運行在 Kubernetes 之上，如 [Openshift](https://github.com/openshift/origin), [Deis](http://deis.io/) 和 [Eldarion](http://eldarion.cloud/) 等。 您也可以構建自己的 PaaS 系統，或者只使用 Kubernetes 管理您的容器應用。

當然了，Kubernetes 不僅僅是一個 “編排系統”，它消除了編排的需要。Kubernetes 通過聲明式的 API 和一系列獨立、可組合的控制器保證了應用總是在期望的狀態，而用戶並不需要關心中間狀態是如何轉換的。這使得整個系統更容易使用，而且更強大、更可靠、更具彈性和可擴展性。

## 核心組件

Kubernetes 主要由以下幾個核心組件組成：

- etcd 保存了整個集群的狀態；
- apiserver 提供了資源操作的唯一入口，並提供認證、授權、訪問控制、API 註冊和發現等機制；
- controller manager 負責維護集群的狀態，比如故障檢測、自動擴展、滾動更新等；
- scheduler 負責資源的調度，按照預定的調度策略將 Pod 調度到相應的機器上；
- kubelet 負責維護容器的生命週期，同時也負責 Volume（CVI）和網絡（CNI）的管理；
- Container runtime 負責鏡像管理以及 Pod 和容器的真正運行（CRI）；
- kube-proxy 負責為 Service 提供 cluster 內部的服務發現和負載均衡

![](architecture.png)

## Kubernetes 版本

Kubernetes 的穩定版本在發佈後會繼續支持 9 個月。每個版本的支持週期為：

| Kubernetes version | Release month  | End-of-life-month |
|--------------------|----------------|-------------------|
| v1.6.x             | March 2017     | December 2017     |
| v1.7.x             | June 2017      | March 2018        |
| v1.8.x             | September 2017 | June 2018         |
| v1.9.x             | December 2017  | September 2018    |
| v1.10.x            | March 2018     | December 2018     |
| v1.11.x            | June 2018      | March 2019        |

## 參考文檔

- [What is Kubernetes?](https://kubernetes.io/docs/concepts/overview/what-is-kubernetes/)
- [HOW CUSTOMERS ARE REALLY USING KUBERNETES](https://apprenda.com/blog/customers-really-using-kubernetes/)
