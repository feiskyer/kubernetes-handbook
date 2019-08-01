# Kubernetes 日誌

ELK 可謂是容器日誌收集、處理和搜索的黃金搭檔:

- Logstash（或者 Fluentd）負責收集日誌
- Elasticsearch 存儲日誌並提供搜索
- Kibana 負責日誌查詢和展示

注意：Kubernetes 默認使用 fluentd（以 DaemonSet 的方式啟動）來收集日誌，並將收集的日誌發送給 elasticsearch。

**小提示**

在使用 `cluster/kube-up.sh` 部署集群的時候，可以設置 `KUBE_LOGGING_DESTINATION` 環境變量自動部署 Elasticsearch 和 Kibana，並使用 fluentd 收集日誌 (配置參考 [addons/fluentd-elasticsearch](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/fluentd-elasticsearch))：

```sh
KUBE_LOGGING_DESTINATION=elasticsearch
KUBE_ENABLE_NODE_LOGGING=true
cluster/kube-up.sh
```

如果使用 GCE 或者 GKE 的話，還可以 [將日誌發送給 Google Cloud Logging](https://kubernetes.io/docs/user-guide/logging/stackdriver/)，並可以集成 Google Cloud Storage 和 BigQuery。

如果需要集成其他的日誌方案，還可以自定義 docker 的 log driver，將日誌發送到 splunk 或者 awslogs 等。

## 部署方法

由於 Fluentd daemonset 只會調度到帶有標籤 `kubectl label nodes --all beta.kubernetes.io/fluentd-ds-ready=true` 的 Node 上，需要給 Node 設置標籤

```sh
kubectl label nodes --all beta.kubernetes.io/fluentd-ds-ready=true
```

然後下載 manifest 部署：

```sh
$ git clone https://github.com/kubernetes/kubernetes
$ cd cluster/addons/fluentd-elasticsearch
$ kubectl apply -f .
clusterrole "elasticsearch-logging" configured
clusterrolebinding "elasticsearch-logging" configured
replicationcontroller "elasticsearch-logging-v1" configured
service "elasticsearch-logging" configured
serviceaccount "elasticsearch-logging" configured
clusterrole "fluentd-es" configured
clusterrolebinding "fluentd-es" configured
daemonset "fluentd-es-v1.24" configured
serviceaccount "fluentd-es" configured
deployment "kibana-logging" configured
service "kibana-logging" configured
```

注意：Kibana 容器第一次啟動的時候會用較長的時間（Optimizing and caching bundles for kibana and statusPage. This may take a few minutes），可以通過日誌觀察初始化的情況

```sh
$ kubectl -n kube-system logs kibana-logging-1237565573-p88lm -f
```

## 訪問 Kibana

可以從 `kubectl cluster-info` 的輸出中找到 Kibana 服務的訪問地址，注意需要在瀏覽器中導入 apiserver 證書才可以認證：

```sh
$ kubectl cluster-info | grep Kibana
Kibana is running at https://10.0.4.3:6443/api/v1/namespaces/kube-system/services/kibana-logging/proxy
```

這裡採用另外一種方式，使用 kubectl 代理來訪問（不需要導入證書）：

```sh
# 啟動代理
kubectl proxy --address='0.0.0.0' --port=8080 --accept-hosts='^*$' &
```

然後打開 `http://<master-ip>:8080/api/v1/proxy/namespaces/kube-system/services/kibana-logging/app/kibana#`。在 Settings -> Indices 頁面創建一個 index，選中 Index contains time-based events，使用默認的 `logstash-*` pattern，點擊 Create。

![](images/kibana.png)

## Filebeat

除了 Fluentd 和 Logstash，還可以使用 [Filebeat](https://www.elastic.co/products/beats/filebeat) 來收集日誌:

```sh
kubectl apply -f https://raw.githubusercontent.com/elastic/beats/master/deploy/kubernetes/filebeat-kubernetes.yaml
```

注意，默認假設 Elasticsearch 可通過 `elasticsearch:9200` 訪問，如果不同的話，需要先修改再部署

```sh
- name: ELASTICSEARCH_HOST
  value: elasticsearch
- name: ELASTICSEARCH_PORT
  value: "9200"
- name: ELASTICSEARCH_USERNAME
  value: elastic
- name: ELASTICSEARCH_PASSWORD
  value: changeme
```

## 參考文檔

- [Logging Agent For Elasticsearch](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/fluentd-elasticsearch)
- [Logging Using Elasticsearch and Kibana](https://kubernetes.io/docs/tasks/debug-application-cluster/logging-elasticsearch-kibana/)
