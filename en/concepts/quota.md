# Resource Quotas

资源配额（Resource Quotas）是用来限制用户资源用量的一种机制。

它的工作原理为

- 资源配额应用在 Namespace 上，并且每个 Namespace 最多只能有一个 `ResourceQuota` 对象
- 开启计算资源配额后，创建容器时必须配置计算资源请求或限制（也可以用 [LimitRange](https://kubernetes.io/docs/tasks/administer-cluster/cpu-memory-limit/) 设置默认值）
- 用户超额后禁止创建新的资源

## 开启资源配额功能

- 首先，在 API Server 启动时配置准入控制 `--admission-control=ResourceQuota`
- 然后，在 namespace 中创建一个 `ResourceQuota` 对象

## 资源配额的类型

- 计算资源，包括 cpu 和 memory
  - cpu, limits.cpu, requests.cpu
  - memory, limits.memory, requests.memory
- 存储资源，包括存储资源的总量以及指定 storage class 的总量
  - requests.storage：存储资源总量，如 500Gi
  - persistentvolumeclaims：pvc 的个数
  - <storage-class-name>.storageclass.storage.k8s.io/requests.storage
  - <storage-class-name>.storageclass.storage.k8s.io/persistentvolumeclaims
  - requests.ephemeral-storage 和 limits.ephemeral-storage （需要 v1.8+）
- 对象数，即可创建的对象的个数
  - pods, replicationcontrollers, configmaps, secrets
  - resourcequotas, persistentvolumeclaims
  - services, services.loadbalancers, services.nodeports

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

```sh
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
|---|----|
|Terminating|podSpec.ActiveDeadlineSeconds>=0 的 Pod|
|NotTerminating|podSpec.activeDeadlineSeconds=nil 的 Pod|
|BestEffort | 所有容器的 requests 和 limits 都没有设置的 Pod（Best-Effort）|
|NotBestEffort | 与 BestEffort 相反 |
