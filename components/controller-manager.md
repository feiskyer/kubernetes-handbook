# Controller Manager

Controller Manager 由 kube-controller-manager 和 cloud-controller-manager 組成，是 Kubernetes 的大腦，它通過 apiserver 監控整個集群的狀態，並確保集群處於預期的工作狀態。

![](images/post-ccm-arch.png)

kube-controller-manager 由一系列的控制器組成

- Replication Controller
- Node Controller
- CronJob Controller
- Daemon Controller
- Deployment Controller
- Endpoint Controller
- Garbage Collector
- Namespace Controller
- Job Controller
- Pod AutoScaler
- RelicaSet
- Service Controller
- ServiceAccount Controller
- StatefulSet Controller
- Volume Controller
- Resource quota Controller

cloud-controller-manager 在 Kubernetes 啟用 Cloud Provider 的時候才需要，用來配合雲服務提供商的控制，也包括一系列的控制器，如

- Node Controller
- Route Controller
- Service Controller

從 v1.6 開始，cloud provider 已經經歷了幾次重大重構，以便在不修改 Kubernetes 核心代碼的同時構建自定義的雲服務商支持。參考 [這裡](../plugins/cloud-provider.md) 查看如何為雲提供商構建新的 Cloud Provider。

## Metrics

Controller manager metrics 提供了控制器內部邏輯的性能度量，如 Go 語言運行時度量、etcd 請求延時、雲服務商 API 請求延時、雲存儲請求延時等。Controller manager metrics 默認監聽在 `kube-controller-manager` 的 10252 端口，提供 Prometheus 格式的性能度量數據，可以通過 `http://localhost:10252/metrics` 來訪問。

```
$ curl http://localhost:10252/metrics
...
# HELP etcd_request_cache_add_latencies_summary Latency in microseconds of adding an object to etcd cache
# TYPE etcd_request_cache_add_latencies_summary summary
etcd_request_cache_add_latencies_summary{quantile="0.5"} NaN
etcd_request_cache_add_latencies_summary{quantile="0.9"} NaN
etcd_request_cache_add_latencies_summary{quantile="0.99"} NaN
etcd_request_cache_add_latencies_summary_sum 0
etcd_request_cache_add_latencies_summary_count 0
# HELP etcd_request_cache_get_latencies_summary Latency in microseconds of getting an object from etcd cache
# TYPE etcd_request_cache_get_latencies_summary summary
etcd_request_cache_get_latencies_summary{quantile="0.5"} NaN
etcd_request_cache_get_latencies_summary{quantile="0.9"} NaN
etcd_request_cache_get_latencies_summary{quantile="0.99"} NaN
etcd_request_cache_get_latencies_summary_sum 0
etcd_request_cache_get_latencies_summary_count 0
...
```

## kube-controller-manager 啟動示例

```sh
kube-controller-manager \
  --enable-dynamic-provisioning=true \
  --feature-gates=AllAlpha=true \
  --horizontal-pod-autoscaler-sync-period=10s \
  --horizontal-pod-autoscaler-use-rest-clients=true \
  --node-monitor-grace-period=10s \
  --address=127.0.0.1 \
  --leader-elect=true \
  --kubeconfig=/etc/kubernetes/controller-manager.conf \
  --cluster-signing-key-file=/etc/kubernetes/pki/ca.key \
  --use-service-account-credentials=true \
  --controllers=*,bootstrapsigner,tokencleaner \
  --root-ca-file=/etc/kubernetes/pki/ca.crt \
  --service-account-private-key-file=/etc/kubernetes/pki/sa.key \
  --cluster-signing-cert-file=/etc/kubernetes/pki/ca.crt \
  --allocate-node-cidrs=true \
  --cluster-cidr=10.244.0.0/16 \
  --node-cidr-mask-size=24
```

## 控制器

### kube-controller-manager

kube-controller-manager 由一系列的控制器組成，這些控制器可以劃分為三組

1. 必須啟動的控制器
   - EndpointController
   - ReplicationController：
   - PodGCController
   - ResourceQuotaController
   - NamespaceController
   - ServiceAccountController
   - GarbageCollectorController
   - DaemonSetController
   - JobController
   - DeploymentController
   - ReplicaSetController
   - HPAController
   - DisruptionController
   - StatefulSetController
   - CronJobController
   - CSRSigningController
   - CSRApprovingController
   - TTLController
2. 默認啟動的可選控制器，可通過選項設置是否開啟
   - TokenController
   - NodeController
   - ServiceController
   - RouteController
   - PVBinderController
   - AttachDetachController
3. 默認禁止的可選控制器，可通過選項設置是否開啟
   - BootstrapSignerController
   - TokenCleanerController

### cloud-controller-manager

cloud-controller-manager 在 Kubernetes 啟用 Cloud Provider 的時候才需要，用來配合雲服務提供商的控制，也包括一系列的控制器

- CloudNodeController
- RouteController
- ServiceController

## 高可用

在啟動時設置 `--leader-elect=true` 後，controller manager 會使用多節點選主的方式選擇主節點。只有主節點才會調用 `StartControllers()` 啟動所有控制器，而其他從節點則僅執行選主算法。

多節點選主的實現方法見 [leaderelection.go](https://github.com/kubernetes/client-go/blob/master/tools/leaderelection/leaderelection.go)。它實現了兩種資源鎖（Endpoint 或 ConfigMap，kube-controller-manager 和 cloud-controller-manager 都使用 Endpoint 鎖），通過更新資源的 Annotation（`control-plane.alpha.kubernetes.io/leader`），來確定主從關係。

## 高性能

從 Kubernetes 1.7 開始，所有需要監控資源變化情況的調用均推薦使用 [Informer](https://github.com/kubernetes/client-go/blob/master/tools/cache/shared_informer.go)。Informer 提供了基於事件通知的只讀緩存機制，可以註冊資源變化的回調函數，並可以極大減少 API 的調用。

Informer 的使用方法可以參考 [這裡](https://github.com/feiskyer/kubernetes-handbook/tree/master/examples/client/informer)。

## Node Eviction

Node 控制器在節點異常後，會按照默認的速率（`--node-eviction-rate=0.1`，即每10秒一個節點的速率）進行 Node 的驅逐。Node 控制器按照 Zone 將節點劃分為不同的組，再跟進 Zone 的狀態進行速率調整：

- Normal：所有節點都 Ready，默認速率驅逐。
- PartialDisruption：即超過33% 的節點 NotReady 的狀態。當異常節點比例大於 `--unhealthy-zone-threshold=0.55` 時開始減慢速率：
  - 小集群（即節點數量小於 `--large-cluster-size-threshold=50`）：停止驅逐
  - 大集群，減慢速率為 `--secondary-node-eviction-rate=0.01`
- FullDisruption：所有節點都 NotReady，返回使用默認速率驅逐。但當所有 Zone 都處在 FullDisruption 時，停止驅逐。
