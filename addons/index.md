# 附加组件

部署 Kubernetes 集群后，还需要部署一系列的附加组件（addons），这些组件通常是保证集群功能正常运行必不可少的。

通常使用 [addon-manager](addon-manager.md) 来管理集群中的附加组件。它运行在 Kubernetes 集群 Master 节点中，管理着 `$ADDON_PATH`（默认是 `/etc/kubernetes/addons/`）目录中的所有扩展，保证它们始终运行在期望状态。

常见的组件包括：

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

更多的扩展组件可以参考 [Installing Addons](https://kubernetes.io/docs/concepts/cluster-administration/addons/) 和 [Legacy Addons](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons)。
