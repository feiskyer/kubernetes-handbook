# 资源控制

推荐在 YAML 清单中针对所有 pod 设置 pod 请求和限制：

* **pod 请求**定义 pod 所需的 CPU 和内存量。Kubernetes 基于这些请求量进行节点调度。
* **pod 限制**是 pod 可以使用的最大 CPU 和内存量，用于防治失控 Pod 占用过多资源。

如果不包含这些值，Kubernetes 调度程序将不知道需要多少资源。 调度程序可能会在资源不足的节点上运行 pod，从而无法提供可接受的应用程序性能。

群集管理员也可以为需要设置资源请求和限制的命名空间设置资源配额。

## Dynamic Resource Allocation (DRA) 资源管理

从 Kubernetes v1.26 开始，DRA 提供了一种全新的资源分配和管理方式，特别适用于 GPU、FPGA 等特殊设备资源。

### DRA 资源管理优势

相比传统的资源限制方式，DRA 提供了：

1. **动态分配** - 资源按需分配，而非启动时预留
2. **细粒度控制** - 支持设备的分区和共享
3. **更好的利用率** - 通过智能调度提高资源利用率
4. **灵活配置** - 支持复杂的设备配置需求

### 资源管理最佳实践

#### 1. 资源类定义

创建 ResourceClass 定义可用的设备类型：

```yaml
apiVersion: resource.k8s.io/v1alpha2
kind: ResourceClass
metadata:
  name: gpu-class
spec:
  driverName: gpu.example.com
  parameters:
    memory: "8Gi"
    compute: "high"
    # v1.33 新特性：支持分区设备
    partitionable: true
    maxPartitions: 4
```

#### 2. 资源配额管理

在命名空间级别控制 DRA 资源使用：

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: dra-quota
  namespace: ml-team
spec:
  hard:
    # 限制该命名空间最多使用 4 个 GPU
    count/resourceclaims.resource.k8s.io: "4"
    # v1.33 新特性：管理员访问控制
    requests.resource.k8s.io/gpu: "4"
```

#### 3. 优先级列表配置

利用 v1.33 的优先级列表特性提供设备备选方案：

```yaml
apiVersion: resource.k8s.io/v1alpha2
kind: ResourceClaim
metadata:
  name: flexible-gpu-claim
spec:
  # 优先级列表：优先使用高性能 GPU，备选普通 GPU
  resourceClassNames:
  - high-perf-gpu-class    # 优先级 1
  - standard-gpu-class     # 优先级 2
  - shared-gpu-class       # 优先级 3
```

#### 4. 设备污点和容忍度

使用 v1.33 的设备污点特性进行设备维护：

```yaml
# 标记设备为维护状态
apiVersion: resource.k8s.io/v1alpha2
kind: ResourceSlice
metadata:
  name: gpu-node-1
spec:
  driverName: gpu.example.com
  devices:
  - name: gpu-0
    basic:
      attributes:
        memory: "16Gi"
      capacity:
        memory: "16Gi"
    # 设备污点：标记为维护状态
    taints:
    - key: "maintenance"
      value: "scheduled"
      effect: "NoSchedule"
---
# Pod 容忍维护污点
apiVersion: v1
kind: Pod
metadata:
  name: maintenance-tolerant-pod
spec:
  containers:
  - name: app
    image: my-app
    resources:
      claims:
      - name: gpu-resource
  resourceClaims:
  - name: gpu-resource
    source:
      resourceClaimName: my-gpu-claim
  # 容忍设备维护污点
  tolerations:
  - key: "resource.kubernetes.io/device.maintenance"
    operator: "Equal"
    value: "scheduled"
    effect: "NoSchedule"
```

#### 5. 资源监控和度量

监控 DRA 资源使用情况：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: resource-monitor
spec:
  containers:
  - name: monitor
    image: prometheus/node-exporter
    # 监控 DRA 设备状态
    volumeMounts:
    - name: dra-metrics
      mountPath: /host/sys/class/drm
      readOnly: true
  volumes:
  - name: dra-metrics
    hostPath:
      path: /sys/class/drm
```

### 故障恢复和错误处理

#### 自动故障恢复

DRA 提供了更好的错误处理机制：

```yaml
apiVersion: resource.k8s.io/v1alpha2
kind: ResourceClaim
metadata:
  name: resilient-gpu-claim
spec:
  resourceClassName: gpu-class
  # 自动重试配置
  allocationMode: WaitForFirstConsumer
  parameters:
    # 设备故障时自动重新分配
    autoReallocation: true
    # 最大重试次数
    maxRetries: 3
```

