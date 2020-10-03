# 抓取 Calico 网络策略日志示例

使用方法：

```sh
kubectl apply -f calico-packet-logs.yaml
```

然后查看 calico-packet-logs Pod 的日志，比如

```sh
kubectl logs calico-packet-logs-xxxx
```
