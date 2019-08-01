# Horizontal Pod Autoscaling (HPA)

Horizontal Pod Autoscaling (HPA) 可以根據 CPU 使用率或應用自定義 metrics 自動擴展 Pod 數量（支持 replication controller、deployment 和 replica set ）。

- 控制管理器每隔 30s（可以通過 `--horizontal-pod-autoscaler-sync-period` 修改）查詢 metrics 的資源使用情況
- 支持三種 metrics 類型
  - 預定義 metrics（比如 Pod 的 CPU）以利用率的方式計算
  - 自定義的 Pod metrics，以原始值（raw value）的方式計算
  - 自定義的 object metrics
- 支持兩種 metrics 查詢方式：Heapster 和自定義的 REST API
- 支持多 metrics

注意：

- 本章是關於 Pod 的自動擴展，而 Node 的自動擴展請參考 [Cluster AutoScaler](../addons/cluster-autoscaler.md)。
- 在使用 HPA 之前需要 **確保已部署好 [metrics-server](../addons/metrics.md)**。

## API 版本對照表

| Kubernetes 版本  | autoscaling API 版本   | 支持的 metrics |
| --------------- | ---------------------- | ------------- |
| v1.5+           | autoscaling/v1         | CPU           |
| v1.6+           | autoscaling/v2beta1    | Memory及自定義 |

## 示例

```sh
# 創建 pod 和 service
$ kubectl run php-apache --image=k8s.gcr.io/hpa-example --requests=cpu=200m --expose --port=80
service "php-apache" created
deployment "php-apache" created

# 創建 autoscaler
$ kubectl autoscale deployment php-apache --cpu-percent=50 --min=1 --max=10
deployment "php-apache" autoscaled

$ kubectl get hpa
NAME         REFERENCE                     TARGET    MINPODS   MAXPODS   REPLICAS   AGE
php-apache   Deployment/php-apache/scale   0% / 50%  1         10        1          18s

# 增加負載
$ kubectl run -i --tty load-generator --image=busybox /bin/sh
Hit enter for command prompt
$ while true; do wget -q -O- http://php-apache.default.svc.cluster.local; done

# 過一會就可以看到負載升高了
$ kubectl get hpa
NAME         REFERENCE                     TARGET      CURRENT   MINPODS   MAXPODS   REPLICAS   AGE
php-apache   Deployment/php-apache/scale   305% / 50%  305%      1         10        1          3m

# autoscaler 將這個 deployment 擴展為 7 個 pod
$ kubectl get deployment php-apache
NAME         DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
php-apache   7         7         7            7           19m

# 刪除剛才創建的負載增加 pod 後會發現負載降低，並且 pod 數量也自動降回 1 個
$ kubectl get hpa
NAME         REFERENCE                     TARGET       MINPODS   MAXPODS   REPLICAS   AGE
php-apache   Deployment/php-apache/scale   0% / 50%     1         10        1          11m

$ kubectl get deployment php-apache
NAME         DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
php-apache   1         1         1            1           27m
```

## 自定義 metrics

使用方法

- 控制管理器開啟 `--horizontal-pod-autoscaler-use-rest-clients`
- 控制管理器配置的 `--master` 或者 `--kubeconfig`
- 在 API Server Aggregator 中註冊自定義的 metrics API，如 <https://github.com/kubernetes-incubator/custom-metrics-apiserver> 和 <https://github.com/kubernetes/metrics>

> 注：可以參考 [k8s.io/metics](https://github.com/kubernetes/metrics) 開發自定義的 metrics API server。

比如 HorizontalPodAutoscaler 保證每個 Pod 佔用 50% CPU、1000pps 以及 10000 請求 / s：

HPA 示例

```yaml
apiVersion: autoscaling/v1
kind: HorizontalPodAutoscaler
metadata:
  name: php-apache
  namespace: default
spec:
  scaleTargetRef:
    apiVersion: apps/v1beta1
    kind: Deployment
    name: php-apache
  minReplicas: 1
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      targetAverageUtilization: 50
  - type: Pods
    pods:
      metricName: packets-per-second
      targetAverageValue: 1k
  - type: Object
    object:
      metricName: requests-per-second
      target:
        apiVersion: extensions/v1beta1
        kind: Ingress
        name: main-route
      targetValue: 10k
status:
  observedGeneration: 1
  lastScaleTime: <some-time>
  currentReplicas: 1
  desiredReplicas: 1
  currentMetrics:
  - type: Resource
    resource:
      name: cpu
      currentAverageUtilization: 0
      currentAverageValue: 0
```

## 狀態條件

v1.7+ 可以在客戶端中看到 Kubernetes 為 HorizontalPodAutoscaler 設置的狀態條件 `status.conditions`，用來判斷 HorizontalPodAutoscaler 是否可以擴展（AbleToScale）、是否開啟擴展（ScalingActive）以及是否受到限制（ScalingLimitted）。

```sh
$ kubectl describe hpa cm-test
Name:                           cm-test
Namespace:                      prom
Labels:                         <none>
Annotations:                    <none>
CreationTimestamp:              Fri, 16 Jun 2017 18:09:22 +0000
Reference:                      ReplicationController/cm-test
Metrics:                        (current / target)
  "http_requests" on pods:      66m / 500m
Min replicas:                   1
Max replicas:                   4
ReplicationController pods:     1 current / 1 desired
Conditions:
  Type                  Status  Reason                  Message
  ----                  ------  ------                  -------
  AbleToScale           True    ReadyForNewScale        the last scale time was sufficiently old as to warrant a new scale
  ScalingActive         True    ValidMetricFound        the HPA was able to successfully calculate a replica count from pods metric http_requests
  ScalingLimited        False   DesiredWithinRange      the desired replica count is within the acceptable range
Events:
```

## HPA 最佳實踐

- 為容器配置 CPU Requests
- HPA 目標設置恰當，如設置 70% 給容器和應用預留 30% 的餘量
- 保持 Pods 和 Nodes 健康（避免 Pod 頻繁重建）
- 保證用戶請求的負載均衡
- 使用 `kubectl top node` 和 `kubectl top pod` 查看資源使用情況

## 參考文檔

- [Ensure High Availability and Uptime With Kubernetes Horizontal Pod Autoscaler and Prometheus](https://www.weave.works/blog/kubernetes-horizontal-pod-autoscaler-and-prometheus)

