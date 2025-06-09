# Autoscaling

Horizontal Pod Autoscaling \(HPA\) 可以根据 CPU 使用率或应用自定义 metrics 自动扩展 Pod 数量（支持 replication controller、deployment 和 replica set ）。

* 控制管理器每隔 15s（可以通过 `--horizontal-pod-autoscaler-sync-period` 修改）查询 metrics 的资源使用情况
* 支持三种 metrics 类型
  * 预定义 metrics（比如 Pod 的 CPU）以利用率的方式计算
  * 自定义的 Pod metrics，以原始值（raw value）的方式计算
  * 自定义的 object metrics
* 支持两种 metrics 查询方式：Heapster 和自定义的 REST API
* 支持多 metrics

注意：

* 本章是关于 Pod 的自动扩展，而 Node 的自动扩展请参考 [Cluster AutoScaler](../../setup/addon-list/cluster-autoscaler.md)。
* 在使用 HPA 之前需要 **确保已部署好** [**metrics-server**](../../setup/addon-list/metrics.md)。

## API 版本对照表

| Kubernetes 版本 | autoscaling API 版本 | 支持的 metrics |
| :--- | :--- | :--- |
| v1.5+ | autoscaling/v1 | CPU |
| v1.6+ | autoscaling/v2beta1 | Memory及自定义 |

## 示例

```bash
# 创建 pod 和 service
$ kubectl run php-apache --image=k8s.gcr.io/hpa-example --requests=cpu=200m --expose --port=80
service "php-apache" created
deployment "php-apache" created

# 创建 autoscaler
$ kubectl autoscale deployment php-apache --cpu-percent=50 --min=1 --max=10
deployment "php-apache" autoscaled

$ kubectl get hpa
NAME         REFERENCE                     TARGET    MINPODS   MAXPODS   REPLICAS   AGE
php-apache   Deployment/php-apache/scale   0% / 50%  1         10        1          18s

# 增加负载
$ kubectl run -i --tty load-generator --image=busybox /bin/sh
Hit enter for command prompt
$ while true; do wget -q -O- http://php-apache.default.svc.cluster.local; done

# 过一会就可以看到负载升高了
$ kubectl get hpa
NAME         REFERENCE                     TARGET      CURRENT   MINPODS   MAXPODS   REPLICAS   AGE
php-apache   Deployment/php-apache/scale   305% / 50%  305%      1         10        1          3m

# autoscaler 将这个 deployment 扩展为 7 个 pod
$ kubectl get deployment php-apache
NAME         DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
php-apache   7         7         7            7           19m

# 删除刚才创建的负载增加 pod 后会发现负载降低，并且 pod 数量也自动降回 1 个
$ kubectl get hpa
NAME         REFERENCE                     TARGET       MINPODS   MAXPODS   REPLICAS   AGE
php-apache   Deployment/php-apache/scale   0% / 50%     1         10        1          11m

$ kubectl get deployment php-apache
NAME         DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
php-apache   1         1         1            1           27m
```

## 自定义 metrics

使用方法

