# 集群状态异常排错

本章介绍集群状态异常的排错方法，包括 Kubernetes 主要组件以及必备扩展（如 kube-dns）等，而有关网络的异常排错请参考[网络异常排错方法](network.md)。

排查集群状态异常问题通常从 Node 和 Kubernetes 服务 的状态出发，定位出具体的异常服务，再进而寻找解决方法。集群状态异常可能的原因比较多，常见的有

* 虚拟机或物理机宕机
* 网络分区
* Kubernetes 服务未正常启动
* 数据丢失或持久化存储不可用（一般在公有云或私有云平台中）
* 操作失误（如配置错误）

从具体的场景来说

* kube-apiserver 无法启动会导致
  * 集群不可访问
  * 已有的 Pod 和服务正常运行（依赖于 Kubernetes API 的除外）
* etcd 集群异常会导致
  * kube-apiserver 无法正常读写集群状态，进而导致 Kubernetes API 访问出错
  * kubelet 无法周期性更新状态
* kube-controller-manager/kube-scheduler 异常会导致
  * 复制控制器、节点控制器、云服务控制器等无法工作，从而导致 Deployment、Service 等无法工作，也无法注册新的 Node 到集群中来
  * 新创建的 Pod 无法调度（总是 Pending 状态）
* Node 本身宕机或者 Kubelet 无法启动会导致
  * Node 上面的 Pod 无法正常运行
  * 已在运行的 Pod 无法正常终止
* 网络分区会导致 Kubelet 等与控制平面通信异常以及 Pod 之间通信异常

为了维持集群的健康状态，推荐在部署集群时就考虑以下

* 在云平台上开启 VM 的自动重启功能
* 为 Etcd 配置多节点高可用集群，使用持久化存储（如 AWS EBS 等），定期备份数据
* 为控制平面配置高可用，比如多 kube-apiserver 负载均衡以及多节点运行 kube-controller-manager、kube-scheduler 以及 kube-dns 等
* 尽量使用复制控制器和 Service，而不是直接管理 Pod
* 跨地域的多 Kubernetes 集群

### 查看 Node 状态

一般来说，可以首先查看 Node 的状态，确认 Node 本身是不是 Ready 状态

```sh
kubectl get nodes
kubectl describe node <node-name>
```

如果是 NotReady 状态，则可以执行 `kubectl describe node <node-name>` 命令来查看当前 Node 的事件。这些事件通常都会有助于排查 Node 发生的问题。

### 查看日志

一般来说，Kubernetes 的主要组件有两种部署方法

* 直接使用 systemd 等启动控制节点的各个服务
* 使用 Static Pod 来管理和启动控制节点的各个服务

使用 systemd 等管理控制节点服务时，查看日志必须要首先 SSH 登录到机器上，然后查看具体的日志文件。如

```sh
journalctl -l -u kube-apiserver
journalctl -l -u kube-controller-manager
journalctl -l -u kube-scheduler
journalctl -l -u kubelet
journalctl -l -u kube-proxy
```

或者直接查看日志文件

- /var/log/kube-apiserver.log
- /var/log/kube-scheduler.log
- /var/log/kube-controller-manager.log


- /var/log/kubelet.log
- /var/log/kube-proxy.log

而对于使用 Static Pod 部署集群控制平面服务的场景，可以参考下面这些查看日志的方法。

#### kube-apiserver 日志

```sh
PODNAME=$(kubectl -n kube-system get pod -l component=kube-apiserver -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100
```

#### kube-controller-manager 日志

```sh
PODNAME=$(kubectl -n kube-system get pod -l component=kube-controller-manager -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100
```

#### kube-scheduler 日志

```sh
PODNAME=$(kubectl -n kube-system get pod -l component=kube-scheduler -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100
```

#### kube-dns 日志

```sh
PODNAME=$(kubectl -n kube-system get pod -l k8s-app=kube-dns -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME -c kubedns
```

#### Kubelet 日志

查看 Kubelet 日志需要首先 SSH 登录到 Node 上。

```sh
journalctl -l -u kubelet
```

#### Kube-proxy 日志

Kube-proxy 通常以 DaemonSet 的方式部署

```sh
$ kubectl -n kube-system get pod -l component=kube-proxy
NAME               READY     STATUS    RESTARTS   AGE
kube-proxy-42zpn   1/1       Running   0          1d
kube-proxy-7gd4p   1/1       Running   0          3d
kube-proxy-87dbs   1/1       Running   0          4d
$ kubectl -n kube-system logs kube-proxy-42zpn
```

