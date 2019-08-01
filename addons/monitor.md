# Kubernetes 監控

Kubernetes 社區提供了一些列的工具來監控容器和集群的狀態，並藉助 Prometheus 提供告警的功能。

- cAdvisor 負責單節點內部的容器和節點資源使用統計，內置在 Kubelet 內部，並通過 Kubelet `/metrics/cadvisor` 對外提供 API
- [InfluxDB](https://www.influxdata.com/time-series-platform/influxdb/) 是一個開源分佈式時序、事件和指標數據庫；而 [Grafana](http://grafana.org/) 則是 InfluxDB 的 Dashboard，提供了強大的圖表展示功能。它們常被組合使用展示圖表化的監控數據。
- [metrics-server](metrics.md) 提供了整個集群的資源監控數據，但要注意
  - Metrics API 只可以查詢當前的度量數據，並不保存歷史數據
  - Metrics API URI 為 `/apis/metrics.k8s.io/`，在 [k8s.io/metrics](https://github.com/kubernetes/metrics) 維護
  - 必須部署 `metrics-server` 才能使用該 API，metrics-server 通過調用 Kubelet Summary API 獲取數據
- [kube-state-metrics](https://github.com/kubernetes/kube-state-metrics) 提供了 Kubernetes 資源對象（如 DaemonSet、Deployments 等）的度量。
- [Prometheus](https://prometheus.io) 是另外一個監控和時間序列數據庫，還提供了告警的功能。
- [Node Problem Detector](https://github.com/kubernetes/node-problem-detector) 監測 Node 本身的硬件、內核或者運行時等問題。
- ~~[Heapster](https://github.com/kubernetes/heapster) 提供了整個集群的資源監控，並支持持久化數據存儲到 InfluxDB 等後端存儲中（已棄用）~~

## cAdvisor

[cAdvisor](https://github.com/google/cadvisor) 是一個來自 Google 的容器監控工具，也是 Kubelet 內置的容器資源收集工具。它會自動收集本機容器 CPU、內存、網絡和文件系統的資源佔用情況，並對外提供 cAdvisor 原生的 API（默認端口為 `--cadvisor-port=4194`）。

![](images/14842107270881.png)

從 v1.7 開始，Kubelet metrics API 不再包含 cadvisor metrics，而是提供了一個獨立的 API 接口：

- Kubelet metrics: `http://127.0.0.1:8001/api/v1/proxy/nodes/<node-name>/metrics`
- Cadvisor metrics: `http://127.0.0.1:8001/api/v1/proxy/nodes/<node-name>/metrics/cadvisor`

這樣，在 Prometheus 等工具中需要使用新的 Metrics API 來獲取這些數據，比如下面的 Prometheus 自動配置了 cadvisor metrics API：

```sh
helm install stable/prometheus --set rbac.create=true --name prometheus --namespace monitoring
```

注意：cadvisor 監聽的端口將在 v1.12 中刪除，建議所有外部工具使用 Kubelet Metrics API 替代。

## InfluxDB 和 Grafana

[InfluxDB](https://www.influxdata.com/time-series-platform/influxdb/) 是一個開源分佈式時序、事件和指標數據庫；而 [Grafana](http://grafana.org/) 則是 InfluxDB 的 Dashboard，提供了強大的圖表展示功能。它們常被組合使用展示圖表化的監控數據。

![](images/14842114123604.jpg)

## Heapster

Kubelet 內置的 cAdvisor 只提供了單機的容器資源佔用情況，而 [Heapster](https://github.com/kubernetes/heapster) 則提供了整個集群的資源監控，並支持持久化數據存儲到 InfluxDB、Google Cloud Monitoring 或者 [其他的存儲後端](https://github.com/kubernetes/heapster)。注意：

- 僅 Kubernetes v1.7.X 或者更老的集群推薦使用 Heapster。
- 從 Kubernetes v1.8 開始，資源使用情況的度量（如容器的 CPU 和內存使用）就已經通過 Metrics API 獲取，並且 HPA 也從 metrics-server 查詢必要的數據。
- **Heapster 已在 v1.11 中棄用，推薦 v1.8 及以上版本部署 [metrics-server](metrics.md) 替代 Heapster**

Heapster 首先從 Kubernetes apiserver 查詢所有 Node 的信息，然後再從 kubelet 提供的 API 採集節點和容器的資源佔用，同時在 `/metrics` API 提供了 Prometheus 格式的數據。Heapster 採集到的數據可以推送到各種持久化的後端存儲中，如 InfluxDB、Google Cloud Monitoring、OpenTSDB 等。

![](images/14842118198998.png)

### 部署 Heapster、InfluxDB 和 Grafana

在 Kubernetes 部署成功後，dashboard、DNS 和監控的服務也會默認部署好，比如通過 `cluster/kube-up.sh` 部署的集群默認會開啟以下服務：

```sh
$ kubectl cluster-info
Kubernetes master is running at https://kubernetes-master
Heapster is running at https://kubernetes-master/api/v1/proxy/namespaces/kube-system/services/heapster
KubeDNS is running at https://kubernetes-master/api/v1/proxy/namespaces/kube-system/services/kube-dns
kubernetes-dashboard is running at https://kubernetes-master/api/v1/proxy/namespaces/kube-system/services/kubernetes-dashboard
Grafana is running at https://kubernetes-master/api/v1/proxy/namespaces/kube-system/services/monitoring-grafana
InfluxDB is running at https://kubernetes-master/api/v1/proxy/namespaces/kube-system/services/monitoring-influxdb
```

如果這些服務沒有自動部署的話，可以參考 [kubernetes/heapster](https://github.com/kubernetes/heapster/tree/master/deploy/kube-config) 來部署這些服務：

```sh
git clone https://github.com/kubernetes/heapster
cd heapster
kubectl create -f deploy/kube-config/influxdb/
kubectl create -f deploy/kube-config/rbac/heapster-rbac.yaml
```

注意在訪問這些服務時，需要先在瀏覽器中導入 apiserver 證書才可以認證。為了簡化訪問過程，也可以使用 kubectl 代理來訪問（不需要導入證書）：

```sh
# 啟動代理
kubectl proxy --address='0.0.0.0' --port=8080 --accept-hosts='^*$' &
```

然後打開 `http://<master-ip>:8080/api/v1/proxy/namespaces/kube-system/services/monitoring-grafana` 就可以訪問 Grafana。

![](images/grafana.png)

## Prometheus

[Prometheus](https://prometheus.io) 是另外一個監控和時間序列數據庫，並且還提供了告警的功能。它提供了強大的查詢語言和 HTTP 接口，也支持將數據導出到 Grafana 中展示。

![prometheus](images/prometheus.png)

使用 Prometheus 監控 Kubernetes 需要配置好數據源，一個簡單的示例是 [prometheus.yml](prometheus.txt)。

推薦使用 [Prometheus Operator](https://github.com/coreos/prometheus-operator) 或 [Prometheus Chart](https://github.com/kubernetes/charts/tree/master/stable/prometheus) 來部署和管理 Prometheus，比如

```sh
# 使用 prometheus operator
helm repo add coreos https://s3-eu-west-1.amazonaws.com/coreos-charts/stable/
helm install coreos/prometheus-operator --name prometheus-operator --namespace monitoring
helm install coreos/kube-prometheus --name kube-prometheus --namespace monitoring
```

使用端口轉發的方式訪問 Prometheus，如 `kubectl --namespace monitoring port-forward service/kube-prometheus-prometheus :9090`

![prometheus-web](images/14842125295113.jpg)

如果發現 exporter-kubelets 功能不正常，比如報 `server returned HTTP status 401 Unauthorized` 錯誤，則需要給 Kubelet 配置 webhook 認證：

```sh
kubelet --authentication-token-webhook=true --authorization-mode=Webhook
```

如果發現 K8SControllerManagerDown 和 K8SSchedulerDown 告警，則說明 kube-controller-manager 和 kube-scheduler 是以 Pod 的形式運行在集群中的，並且 prometheus 部署的監控服務與它們的標籤不一致。可通過修改服務標籤的方法解決，如

```sh
kubectl -n kube-system set selector service kube-prometheus-exporter-kube-controller-manager  component=kube-controller-manager
kubectl -n kube-system set selector service kube-prometheus-exporter-kube-scheduler  component=kube-scheduler
```

查詢 Grafana 的管理員密碼

```sh
kubectl get secret --namespace monitoring kube-prometheus-grafana -o jsonpath="{.data.user}" | base64 --decode ; echo
kubectl get secret --namespace monitoring kube-prometheus-grafana -o jsonpath="{.data.password}" | base64 --decode ; echo
```

然後，以端口轉發的方式訪問 Grafana 界面

```sh
kubectl port-forward -n monitoring service/kube-prometheus-grafana :80
```

添加 Prometheus 類型的 Data Source，填入原地址 `http://prometheus-prometheus-server.monitoring`。

## Node Problem Detector

Kubernetes node 有可能會出現各種硬件、內核或者運行時等問題，這些問題有可能導致服務異常。而 Node Problem Detector（NPD）就是用來監測這些異常的服務。NPD 以 DaemonSet 的方式運行在每臺 Node 上面，並在異常發生時更新 NodeCondition（比如 KernelDaedlock、DockerHung、BadDisk 等）或者 Node Event（比如 OOM Kill 等）。

可以參考 [kubernetes/node-problem-detector](https://github.com/kubernetes/node-problem-detector#start-daemonset) 來部署 NPD，或者也可以使用 Helm 來部署：

```sh
# add repo
helm repo add feisky https://feisky.xyz/kubernetes-charts
helm update

# install packages
helm install feisky/node-problem-detector --namespace kube-system --name npd
```

## Node 重啟守護進程

Kubernetres 集群中的節點通常會開啟自動安全更新，這樣有助於儘可能避免因系統漏洞帶來的損失。但一般來說，涉及到內核的更新需要重啟系統才可生效。此時，就需要手動或自動的方法來重啟節點。

[Kured (KUbernetes REboot Daemon)](https://github.com/weaveworks/kured) 就是這樣一個守護進程，它會

- 監控 `/var/run/reboot-required` 信號後重啟節點
- 通過 DaemonSet Annotation 的方式每次僅重啟一臺節點
- 重啟前驅逐節點，重啟後恢復調度
- 根據 Prometheus 告警 (`--alert-filter-regexp=^(RebootRequired|AnotherBenignAlert|...$`) 取消重啟
- Slack 通知

部署方法

```sh
kubectl apply -f https://github.com/weaveworks/kured/releases/download/1.0.0/kured-ds.yaml
```

## 其他容器監控系統

除了以上監控工具，還有很多其他的開源或商業系統可用來輔助監控，如

- [Sysdig](http://blog.kubernetes.io/2015/11/monitoring-Kubernetes-with-Sysdig.html)
- [Weave scope](https://www.weave.works/docs/scope/latest/features/)
- [Datadog](https://www.datadoghq.com/)
- [Sematext](https://sematext.com/)

### sysdig

sysdig 是一個容器排錯工具，提供了開源和商業版本。對於常規排錯來說，使用開源版本即可。

除了 sysdig，還可以使用其他兩個輔助工具

* csysdig：與 sysdig 一起自動安裝，提供了一個命令行界面
* [sysdig-inspect](https://github.com/draios/sysdig-inspect)：為 sysdig 保存的跟蹤文件（如 `sudo sysdig -w filename.scap`）提供了一個圖形界面（非實時）

#### 安裝 sysdig

```sh
# on Linux
curl -s https://s3.amazonaws.com/download.draios.com/stable/install-sysdig | sudo bash

# on MacOS
brew install sysdig
```

使用示例

```sh
# Refer https://www.sysdig.org/wiki/sysdig-examples/.
# View the top network connections for a single container
sysdig -pc -c topconns

# Show the network data exchanged with the host 192.168.0.1
sysdig -s2000 -A -c echo_fds fd.cip=192.168.0.1

# List all the incoming connections that are not served by apache.
sysdig -p"%proc.name %fd.name" "evt.type=accept and proc.name!=httpd"

# View the CPU/Network/IO usage of the processes running inside the container.
sysdig -pc -c topprocs_cpu container.id=2e854c4525b8
sysdig -pc -c topprocs_net container.id=2e854c4525b8
sysdig -pc -c topfiles_bytes container.id=2e854c4525b8

# See the files where apache spends the most time doing I/O
sysdig -c topfiles_time proc.name=httpd

# Show all the interactive commands executed inside a given container.
sysdig -pc -c spy_users

# Show every time a file is opened under /etc.
sysdig evt.type=open and fd.name
```

### Weave Scope

Weave Scope 是另外一款可視化容器監控和排錯工具。與 sysdig 相比，它沒有強大的命令行工具，但提供了一個簡單易用的交互界面，自動描繪了整個集群的拓撲，並可以通過插件擴展其功能。從其官網的介紹來看，其提供的功能包括

- [交互式拓撲界面](https://www.weave.works/docs/scope/latest/features/#topology-mapping)
- [圖形模式和表格模式](https://www.weave.works/docs/scope/latest/features/#mode)
- [過濾功能](https://www.weave.works/docs/scope/latest/features/#flexible-filtering)
- [搜索功能](https://www.weave.works/docs/scope/latest/features/#powerful-search)
- [實時度量](https://www.weave.works/docs/scope/latest/features/#real-time-app-and-container-metrics)
- [容器排錯](https://www.weave.works/docs/scope/latest/features/#interact-with-and-manage-containers)
- [插件擴展](https://www.weave.works/docs/scope/latest/features/#custom-plugins)

Weave Scope 由 [App 和 Probe 兩部分](https://www.weave.works/docs/scope/latest/how-it-works)組成，它們

- Probe 負責收集容器和宿主的信息，併發送給 App
- App 負責處理這些信息，並生成相應的報告，並以交互界面的形式展示

```sh
                    +--Docker host----------+      +--Docker host----------+
.---------------.   |  +--Container------+  |      |  +--Container------+  |
| Browser       |   |  |                 |  |      |  |                 |  |
|---------------|   |  |  +-----------+  |  |      |  |  +-----------+  |  |
|               |----->|  | scope-app |<-----.    .----->| scope-app |  |  |
|               |   |  |  +-----------+  |  | \  / |  |  +-----------+  |  |
|               |   |  |        ^        |  |  \/  |  |        ^        |  |
'---------------'   |  |        |        |  |  /\  |  |        |        |  |
                    |  | +-------------+ |  | /  \ |  | +-------------+ |  |
                    |  | | scope-probe |-----'    '-----| scope-probe | |  |
                    |  | +-------------+ |  |      |  | +-------------+ |  |
                    |  |                 |  |      |  |                 |  |
                    |  +-----------------+  |      |  +-----------------+  |
                    +-----------------------+      +-----------------------+
```

#### 安裝 Weave scope

```sh
kubectl apply -f "https://cloud.weave.works/k8s/scope.yaml?k8s-version=$(kubectl version | base64 | tr -d '\n')&k8s-service-type=LoadBalancer"
```

安裝完成後，可以通過 weave-scope-app 來訪問交互界面

```sh
kubectl -n weave get service weave-scope-app
```

![](images/weave-scope.png)

點擊 Pod，還可以查看該 Pod 所有容器的實時狀態和度量數據：

![](images/scope-pod.png)

## 參考文檔

- [Kubernetes Heapster](https://github.com/kubernetes/heapster)
