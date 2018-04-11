# Kubernetes 日志

ELK 可谓是容器日志收集、处理和搜索的黄金搭档:

- Logstash（或者 Fluentd）负责收集日志
- Elasticsearch 存储日志并提供搜索
- Kibana 负责日志查询和展示

注意：Kubernetes 默认使用 fluentd（以 DaemonSet 的方式启动）来收集日志，并将收集的日志发送给 elasticsearch。

**小提示**

在使用 `cluster/kube-up.sh` 部署集群的时候，可以设置 `KUBE_LOGGING_DESTINATION` 环境变量自动部署 Elasticsearch 和 Kibana，并使用 fluentd 收集日志 (配置参考 [addons/fluentd-elasticsearch](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/fluentd-elasticsearch))：

```sh
KUBE_LOGGING_DESTINATION=elasticsearch
KUBE_ENABLE_NODE_LOGGING=true
cluster/kube-up.sh
```

如果使用 GCE 或者 GKE 的话，还可以 [将日志发送给 Google Cloud Logging](https://kubernetes.io/docs/user-guide/logging/stackdriver/)，并可以集成 Google Cloud Storage 和 BigQuery。

如果需要集成其他的日志方案，还可以自定义 docker 的 log driver，将日志发送到 splunk 或者 awslogs 等。

## 部署方法

由于 Fluentd daemonset 只会调度到带有标签 `kubectl label nodes --all beta.kubernetes.io/fluentd-ds-ready=true` 的 Node 上，需要给 Node 设置标签

```sh
kubectl label nodes --all beta.kubernetes.io/fluentd-ds-ready=true
```

然后下载 manifest 部署：

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

注意：Kibana 容器第一次启动的时候会用较长的时间（Optimizing and caching bundles for kibana and statusPage. This may take a few minutes），可以通过日志观察初始化的情况

```sh
$ kubectl -n kube-system logs kibana-logging-1237565573-p88lm -f
```

## 访问 Kibana

可以从 `kubectl cluster-info` 的输出中找到 Kibana 服务的访问地址，注意需要在浏览器中导入 apiserver 证书才可以认证：

```sh
$ kubectl cluster-info | grep Kibana
Kibana is running at https://10.0.4.3:6443/api/v1/namespaces/kube-system/services/kibana-logging/proxy
```

这里采用另外一种方式，使用 kubectl 代理来访问（不需要导入证书）：

```sh
# 启动代理
kubectl proxy --address='0.0.0.0' --port=8080 --accept-hosts='^*$' &
```

然后打开 `http://<master-ip>:8080/api/v1/proxy/namespaces/kube-system/services/kibana-logging/app/kibana#`。在 Settings -> Indices 页面创建一个 index，选中 Index contains time-based events，使用默认的 `logstash-*` pattern，点击 Create。

![](images/kibana.png)

## Filebeat

除了 Fluentd 和 Logstash，还可以使用 [Filebeat](https://www.elastic.co/products/beats/filebeat) 来收集日志:

```sh
kubectl apply -f https://raw.githubusercontent.com/elastic/beats/master/deploy/kubernetes/filebeat-kubernetes.yaml
```

注意，默认假设 Elasticsearch 可通过 `elasticsearch:9200` 访问，如果不同的话，需要先修改再部署

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

## 参考文档

- [Logging Agent For Elasticsearch](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/fluentd-elasticsearch)
- [Logging Using Elasticsearch and Kibana](https://kubernetes.io/docs/tasks/debug-application-cluster/logging-elasticsearch-kibana/)
