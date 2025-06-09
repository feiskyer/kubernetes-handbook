# Resource Quota

资源配额（Resource Quotas）是用来限制用户资源用量的一种机制。

它的工作原理为

* 资源配额应用在 Namespace 上，并且每个 Namespace 最多只能有一个 `ResourceQuota` 对象
* 开启计算资源配额后，创建容器时必须配置计算资源请求或限制（也可以用 [LimitRange](https://kubernetes.io/docs/tasks/administer-cluster/cpu-memory-limit/) 设置默认值）
* 用户超额后禁止创建新的资源

## 开启资源配额功能

* 首先，在 API Server 启动时配置准入控制 `--admission-control=ResourceQuota`
* 然后，在 namespace 中创建一个 `ResourceQuota` 对象

## 资源配额的类型

* 计算资源，包括 cpu 和 memory
  * cpu, limits.cpu, requests.cpu
  * memory, limits.memory, requests.memory
* 存储资源，包括存储资源的总量以及指定 storage class 的总量
  * requests.storage：存储资源总量，如 500Gi
  * persistentvolumeclaims：pvc 的个数
  * .storageclass.storage.k8s.io/requests.storage
  * .storageclass.storage.k8s.io/persistentvolumeclaims
  * requests.ephemeral-storage 和 limits.ephemeral-storage （需要 v1.8+）
* 对象数，即可创建的对象的个数
  * pods, replicationcontrollers, configmaps, secrets
  * resourcequotas, persistentvolumeclaims
  * services, services.loadbalancers, services.nodeports

计算资源示例

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute-resources
spec:
  hard:
    pods: "4"
    requests.cpu: "1"
    requests.memory: 1Gi
    limits.cpu: "2"
    limits.memory: 2Gi
```

对象个数示例

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: object-counts
spec:
  hard:
    configmaps: "10"
    persistentvolumeclaims: "4"
    replicationcontrollers: "20"
    secrets: "10"
    services: "10"
    services.loadbalancers: "2"
```

## LimitRange

默认情况下，Kubernetes 中所有容器都没有任何 CPU 和内存限制。LimitRange 用来给 Namespace 增加一个资源限制，包括最小、最大和默认资源。比如

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: mylimits
spec:
  limits:
  - max:
      cpu: "2"
      memory: 1Gi
    min:
      cpu: 200m
      memory: 6Mi
    type: Pod
  - default:
      cpu: 300m
      memory: 200Mi
    defaultRequest:
      cpu: 200m
      memory: 100Mi
    max:
      cpu: "2"
      memory: 1Gi
    min:
      cpu: 100m
      memory: 3Mi
    type: Container
```

```bash
$ kubectl create -f https://k8s.io/docs/tasks/configure-pod-container/limits.yaml --namespace=limit-example
limitrange "mylimits" created
$ kubectl describe limits mylimits --namespace=limit-example
Name:   mylimits
Namespace:  limit-example
Type        Resource      Min      Max      Default Request      Default Limit      Max Limit/Request Ratio
----        --------      ---      ---      ---------------      -------------      -----------------------
Pod         cpu           200m     2        -                    -                  -
Pod         memory        6Mi      1Gi      -                    -                  -
Container   cpu           100m     2        200m                 300m               -
Container   memory        3Mi      1Gi      100Mi                200Mi              -
```

## 配额范围

每个配额在创建时可以指定一系列的范围

| 范围 | 说明 |
| :--- | :--- |
| Terminating | podSpec.ActiveDeadlineSeconds&gt;=0 的 Pod |
| NotTerminating | podSpec.activeDeadlineSeconds=nil 的 Pod |
| BestEffort | 所有容器的 requests 和 limits 都没有设置的 Pod（Best-Effort） |
| NotBestEffort | 与 BestEffort 相反 |

## 原地 Pod 资源调整与配额管理

从 Kubernetes v1.33 开始，原地 Pod 资源调整功能升级为 Beta 版本，这给资源配额管理带来了新的考量因素。

### 配额验证机制

当执行原地资源调整时，Kubernetes 会验证调整后的资源是否超出命名空间的配额限制：

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: resize-aware-quota
  namespace: development
spec:
  hard:
    # CPU 配额
    requests.cpu: "10"     # 总 CPU 请求
    limits.cpu: "20"       # 总 CPU 限制
    # 内存配额  
    requests.memory: "20Gi" # 总内存请求
    limits.memory: "40Gi"   # 总内存限制
    # Pod 数量限制
    pods: "10"
    # 支持原地调整的资源类型
    count/pods.resize: "5"  # 允许同时调整的 Pod 数量（v1.33+ 特性）
```

### 配额检查时机

原地资源调整时的配额验证流程：

1. **调整前验证**：检查目标资源是否会超出配额
2. **原子性操作**：确保配额更新与资源调整的原子性
3. **回滚机制**：调整失败时自动恢复配额计数

### 动态配额管理示例

#### 弹性配额配置

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: elastic-quota
  namespace: ml-workload
spec:
  hard:
    # 基础配额
    requests.cpu: "50"
    requests.memory: "100Gi"
    limits.cpu: "100"
    limits.memory: "200Gi"
    # 动态调整相关配额
    count/pods.resize-enabled: "10"  # 支持调整的 Pod 数量
---
# 补充配额用于高峰期
apiVersion: v1
kind: ResourceQuota
metadata:
  name: burst-quota
  namespace: ml-workload
spec:
  hard:
    # 高峰期额外配额
    requests.cpu: "30"
    requests.memory: "60Gi"
  scopes: ["NotTerminating"]  # 仅应用于长期运行的 Pod
```

#### 配额监控和告警

监控原地调整对配额的影响：

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: quota-resize-monitoring
spec:
  groups:
  - name: quota.resize
    rules:
    - alert: QuotaUsageHigh
      expr: |
        (
          kube_resourcequota{resource="requests.cpu", type="used"} / 
          kube_resourcequota{resource="requests.cpu", type="hard"}
        ) > 0.9
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "命名空间 {{ $labels.namespace }} CPU 配额使用率超过 90%"
        description: "可能影响原地资源调整操作"
    
    - alert: ResizeQuotaExceeded
      expr: increase(apiserver_admission_controller_admission_latencies_seconds_count{name="ResourceQuota",rejected="true"}[5m]) > 0
      for: 1m
      labels:
        severity: critical
      annotations:
        summary: "资源调整请求被配额控制器拒绝"
        description: "检查命名空间配额设置和当前资源使用情况"
```

### 配额最佳实践

#### 1. 预留缓冲区

为原地调整预留配额缓冲区：

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: buffered-quota
spec:
  hard:
    requests.cpu: "10"      # 实际需求 8 CPU，预留 2 CPU 用于调整
    requests.memory: "20Gi" # 实际需求 16Gi，预留 4Gi 用于调整
    limits.cpu: "20"
    limits.memory: "40Gi"
```

#### 2. 分层配额管理

针对不同优先级的工作负载设置分层配额：

```yaml
# 高优先级工作负载配额
apiVersion: v1
kind: ResourceQuota
metadata:
  name: high-priority-quota
  namespace: production
spec:
  hard:
    requests.cpu: "50"
    requests.memory: "100Gi"
  scopeSelector:
    matchExpressions:
    - operator: In
      scopeName: PriorityClass
      values: ["high-priority"]
---
# 普通工作负载配额
apiVersion: v1
kind: ResourceQuota
metadata:
  name: normal-quota
  namespace: production
spec:
  hard:
    requests.cpu: "30"
    requests.memory: "60Gi"
  scopeSelector:
    matchExpressions:
    - operator: NotIn
      scopeName: PriorityClass
      values: ["high-priority"]
```

#### 3. 配额使用情况查看

监控配额使用和原地调整的影响：

```bash
# 查看当前配额使用情况
kubectl describe quota -n development

# 查看配额详细信息
kubectl get resourcequota -n development -o yaml

# 监控资源调整事件对配额的影响
kubectl get events -n development --field-selector reason=QuotaExceeded

# 查看因配额限制失败的调整操作
kubectl get events -n development --field-selector reason=FailedResize
```

### 故障排查

#### 配额相关的调整失败

常见问题和解决方案：

1. **配额不足导致调整失败**
   ```bash
   # 检查当前配额使用
   kubectl describe quota -n my-namespace
   
   # 临时增加配额（生产环境需谨慎）
   kubectl patch resourcequota my-quota -n my-namespace --type='merge' -p='
   {
     "spec": {
       "hard": {
         "requests.cpu": "20",
         "requests.memory": "40Gi"
       }
     }
   }'
   ```

2. **配额计算错误**
   ```bash
   # 重新计算配额使用情况
   kubectl delete pod --all -n my-namespace --wait=false
   kubectl get resourcequota -n my-namespace
   ```

3. **配额策略冲突**
   ```bash
   # 检查是否有多个 ResourceQuota 对象
   kubectl get resourcequota -n my-namespace
   
   # 查看 LimitRange 是否与调整目标冲突
   kubectl get limitrange -n my-namespace -o yaml
   ```

### 与其他功能的集成

#### 与 VPA 集成

配置支持 VPA 原地调整的配额：

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: vpa-friendly-quota
spec:
  hard:
    requests.cpu: "20"      # 为 VPA 调整预留足够空间
    requests.memory: "40Gi"
    limits.cpu: "40"
    limits.memory: "80Gi"
    # VPA 可能创建的临时资源
    count/verticalpodautoscalers.autoscaling.k8s.io: "5"
```

#### 与多租户环境集成

在多租户环境中合理分配原地调整能力：

```yaml
# 租户 A - 生产环境，保守调整策略
apiVersion: v1
kind: ResourceQuota
metadata:
  name: tenant-a-quota
  namespace: tenant-a
spec:
  hard:
    requests.cpu: "100"
    requests.memory: "200Gi"
    # 限制同时进行调整的 Pod 数量
    count/pods.resize-active: "3"
---
# 租户 B - 开发环境，灵活调整策略  
apiVersion: v1
kind: ResourceQuota
metadata:
  name: tenant-b-quota
  namespace: tenant-b
spec:
  hard:
    requests.cpu: "50"
    requests.memory: "100Gi"
    # 允许更多 Pod 同时调整
    count/pods.resize-active: "10"
```

