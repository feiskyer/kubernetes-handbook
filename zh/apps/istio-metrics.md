# Istio 度量

## 新增指标

Istio 支持 [自定义指标、日志](https://istio.io/docs/tasks/telemetry/metrics-logs/) 以及 [TCP 指标](https://istio.io/docs/tasks/telemetry/tcp-metrics/)。可以通过指标配置来新增这些度量，每个配置包括三方面的内容：

1. 从 Istio 属性中生成度量实例，如logentry 、metrics 等。
2. 创建处理器（适配 Mixer），用来处理生成的度量实例，如 prometheus。
3. 根据一系列的股则，把度量实例传递给处理器，即创建 rule。

 ```yaml
# 指标 instance 的配置
apiVersion: "config.istio.io/v1alpha2"
kind: metric
metadata:
  name: doublerequestcount
  namespace: istio-system
spec:
  value: "2" # 每个请求计数两次
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
  - name: double_request_count # Prometheus 指标名称
    instance_name: doublerequestcount.metric.istio-system # Mixer Instance 名称（全限定名称）
    kind: COUNTER
    label_names:
    - source
    - destination
    - message
---
# 将指标 Instance 发送给 prometheus handler 的 rule 对象
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

在命令行中执行以下命令：

```
$ kubectl -n istio-system port-forward service/prometheus 9090:9090 &
```

在 Web 浏览器中访问 `http://localhost:9090` 即可以访问 Prometheus UI，查询度量指标。

## Jaeger 分布式跟踪

在命令行中执行以下命令：

```
$ kubectl -n istio-system port-forward service/jaeger-query 16686:16686 &
```

在 Web 浏览器中访问 `http://localhost:16686` 即可以访问 Jaeger UI。

## Grafana 可视化

在命令行中执行以下命令：

```
$ kubectl -n istio-system port-forward service/grafana 3000:3000 &
```

在 Web 浏览器中访问 `http://localhost:3000` 即可以访问 Grafana 界面。

## 服务图

在命令行中执行以下命令：

```
$ kubectl -n istio-system port-forward $(kubectl -n istio-system get pod -l app=servicegraph -o jsonpath='{.items[0].metadata.name}') 8088:8088 &
```

在 Web 浏览器中访问 `http://localhost:8088/force/forcegraph.html` 即可以访问生成的服务图。