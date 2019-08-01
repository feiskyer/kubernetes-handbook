# Resource Quotas

資源配額（Resource Quotas）是用來限制用戶資源用量的一種機制。

它的工作原理為

- 資源配額應用在 Namespace 上，並且每個 Namespace 最多隻能有一個 `ResourceQuota` 對象
- 開啟計算資源配額後，創建容器時必須配置計算資源請求或限制（也可以用 [LimitRange](https://kubernetes.io/docs/tasks/administer-cluster/cpu-memory-limit/) 設置默認值）
- 用戶超額後禁止創建新的資源

## 開啟資源配額功能

- 首先，在 API Server 啟動時配置准入控制 `--admission-control=ResourceQuota`
- 然後，在 namespace 中創建一個 `ResourceQuota` 對象

## 資源配額的類型

- 計算資源，包括 cpu 和 memory
  - cpu, limits.cpu, requests.cpu
  - memory, limits.memory, requests.memory
- 存儲資源，包括存儲資源的總量以及指定 storage class 的總量
  - requests.storage：存儲資源總量，如 500Gi
  - persistentvolumeclaims：pvc 的個數
  - <storage-class-name>.storageclass.storage.k8s.io/requests.storage
  - <storage-class-name>.storageclass.storage.k8s.io/persistentvolumeclaims
  - requests.ephemeral-storage 和 limits.ephemeral-storage （需要 v1.8+）
- 對象數，即可創建的對象的個數
  - pods, replicationcontrollers, configmaps, secrets
  - resourcequotas, persistentvolumeclaims
  - services, services.loadbalancers, services.nodeports

計算資源示例

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

對象個數示例

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

默認情況下，Kubernetes 中所有容器都沒有任何 CPU 和內存限制。LimitRange 用來給 Namespace 增加一個資源限制，包括最小、最大和默認資源。比如

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

## 配額範圍

每個配額在創建時可以指定一系列的範圍

| 範圍 | 說明 |
|---|----|
|Terminating|podSpec.ActiveDeadlineSeconds>=0 的 Pod|
|NotTerminating|podSpec.activeDeadlineSeconds=nil 的 Pod|
|BestEffort | 所有容器的 requests 和 limits 都沒有設置的 Pod（Best-Effort）|
|NotBestEffort | 與 BestEffort 相反 |
