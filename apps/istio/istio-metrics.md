# Metrics Management Decoded

## Onboarding New Metrics

Istio lends support to [custom metrics and logs](https://istio.io/docs/tasks/telemetry/metrics-logs/) in addition to [TCP metrics](https://istio.io/docs/tasks/telemetry/tcp-metrics/). You can roll out these measurements by simply configuring your metrics. Each configuration comprises three key components:

1. Generating metric instances from the Istio attributes, such as logentry, metrics, and so on.
2. Crafting handlers (that align with Mixer), for processing the generated metric instances, like prometheus.
3. Creating a rule that dictates the passage of metric instances to the handlers.

```yaml
apiVersion: "config.istio.io/v1alpha2" # Configuration for the metric instance
kind: metric
metadata:
  name: doublerequestcount
  namespace: istio-system
spec:
  value: "2" # Counting each request twice
  dimensions:
    source: source.service | "unknown"
    destination: destination.service | "unknown"
    message: '"twice the fun!"'
  monitored_resource_type: '"UNSPECIFIED"'
---
apiVersion: "config.istio.io/v1alpha2" # Configuration for the prometheus handler
kind: prometheus
metadata:
  name: doublehandler
  namespace: istio-system
spec:
  metrics:
  - name: double_request_count # Prometheus metric name
    instance_name: doublerequestcount.metric.istio-system # Mixer Instance name (Fully Qualified Name)
    kind: COUNTER
    label_names:
    - source
    - destination
    - message
---
apiVersion: "config.istio.io/v1alpha2" # Rule object to send metric instance to prometheus handler
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

Run the following command in the command line:

```text
$ kubectl -n istio-system port-forward service/prometheus 9090:9090 &
```

You can now access Prometheus UI and explore the metric measurements by visiting `http://localhost:9090` in your web browser.

## Jaeger Distributed Tracing

Execute the following command in the command line:

```text
$ kubectl -n istio-system port-forward service/jaeger-query 16686:16686 &
```

You can now visit Jaeger UI at `http://localhost:16686` in your web browser.

## Grafana Visualization

Fire off the following command in the command line:

```text
$ kubectl -n istio-system port-forward service/grafana 3000:3000 &
```

You can now check out the Grafana interface by browsing `http://localhost:3000`.

## Service Graphic Visualization

Run the following command in the command line:

```text
$ kubectl -n istio-system port-forward $(kubectl -n istio-system get pod -l app=servicegraph -o jsonpath='{.items[0].metadata.name}') 8088:8088 &
```

You can generate and visit the service graph at `http://localhost:8088/force/forcegraph.html` in your web browser.