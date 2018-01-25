# 集群状态异常排错

## Kube-dns/Dashboard CrashLoopBackOff

由于 Dashboard 依赖于 kube-dns，所以这个问题一般是由于 kube-dns 无法正常启动导致的。查看 kube-dns 的日志，可以发现如下的错误日志

```sh
Waiting for services and endpoints to be initialized from apiserver...
skydns: failure to forward request "read udp 10.240.0.18:47848->168.63.129.16:53: i/o timeout"
Timeout waiting for initialization
```

这说明 kube-dns pod 无法转发 DNS 请求到上游 DNS 服务器。解决方法为

- 如果使用的 Docker 版本大于 1.12，则在每个 Node 上面运行 `iptables -P FORWARD ACCEPT`
- 等待一段时间，如果还未恢复，则检查 Node 网络是否正确配置，比如是否可以正常请求上游DNS服务器、是否有安全组禁止了 DNS 请求等


## Failed to start ContainerManager failed to initialise top level QOS containers 

重启 kubelet 时报错（参考 [#43856](https://github.com/kubernetes/kubernetes/issues/43856)），目前的解决方法是：

1.在docker.service配置中增加的`--exec-opt native.cgroupdriver=systemd`配置。
2.手动删除slice（貌似不管用）
3.重启主机，这招最管用😄

```bash
for i in $(systemctl list-unit-files —no-legend —no-pager -l | grep —color=never -o .*.slice | grep kubepod);do systemctl stop $i;done
```

上面的几种方法在该bug修复前只有重启主机管用，该bug已于2017年4月27日修复，见 [#44940](https://github.com/kubernetes/kubernetes/pull/44940)。

## conntrack returned error: error looking for path of conntrack

kube-proxy 报错，并且 service 的 DNS 解析异常

```sh
kube-proxy[2241]: E0502 15:55:13.889842    2241 conntrack.go:42] conntrack returned error: error looking for path of conntrack: exec: "conntrack": executable file not found in $PATH
```

解决方式是安装 `conntrack-tools` 包后重启 kube-proxy 即可。
