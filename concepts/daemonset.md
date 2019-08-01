# DaemonSet

DaemonSet 保證在每個 Node 上都運行一個容器副本，常用來部署一些集群的日誌、監控或者其他系統管理應用。典型的應用包括：

* 日誌收集，比如 fluentd，logstash 等
* 系統監控，比如 Prometheus Node Exporter，collectd，New Relic agent，Ganglia gmond 等
* 系統程序，比如 kube-proxy, kube-dns, glusterd, ceph 等

## API 版本對照表

| Kubernetes 版本 |   Deployment 版本   |
| ------------- | ------------------ |
|   v1.5-v1.6   | extensions/v1beta1 |
| v1.7 | apps/v1beta1 |
|     v1.8      |   apps/v1beta2     |
|     v1.9      |      apps/v1       |

使用 Fluentd 收集日誌的例子：

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluentd-elasticsearch
  namespace: kube-system
  labels:
    k8s-app: fluentd-logging
spec:
  selector:
    matchLabels:
      name: fluentd-elasticsearch
  template:
    metadata:
      labels:
        name: fluentd-elasticsearch
    spec:
      tolerations:
      - key: node-role.kubernetes.io/master
        effect: NoSchedule
      containers:
      - name: fluentd-elasticsearch
        image: gcr.io/google-containers/fluentd-elasticsearch:1.20
        resources:
          limits:
            memory: 200Mi
          requests:
            cpu: 100m
            memory: 200Mi
        volumeMounts:
        - name: varlog
          mountPath: /var/log
        - name: varlibdockercontainers
          mountPath: /var/lib/docker/containers
          readOnly: true
      terminationGracePeriodSeconds: 30
      volumes:
      - name: varlog
        hostPath:
          path: /var/log
      - name: varlibdockercontainers
        hostPath:
          path: /var/lib/docker/containers
```

## 滾動更新

v1.6 + 支持 DaemonSet 的滾動更新，可以通過 `.spec.updateStrategy.type` 設置更新策略。目前支持兩種策略

- OnDelete：默認策略，更新模板後，只有手動刪除了舊的 Pod 後才會創建新的 Pod
- RollingUpdate：更新 DaemonSet 模版後，自動刪除舊的 Pod 並創建新的 Pod

在使用 RollingUpdate 策略時，還可以設置

- `.spec.updateStrategy.rollingUpdate.maxUnavailable`, 默認 1
- `spec.minReadySeconds`，默認 0

### 回滾

v1.7 + 還支持回滾

```sh
# 查詢歷史版本
$ kubectl rollout history daemonset <daemonset-name>

# 查詢某個歷史版本的詳細信息
$ kubectl rollout history daemonset <daemonset-name> --revision=1

# 回滾
$ kubectl rollout undo daemonset <daemonset-name> --to-revision=<revision>
# 查詢回滾狀態
$ kubectl rollout status ds/<daemonset-name>
```

## 指定 Node 節點

DaemonSet 會忽略 Node 的 unschedulable 狀態，有兩種方式來指定 Pod 只運行在指定的 Node 節點上：

- nodeSelector：只調度到匹配指定 label 的 Node 上
- nodeAffinity：功能更豐富的 Node 選擇器，比如支持集合操作
- podAffinity：調度到滿足條件的 Pod 所在的 Node 上

### nodeSelector 示例

首先給 Node 打上標籤

```sh
kubectl label nodes node-01 disktype=ssd
```

然後在 daemonset 中指定 nodeSelector 為 `disktype=ssd`：

```yaml
spec:
  nodeSelector:
    disktype: ssd
```

### nodeAffinity 示例

nodeAffinity 目前支持兩種：requiredDuringSchedulingIgnoredDuringExecution 和 preferredDuringSchedulingIgnoredDuringExecution，分別代表必須滿足條件和優選條件。比如下面的例子代表調度到包含標籤 `kubernetes.io/e2e-az-name` 並且值為 e2e-az1 或 e2e-az2 的 Node 上，並且優選還帶有標籤 `another-node-label-key=another-node-label-value` 的 Node。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: with-node-affinity
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: kubernetes.io/e2e-az-name
            operator: In
            values:
            - e2e-az1
            - e2e-az2
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 1
        preference:
          matchExpressions:
          - key: another-node-label-key
            operator: In
            values:
            - another-node-label-value
  containers:
  - name: with-node-affinity
    image: gcr.io/google_containers/pause:2.0
```

### podAffinity 示例

podAffinity 基於 Pod 的標籤來選擇 Node，僅調度到滿足條件 Pod 所在的 Node 上，支持 podAffinity 和 podAntiAffinity。這個功能比較繞，以下面的例子為例：

* 如果一個 “Node 所在 Zone 中包含至少一個帶有 `security=S1` 標籤且運行中的 Pod”，那麼可以調度到該 Node
* 不調度到 “包含至少一個帶有 `security=S2` 標籤且運行中 Pod” 的 Node 上

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: with-pod-affinity
spec:
  affinity:
    podAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchExpressions:
          - key: security
            operator: In
            values:
            - S1
        topologyKey: failure-domain.beta.kubernetes.io/zone
    podAntiAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchExpressions:
            - key: security
              operator: In
              values:
              - S2
          topologyKey: kubernetes.io/hostname
  containers:
  - name: with-pod-affinity
    image: gcr.io/google_containers/pause:2.0
```

## 靜態 Pod

除了 DaemonSet，還可以使用靜態 Pod 來在每臺機器上運行指定的 Pod，這需要 kubelet 在啟動的時候指定 manifest 目錄：

```sh
kubelet --pod-manifest-path=/etc/kubernetes/manifests
```

然後將所需要的 Pod 定義文件放到指定的 manifest 目錄中。

注意：靜態 Pod 不能通過 API Server 來刪除，但可以通過刪除 manifest 文件來自動刪除對應的 Pod。
