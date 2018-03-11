# Elasticsearch Fluentd Kibana (EFK)

ELK可谓是容器日志收集、处理和搜索的黄金搭档:

- Logstash（或者Fluentd）负责收集日志
- Elasticsearch存储日志并提供搜索
- Kibana负责日志查询和展示

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

具体使用方法可以参考 [Kubernetes 日志处理](../deploy/logging.md)。