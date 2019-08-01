# Istio 策略管理

Mixer 為應用程序和基礎架構後端之間提供了一個通用的策略控制層，負責先決條件檢查（如認證授權）、配額管理並從 Envoy 代理中收集遙測數據等。

![](images/istio-mixer.png)

Mixer 是高度模塊化和可擴展的組件。他的一個關鍵功能就是把不同後端的策略和遙測收集系統的細節抽象出來，使得 Istio 的其餘部分對這些後端不知情。Mixer 處理不同基礎設施後端的靈活性是通過使用通用插件模型實現的。每個插件都被稱為 **Adapter**，Mixer通過它們與不同的基礎設施後端連接，這些後端可提供核心功能，例如日誌、監控、配額、ACL 檢查等。通過配置能夠決定在運行時使用的確切的適配器套件，並且可以輕鬆擴展到新的或定製的基礎設施後端。

![](images/istio-adapters.png)


## 實現原理

本質上，Mixer 是一個 [屬性](https://istio.io/docs/concepts/policy-and-control/attributes.html) 處理機，進入 Mixer 的請求帶有一系列的屬性，Mixer 按照不同的處理階段處理：

- 通過全局 Adapters 為請求引入新的屬性
- 通過解析（Resolution）識別要用於處理請求的配置資源
- 處理屬性，生成 Adapter 參數
- 分發請求到各個 Adapters 後端處理

![](images/istio-phase.png)

## 流量限制示例

```yaml
apiVersion: "config.istio.io/v1alpha2"
kind: memquota
metadata:
  name: handler
  namespace: istio-system
spec:
  quotas:
  - name: requestcount.quota.istio-system
    maxAmount: 5000
    validDuration: 1s
    # The first matching override is applied.
    # A requestcount instance is checked against override dimensions.
    overrides:
    # The following override applies to 'ratings' when
    # the source is 'reviews'.
    - dimensions:
        destination: ratings
        source: reviews
      maxAmount: 1
      validDuration: 1s
    # The following override applies to 'ratings' regardless
    # of the source.
    - dimensions:
        destination: ratings
      maxAmount: 100
      validDuration: 1s

---
apiVersion: "config.istio.io/v1alpha2"
kind: quota
metadata:
  name: requestcount
  namespace: istio-system
spec:
  dimensions:
    source: source.labels["app"] | source.service | "unknown"
    sourceVersion: source.labels["version"] | "unknown"
    destination: destination.labels["app"] | destination.service | "unknown"
    destinationVersion: destination.labels["version"] | "unknown"

---
apiVersion: "config.istio.io/v1alpha2"
kind: rule
metadata:
  name: quota
  namespace: istio-system
spec:
  actions:
  - handler: handler.memquota
    instances:
    - requestcount.quota
---
apiVersion: config.istio.io/v1alpha2
kind: QuotaSpec
metadata:
  name: request-count
  namespace: istio-system
spec:
  rules:
  - quotas:
    - charge: 1
      quota: requestcount
---
apiVersion: config.istio.io/v1alpha2
kind: QuotaSpecBinding
metadata:
  name: request-count
  namespace: istio-system
spec:
  quotaSpecs:
  - name: request-count
    namespace: istio-system
  services:
  - name: ratings
  - name: reviews
  - name: details
  - name: productpage
```

## 參考文檔

- [Istio Mixer](https://istio.io/docs/concepts/policy-and-control/mixer.html)