## Kube-dns/Dashboard CrashLoopBackOff

由于 Dashboard 依赖于 kube-dns，所以这个问题一般是由于 kube-dns 无法正常启动导致的。查看 kube-dns 的日志

```sh
$ kubectl logs --namespace=kube-system $(kubectl get pods --namespace=kube-system -l k8s-app=kube-dns -o name) -c kubedns
$ kubectl logs --namespace=kube-system $(kubectl get pods --namespace=kube-system -l k8s-app=kube-dns -o name) -c dnsmasq
$ kubectl logs --namespace=kube-system $(kubectl get pods --namespace=kube-system -l k8s-app=kube-dns -o name) -c sidecar
```

可以发现如下的错误日志

```sh
Waiting for services and endpoints to be initialized from apiserver...
skydns: failure to forward request "read udp 10.240.0.18:47848->168.63.129.16:53: i/o timeout"
Timeout waiting for initialization
```

这说明 kube-dns pod 无法转发 DNS 请求到上游 DNS 服务器。解决方法为

- 如果使用的 Docker 版本大于 1.12，则在每个 Node 上面运行 `iptables -P FORWARD ACCEPT`
- 等待一段时间，如果还未恢复，则检查 Node 网络是否正确配置，比如是否可以正常请求上游DNS服务器、是否有安全组禁止了 DNS 请求等


如果错误日志中不是转发 DNS 请求超时，而是访问 kube-apiserver 超时，比如

```sh
E0122 06:56:04.774977       1 reflector.go:199] k8s.io/dns/vendor/k8s.io/client-go/tools/cache/reflector.go:94: Failed to list *v1.Endpoints: Get https://10.0.0.1:443/api/v1/endpoints?resourceVersion=0: dial tcp 10.0.0.1:443: i/o timeout
I0122 06:56:04.775358       1 dns.go:174] Waiting for services and endpoints to be initialized from apiserver...
E0122 06:56:04.775574       1 reflector.go:199] k8s.io/dns/vendor/k8s.io/client-go/tools/cache/reflector.go:94: Failed to list *v1.Service: Get https://10.0.0.1:443/api/v1/services?resourceVersion=0: dial tcp 10.0.0.1:443: i/o timeout
I0122 06:56:05.275295       1 dns.go:174] Waiting for services and endpoints to be initialized from apiserver...
I0122 06:56:05.775182       1 dns.go:174] Waiting for services and endpoints to be initialized from apiserver...
I0122 06:56:06.275288       1 dns.go:174] Waiting for services and endpoints to be initialized from apiserver...
```

这说明 Pod 网络（一般是多主机之间）访问异常，包括 Pod->Node、Node->Pod 以及 Node-Node 等之间的往来通信异常。可能的原因比较多，具体的排错方法可以参考[网络异常排错指南](network.md)。

## Failed to start ContainerManager failed to initialise top level QOS containers 

重启 kubelet 时报错 `Failed to start ContainerManager failed to initialise top level QOS containers `（参考 [#43856](https://github.com/kubernetes/kubernetes/issues/43856)），解决方法是：

1. 在docker.service配置中增加的`--exec-opt native.cgroupdriver=systemd`配置。
2. 手动删除slice（貌似不管用）
3. 重启主机，这招最管用😄

```bash
for i in $(systemctl list-unit-files —no-legend —no-pager -l | grep —color=never -o .*.slice | grep kubepod);do systemctl stop $i;done
```

上面的几种方法在该bug修复前只有重启主机管用，该bug已于2017年4月27日修复（v1.7.0+），见 [#44940](https://github.com/kubernetes/kubernetes/pull/44940)。

## conntrack returned error: error looking for path of conntrack

kube-proxy 报错，并且 service 的 DNS 解析异常

```sh
kube-proxy[2241]: E0502 15:55:13.889842    2241 conntrack.go:42] conntrack returned error: error looking for path of conntrack: exec: "conntrack": executable file not found in $PATH
```

解决方式是安装 `conntrack-tools` 包后重启 kube-proxy 即可。

## 参考文档

* [Troubleshoot Clusters](https://kubernetes.io/docs/tasks/debug-application-cluster/debug-cluster/)
