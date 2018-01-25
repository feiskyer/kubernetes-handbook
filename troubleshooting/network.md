# 网络异常排错

## Pod 无法解析 DNS 并请求外网

如果使用的 Docker 版本大于 1.12，那么 Docker 会把默认的 iptables FORWARD 策略改为 DROP。这会引发 Pod 网络访问的问题。解决方法则在每个 Node 上面运行 `iptables -P FORWARD ACCEPT`。如果使用了 flannel/weave 网络插件，更新为最新版本也可以解决这个问题。