* 控制管理器开启 `--horizontal-pod-autoscaler-use-rest-clients`
* 控制管理器配置的 `--master` 或者 `--kubeconfig`
* 在 API Server Aggregator 中注册自定义的 metrics API，如 [https://github.com/kubernetes-incubator/custom-metrics-apiserver](https://github.com/kubernetes-incubator/custom-metrics-apiserver) 和 [https://github.com/kubernetes/metrics](https://github.com/kubernetes/metrics)

> 注：可以参考 [k8s.io/metics](https://github.com/kubernetes/metrics) 开发自定义的 metrics API server。

比如 HorizontalPodAutoscaler 保证每个 Pod 占用 50% CPU、1000pps 以及 10000 请求 / s：

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

## 可配置容忍度（Kubernetes v1.33+）

从 Kubernetes v1.33 开始，HPA 支持可配置的容忍度（tolerance），允许用户自定义扩缩容的触发阈值。这一功能通过 `HPAConfigurableTolerance` 特性门控启用。

### 功能概述

在之前的版本中，Kubernetes 使用固定的 10% 容忍度来决定是否进行扩缩容操作。现在可以为扩容（scale-up）和缩容（scale-down）分别设置不同的容忍度，提供更细粒度的控制。

### 配置示例

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: configurable-tolerance-example
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-app
  minReplicas: 2
  maxReplicas: 20
  behavior:
    scaleDown:
      tolerance: 0.05  # 5% 容忍度用于缩容
    scaleUp:
      tolerance: 0     # 0% 容忍度用于扩容（更敏感）
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### 容忍度使用场景

1. **高敏感度扩容**：设置较低的扩容容忍度，快速响应负载增长
   ```yaml
   behavior:
     scaleUp:
       tolerance: 0.02  # 2% 容忍度，快速扩容
   ```

2. **保守缩容**：设置较高的缩容容忍度，避免频繁缩容
   ```yaml
   behavior:
     scaleDown:
       tolerance: 0.15  # 15% 容忍度，稳定缩容
   ```

3. **不同工作负载的定制策略**：
   ```yaml
   # 批处理工作负载 - 积极扩容，保守缩容
   behavior:
     scaleUp:
       tolerance: 0
     scaleDown:
       tolerance: 0.2
   
   # Web 服务 - 平衡策略
   behavior:
     scaleUp:
       tolerance: 0.05
     scaleDown:
       tolerance: 0.1
   ```

### 注意事项

- 该功能目前处于 Alpha 阶段，需要启用 `HPAConfigurableTolerance` 特性门控
- 容忍度值范围为 0.0 到 1.0（表示 0% 到 100%）
- 较低的容忍度会导致更频繁的扩缩容操作
- 需要结合具体的应用特性和负载模式进行调优

## 状态条件

v1.7+ 可以在客户端中看到 Kubernetes 为 HorizontalPodAutoscaler 设置的状态条件 `status.conditions`，用来判断 HorizontalPodAutoscaler 是否可以扩展（AbleToScale）、是否开启扩展（ScalingActive）以及是否受到限制（ScalingLimitted）。

```bash
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

## Vertical Pod Autoscaler (VPA) 与原地调整

### VPA 概述

Vertical Pod Autoscaler (VPA) 可以根据资源使用历史和当前需求自动调整 Pod 的 CPU 和内存请求。从 Kubernetes v1.33 开始，VPA 可以与原地 Pod 资源调整功能集成，实现无需重启的动态资源调整。

### VPA 与原地调整集成

#### 基本配置

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: web-app-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-app
  updatePolicy:
    updateMode: "InPlace"  # 启用原地调整模式
  resourcePolicy:
    containerPolicies:
    - containerName: web-container
      mode: "Auto"
      minAllowed:
        cpu: "100m"
        memory: "128Mi"
      maxAllowed:
        cpu: "2000m"
        memory: "4Gi"
      controlledResources: ["cpu", "memory"]
```

#### 混合调整策略

结合 HPA 和 VPA，实现完整的自动伸缩：

```yaml
# HPA 配置 - 水平扩缩容
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-app-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-app
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
---
# VPA 配置 - 垂直扩缩容
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: web-app-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-app
  updatePolicy:
    updateMode: "InPlace"
  resourcePolicy:
    containerPolicies:
    - containerName: web-container
      mode: "Auto"
      # VPA 调整范围要与 HPA 的目标利用率协调
      minAllowed:
        cpu: "100m"
        memory: "128Mi"
      maxAllowed:
        cpu: "1000m"    # 限制单个 Pod 最大资源
        memory: "2Gi"
```

#### VPA 调整策略优化

配置智能的 VPA 调整策略：

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: optimized-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-app
  updatePolicy:
    updateMode: "InPlace"
    # 控制更新频率
    minReplicas: 1
    evictionPolicy:
      changeRequirement: 0.1  # 10% 变化才触发调整
  resourcePolicy:
    containerPolicies:
    - containerName: app
      mode: "Auto"
      # 设置不同资源的调整策略
      controlledValues: RequestsAndLimits
      minDiff:
        cpu: "50m"      # 最小 CPU 调整幅度
        memory: "64Mi"  # 最小内存调整幅度
      maxAllowed:
        cpu: "4000m"
        memory: "8Gi"
      # 配置调整时机
      recommendationMarginFraction: 0.15  # 15% 安全余量
```

### VPA 推荐模式

#### Off 模式 - 仅推荐

仅生成推荐值，不自动应用：

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: recommendation-only-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-app
  updatePolicy:
    updateMode: "Off"  # 仅推荐，不自动调整
  resourcePolicy:
    containerPolicies:
    - containerName: app
      mode: "Auto"
```

查看推荐值：

```bash
# 查看 VPA 推荐
kubectl describe vpa recommendation-only-vpa

# 输出示例
Recommendation:
  Container Recommendations:
    Container Name:  app
    Lower Bound:
      Cpu:     100m
      Memory:  262144k
    Target:
      Cpu:     250m
      Memory:  524288k
    Uncapped Target:
      Cpu:     250m
      Memory:  524288k
    Upper Bound:
      Cpu:     1
      Memory:  1Gi
```

#### Initial 模式 - 初始调整

仅在 Pod 创建时设置资源：

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: initial-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-app
  updatePolicy:
    updateMode: "Initial"  # 仅在创建时调整
  resourcePolicy:
    containerPolicies:
    - containerName: app
      mode: "Auto"
```

### VPA 与应用类型的最佳实践

#### Web 应用

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: web-service-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-service
  updatePolicy:
    updateMode: "InPlace"
  resourcePolicy:
    containerPolicies:
    - containerName: web
      mode: "Auto"
      # Web 应用通常 CPU 变化较大，内存相对稳定
      controlledValues: RequestsAndLimits
      minAllowed:
        cpu: "100m"
        memory: "128Mi"
      maxAllowed:
        cpu: "2000m"
        memory: "1Gi"
      # 对内存调整更保守
      recommendationMarginFraction: 0.2
```

#### 数据处理应用

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: data-processor-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: data-processor
  updatePolicy:
    updateMode: "InPlace"
  resourcePolicy:
    containerPolicies:
    - containerName: processor
      mode: "Auto"
      # 数据处理应用内存需求变化大
      controlledValues: RequestsAndLimits
      minAllowed:
        cpu: "500m"
        memory: "1Gi"
      maxAllowed:
        cpu: "4000m"
        memory: "16Gi"
      # 更积极的内存调整
      recommendationMarginFraction: 0.1
```

### VPA 监控和故障排查

#### 监控 VPA 行为

```bash
# 查看 VPA 状态
kubectl get vpa

# 查看详细推荐信息
kubectl describe vpa my-app-vpa

# 查看 VPA 事件
kubectl get events --field-selector involvedObject.kind=VerticalPodAutoscaler

# 监控资源调整事件
kubectl get events --field-selector reason=VPAEvict
```

#### VPA 故障排查

常见问题和解决方案：

1. **VPA 不生成推荐**
   ```bash
   # 检查 metrics-server 状态
   kubectl get pods -n kube-system | grep metrics-server
   
   # 检查 VPA 组件
   kubectl get pods -n kube-system | grep vpa
   ```

2. **调整频率过高**
   ```yaml
   # 增加变化阈值
   evictionPolicy:
     changeRequirement: 0.2  # 提高到 20%
   ```

3. **资源不足导致调整失败**
   ```bash
   # 检查节点资源
   kubectl describe nodes | grep -A 5 "Allocated resources"
   ```

## HPA 最佳实践

* 为容器配置 CPU Requests
* HPA 目标设置恰当，如设置 70% 给容器和应用预留 30% 的余量
* 保持 Pods 和 Nodes 健康（避免 Pod 频繁重建）
* 保证用户请求的负载均衡
* 使用 `kubectl top node` 和 `kubectl top pod` 查看资源使用情况
* **容忍度配置建议（v1.33+）**：
  * Web 应用：扩容容忍度 3-5%，缩容容忍度 10-15%
  * 批处理任务：扩容容忍度 0-2%，缩容容忍度 15-20%
  * 关键服务：使用较低的扩容容忍度确保快速响应
  * 成本敏感场景：使用较高的缩容容忍度减少不必要的资源消耗
* **VPA 与 HPA 协调使用**：
  * 避免在同一资源上同时使用 HPA 和 VPA
  * VPA 适用于单个 Pod 资源优化，HPA 适用于负载分散
  * 考虑使用 VPA 的 Initial 模式为新 Pod 设置合适的初始资源
  * 监控原地调整的成功率和对应用的影响

## 参考文档

* [Ensure High Availability and Uptime With Kubernetes Horizontal Pod Autoscaler and Prometheus](https://www.weave.works/blog/kubernetes-horizontal-pod-autoscaler-and-prometheus)

