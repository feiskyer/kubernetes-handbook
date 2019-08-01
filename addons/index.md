# 附加組件

部署 Kubernetes 集群后，還需要部署一系列的附加組件（addons），這些組件通常是保證集群功能正常運行必不可少的。

通常使用 [addon-manager](addon-manager.md) 來管理集群中的附加組件。它運行在 Kubernetes 集群 Master 節點中，管理著 `$ADDON_PATH`（默認是 `/etc/kubernetes/addons/`）目錄中的所有擴展，保證它們始終運行在期望狀態。

常見的組件包括：

- [addon-manager](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/addon-manager)
- [cluster-loadbalancing](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/cluster-loadbalancing)
- [cluster-monitoring](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/cluster-monitoring)
- [dashboard](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/dashboard)
- [device-plugins/nvidia-gpu](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/device-plugins/nvidia-gpu)
- [dns-horizontal-autoscaler](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/dns-horizontal-autoscaler)
- [dns](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/dns)
- [fluentd-elasticsearch](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/fluentd-elasticsearch)
- [ip-masq-agent](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/ip-masq-agent)
- [istio](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/istio)
- [kube-proxy](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/kube-proxy)
- [metrics-server](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/metrics-server)
- [node-problem-detector](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/node-problem-detector)
- [prometheus](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/prometheus)
- [storage-class](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/storage-class)

更多的擴展組件可以參考 [Installing Addons](https://kubernetes.io/docs/concepts/cluster-administration/addons/) 和 [Legacy Addons](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons)。
