# 抓取 Calico 网络策略日志示例

由于 Calico NetworkPolicy 是基于 iptables 实现的，calico-node 只显示 calico-node 容器自身的日志，而不会显示 GlobalNetworkPolicy Log Action 的日志。这个示例展示了如何从 syslog 中抓取这些日志。

使用方法：

```sh
kubectl apply -f calico-packet-logs.yaml
```

然后查看 calico-packet-logs Pod 的日志，比如

```sh
kubectl logs calico-packet-logs-xxxx
```