#### 资源清理策略

配置资源的清理策略：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: batch-job
  annotations:
    # v1.33 特性：资源清理策略
    resource.kubernetes.io/cleanup-policy: "immediate"
spec:
  restartPolicy: Never
  containers:
  - name: job
    image: batch-processor
    resources:
      claims:
      - name: gpu-resource
  resourceClaims:
  - name: gpu-resource
    source:
      resourceClaimName: batch-gpu-claim
```

### 成本优化

#### 资源池管理

通过资源池提高利用率：

```yaml
apiVersion: resource.k8s.io/v1alpha2
kind: ResourceClass
metadata:
  name: shared-gpu-pool
spec:
  driverName: gpu.example.com
  parameters:
    # 启用资源池
    pooled: true
    # 最大共享数
    maxSharedUsers: 8
    # 时间片分配
    timeSlicing: true
```

#### 预算控制

结合 ResourceQuota 进行预算控制：

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-budget
  namespace: research-team
spec:
  hard:
    # 基于 GPU 小时的预算控制
    requests.resource.k8s.io/gpu-hours: "1000"
    # 最大并发 GPU 数量
    requests.resource.k8s.io/gpu: "10"
```

群集管理员也可以为需要设置资源请求和限制的命名空间设置资源配额。

## 原地 Pod 资源调整最佳实践

从 Kubernetes v1.33 开始，原地 Pod 资源调整功能升级为 Beta 版本，为资源管理带来了新的可能性。

### 何时使用原地调整

#### 适用场景

* **长运行服务**：Web 服务、数据库等需要根据负载动态调整资源
* **机器学习工作负载**：训练任务在不同阶段需要不同的资源配置
* **批处理作业**：根据数据量动态调整处理资源
* **开发测试环境**：频繁调整资源配置进行性能调优

#### 不适用场景

* **有状态应用的重要组件**：数据库主节点等关键组件
* **资源敏感应用**：对资源变化敏感的实时系统
* **短期任务**：生命周期短暂的 Pod

### 调整策略配置

#### CPU 调整策略

CPU 资源通常可以不重启容器直接调整：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: web-server
spec:
  containers:
  - name: nginx
    image: nginx:latest
    resources:
      requests:
        cpu: "100m"
        memory: "128Mi"
      limits:
        cpu: "500m"
        memory: "512Mi"
    resizePolicy:
    - resourceName: cpu
      restartPolicy: NotRequired  # CPU 调整不需要重启
```

#### 内存调整策略

内存调整通常需要更谨慎的处理：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: memory-app
spec:
  containers:
  - name: app
    image: my-app:latest
    resources:
      requests:
        memory: "256Mi"
      limits:
        memory: "1Gi"
    resizePolicy:
    - resourceName: memory
      restartPolicy: RestartContainer  # 内存调整可能需要重启
```

### 与 VPA 集成

#### 配置 VPA 原地调整模式

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
    updateMode: "InPlace"  # 启用原地调整
    minReplicas: 1
  resourcePolicy:
    containerPolicies:
    - containerName: nginx
      mode: "Auto"
      minAllowed:
        cpu: "100m"
        memory: "128Mi"
      maxAllowed:
        cpu: "2000m"
        memory: "2Gi"
      # 控制调整频率
      controlledResources: ["cpu", "memory"]
```

#### VPA 原地调整监控

监控 VPA 的调整行为：

```yaml
apiVersion: v1
kind: ServiceMonitor
metadata:
  name: vpa-inplace-metrics
spec:
  selector:
    matchLabels:
      app: vpa-recommender
  endpoints:
  - port: metrics
    path: /metrics
    interval: 30s
```

### 资源调整最佳实践

#### 1. 渐进式调整

避免大幅度的资源变更，采用渐进式调整：

```bash
# 分步骤调整资源
kubectl patch pod my-app --subresource resize --type='merge' -p='
{
  "spec": {
    "containers": [{
      "name": "app",
      "resources": {
        "requests": {"cpu": "200m"},  # 从 100m 先调整到 200m
        "limits": {"cpu": "400m"}
      }
    }]
  }
}'

