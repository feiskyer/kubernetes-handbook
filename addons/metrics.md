# Metrics

從 v1.8 開始，資源使用情況的度量（如容器的 CPU 和內存使用）可以通過 Metrics API 獲取。注意

- Metrics API 只可以查詢當前的度量數據，並不保存歷史數據
- Metrics API URI 為 `/apis/metrics.k8s.io/`，在 [k8s.io/metrics](https://github.com/kubernetes/metrics) 維護
- 必須部署 `metrics-server` 才能使用該 API，metrics-server 通過調用 Kubelet Summary API 獲取數據

## Kubernetes 監控架構

[Kubernetes 監控架構](https://github.com/kubernetes/community/blob/master/contributors/design-proposals/instrumentation/monitoring_architecture.md)由以下兩部分組成：

- 核心度量流程（下圖黑色部分）：這是 Kubernetes 正常工作所需要的核心度量，從 Kubelet、cAdvisor 等獲取度量數據，再由 metrics-server 提供給 Dashboard、HPA 控制器等使用。
- 監控流程（下圖藍色部分）：基於核心度量構建的監控流程，比如 Prometheus 可以從 metrics-server 獲取核心度量，從其他數據源（如 Node Exporter 等）獲取非核心度量，再基於它們構建監控告警系統。

![](images/monitoring_architecture.png)

## 開啟API Aggregation

在部署 metrics-server 之前，需要在 kube-apiserver 中開啟 API Aggregation，即增加以下配置

```sh
--requestheader-client-ca-file=/etc/kubernetes/certs/proxy-ca.crt
--proxy-client-cert-file=/etc/kubernetes/certs/proxy.crt
--proxy-client-key-file=/etc/kubernetes/certs/proxy.key
--requestheader-allowed-names=aggregator
--requestheader-extra-headers-prefix=X-Remote-Extra-
--requestheader-group-headers=X-Remote-Group
--requestheader-username-headers=X-Remote-User
```

如果kube-proxy沒有在Master上面運行，還需要配置

```sh
--enable-aggregator-routing=true
```

## 部署 metrics-server

```sh
$ git clone https://github.com/kubernetes-incubator/metrics-server
$ cd metrics-server
$ kubectl create -f deploy/1.8+/
```

稍後就可以看到 metrics-server 運行起來：

```sh
kubectl -n kube-system get pods -l k8s-app=metrics-server
```

## Metrics API

可以通過 `kubectl proxy` 來訪問 [Metrics API](https://github.com/kubernetes/community/blob/master/contributors/design-proposals/instrumentation/resource-metrics-api.md)：

- `http://127.0.0.1:8001/apis/metrics.k8s.io/v1beta1/nodes`
- `http://127.0.0.1:8001/apis/metrics.k8s.io/v1beta1/nodes/<node-name>`
- `http://127.0.0.1:8001/apis/metrics.k8s.io/v1beta1/pods`
- `http://127.0.0.1:8001/apis/metrics.k8s.io/v1beta1/namespace/<namespace-name>/pods/<pod-name>`

也可以直接通過 kubectl 命令來訪問這些 API，比如

- `kubectl get --raw /apis/metrics.k8s.io/v1beta1/nodes`
- `kubectl get --raw /apis/metrics.k8s.io/v1beta1/pods`
- `kubectl get --raw /apis/metrics.k8s.io/v1beta1/nodes/<node-name>`
- `kubectl get --raw /apis/metrics.k8s.io/v1beta1/namespace/<namespace-name>/pods/<pod-name>`

## 排錯

如果發現 metrics-server Pod 無法正常啟動，比如處於 CrashLoopBackOff 狀態，並且 restartCount 在不停增加，則很有可能是其跟 kube-apiserver 通信有問題。查看該 Pod 的日誌，可以發現

```sh
dial tcp 10.96.0.1:443: i/o timeout
```

解決方法是：

```sh
echo "ExecStartPost=/sbin/iptables -P FORWARD ACCEPT" >> /etc/systemd/system/docker.service.d/exec_start.conf
systemctl daemon-reload
systemctl restart docker
```

## 參考文檔

- [Core metrics pipeline](https://kubernetes.io/docs/tasks/debug-application-cluster/resource-metrics-pipeline/)
- [metrics-server](https://github.com/kubernetes-incubator/metrics-server)
