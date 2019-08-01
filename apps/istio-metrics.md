# Istio 度量

## 新增指標

Istio 支持 [自定義指標、日誌](https://istio.io/docs/tasks/telemetry/metrics-logs/) 以及 [TCP 指標](https://istio.io/docs/tasks/telemetry/tcp-metrics/)。可以通過指標配置來新增這些度量，每個配置包括三方面的內容：

1. 從 Istio 屬性中生成度量實例，如logentry 、metrics 等。
2. 創建處理器（適配 Mixer），用來處理生成的度量實例，如 prometheus。
3. 根據一系列的股則，把度量實例傳遞給處理器，即創建 rule。

 ```yaml
# 指標 instance 的配置
apiVersion: "config.istio.io/v1alpha2"
kind: metric
metadata:
  name: doublerequestcount
  namespace: istio-system
spec:
  value: "2" # 每個請求計數兩次
  dimensions:
    source: source.service | "unknown"
    destination: destination.service | "unknown"
    message: '"twice the fun!"'
  monitored_resource_type: '"UNSPECIFIED"'
---
# prometheus handler 的配置
apiVersion: "config.istio.io/v1alpha2"
kind: prometheus
metadata:
  name: doublehandler
  namespace: istio-system
spec:
  metrics:
  - name: double_request_count # Prometheus 指標名稱
    instance_name: doublerequestcount.metric.istio-system # Mixer Instance 名稱（全限定名稱）
    kind: COUNTER
    label_names:
    - source
    - destination
    - message
---
# 將指標 Instance 發送給 prometheus handler 的 rule 對象
apiVersion: "config.istio.io/v1alpha2"
kind: rule
metadata:
  name: doubleprom
  namespace: istio-system
spec:
  actions:
  - handler: doublehandler.prometheus
    instances:
    - doublerequestcount.metric
 ```

## Prometheus

在命令行中執行以下命令：

```
$ kubectl -n istio-system port-forward service/prometheus 9090:9090 &
```

在 Web 瀏覽器中訪問 `http://localhost:9090` 即可以訪問 Prometheus UI，查詢度量指標。

## Jaeger 分佈式跟蹤

在命令行中執行以下命令：

```
$ kubectl -n istio-system port-forward service/jaeger-query 16686:16686 &
```

在 Web 瀏覽器中訪問 `http://localhost:16686` 即可以訪問 Jaeger UI。

## Grafana 可視化

在命令行中執行以下命令：

```
$ kubectl -n istio-system port-forward service/grafana 3000:3000 &
```

在 Web 瀏覽器中訪問 `http://localhost:3000` 即可以訪問 Grafana 界面。

## 服務圖

在命令行中執行以下命令：

```
$ kubectl -n istio-system port-forward $(kubectl -n istio-system get pod -l app=servicegraph -o jsonpath='{.items[0].metadata.name}') 8088:8088 &
```

在 Web 瀏覽器中訪問 `http://localhost:8088/force/forcegraph.html` 即可以訪問生成的服務圖。