# 观察一段时间后再进一步调整
kubectl patch pod my-app --subresource resize --type='merge' -p='
{
  "spec": {
    "containers": [{
      "name": "app", 
      "resources": {
        "requests": {"cpu": "500m"},  # 进一步调整到目标值
        "limits": {"cpu": "1000m"}
      }
    }]
  }
}'
```

#### 2. 资源调整验证

调整后验证 Pod 状态和性能：

```bash
# 检查调整状态
kubectl get pod my-app -o jsonpath='{.status.containerStatuses[0].resources}'

# 监控资源使用
kubectl top pod my-app

# 检查 Pod 事件
kubectl describe pod my-app | grep -A 10 Events
```

#### 3. 回滚策略

准备资源调整的回滚方案：

```bash
# 保存原始配置
kubectl get pod my-app -o yaml > my-app-original.yaml

# 如需回滚，恢复原始资源配置
kubectl apply -f my-app-original.yaml --subresource resize
```

### 监控和告警

#### 资源调整监控

创建 ServiceMonitor 监控资源调整事件：

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: pod-resize-monitor
spec:
  selector:
    matchLabels:
      app: kubelet
  endpoints:
  - port: https-metrics
    scheme: https
    path: /metrics
    bearerTokenFile: /var/run/secrets/kubernetes.io/serviceaccount/token
    tlsConfig:
      insecureSkipVerify: true
```

#### 告警规则

配置资源调整相关的告警：

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: pod-resize-alerts
spec:
  groups:
  - name: pod.resize
    rules:
    - alert: PodResizeFailure
      expr: increase(kubelet_pod_resize_failures_total[5m]) > 0
      for: 1m
      labels:
        severity: warning
      annotations:
        summary: "Pod 资源调整失败"
        description: "Pod {{ $labels.pod }} 在过去 5 分钟内发生资源调整失败"
    
    - alert: FrequentPodResize
      expr: increase(kubelet_pod_resize_total[1h]) > 10
      for: 5m
      labels:
        severity: info
      annotations:
        summary: "Pod 频繁调整资源"
        description: "Pod {{ $labels.pod }} 在过去 1 小时内调整资源超过 10 次"
```

### 性能考量

#### 调整频率控制

避免过于频繁的资源调整：

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: controlled-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-app
  updatePolicy:
    updateMode: "InPlace"
    # 控制最小调整间隔
    minReplicas: 1
    evictionPolicy:
      changeRequirement: 0.2  # 20% 的变化才触发调整
  resourcePolicy:
    containerPolicies:
    - containerName: app
      # 设置调整阈值
      minDiff:
        cpu: "50m"
        memory: "64Mi"
```

#### 节点资源考量

确保节点有足够资源支持调整：

```bash
# 检查节点可用资源
kubectl describe nodes | grep -A 5 "Allocated resources"

# 监控节点资源压力
kubectl top nodes
```

## 使用 kube-advisor 检查应用程序问题

你可以定期运行 [kube-advisor](https://github.com/Azure/kube-advisor) 工具，检查应用程序的配置是否存在问题。

运行 kube-advisor 示例：

```bash
$ kubectl apply -f https://github.com/Azure/kube-advisor/raw/master/sa.yaml

$ kubectl run --rm -i -t kube-advisor --image=mcr.microsoft.com/aks/kubeadvisor --restart=Never --overrides="{ \"apiVersion\": \"v1\", \"spec\": { \"serviceAccountName\": \"kube-advisor\" } }"
If you don't see a command prompt, try pressing enter.
+--------------+-------------------------+----------------+-------------+--------------------------------+
|  NAMESPACE   |  POD NAME               | POD CPU/MEMORY | CONTAINER   |             ISSUE              |
+--------------+-------------------------+----------------+-------------+--------------------------------+
| default      | demo-58bcb96b46-9952m   | 0 / 41272Ki    | demo        | CPU Resource Limits Missing    |
+              +                         +                +             +--------------------------------+
|              |                         |                |             | Memory Resource Limits Missing |
+              +                         +                +             +--------------------------------+
|              |                         |                |             | CPU Request Limits Missing     |
+              +                         +                +             +--------------------------------+
|              |                         |                |             | Memory Request Limits Missing  |
+--------------+-------------------------+----------------+-------------+--------------------------------+
```

## 参考文档

* [https://github.com/Azure/kube-advisor](https://github.com/Azure/kube-advisor)
* [Best practices for application developers to manage resources in Azure Kubernetes Service](https://docs.microsoft.com/en-us/azure/aks/developer-best-practices-resource-management)

