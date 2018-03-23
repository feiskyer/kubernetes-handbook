# 云平台排错

本章主要介绍在公有云中运行 Kubernetes 时可能会碰到的问题以及解决方法。

在公有云平台上运行 Kubernetes，一般可以使用云平台提供的托管 Kubernetes 服务（比如 Google 的 GKE、微软 Azure 的 AKS 或者 AWS 的 Amazon EKS 等）。当然，为了更自由的灵活性，也可以直接在这些公有云平台的虚拟机中部署 Kubernetes。无论哪种方法，一般都需要给 Kubernetes 配置 Cloud Provider 选项，以方便直接利用云平台提供的高级网络、持久化存储以及安全控制等功能。

而在云平台中运行 Kubernetes 的常见问题有

* 认证授权问题：比如 Kubernetes Cloud Provider 中配置的认证方式无权操作虚拟机所在的网络或持久化存储。这一般从 kube-controller-manager 的日志中很容易发现。
* 网络路由配置失败：正常情况下，Cloud Provider 会为每个 Node 配置一条 PodCIDR 至 NodeIP 的路由规则，如果这些规则有问题就会导致多主机 Pod 相互访问的问题。
* 公网 IP 分配失败：比如 LoadBalancer 类型的 Service 无法分配公网 IP 或者指定的公网 IP 无法使用。这一版也是配置错误导致的。
* 安全组配置失败：比如无法为 Service 创建安全组（如超出配额等）或与已有的安全组冲突等。
* 持久化存储分配或者挂载问题：比如分配 PV 失败（如超出配额、配置错误等）或挂载到虚拟机失败（比如 PV 正被其他异常 Pod 引用而导致无法从旧的虚拟机中卸载）。
* 网络插件使用不当：比如网络插件使用了云平台不支持的网络协议等。


## Node 未注册到集群中

通常，在 Kubelet 启动时会自动将自己注册到 kubernetes API 中，然后通过 `kubectl get nodes` 就可以查询到该节点。 如果新的 Node 没有自动注册到 Kubernetes 集群中，那说明这个注册过程有错误发生，需要检查 kubelet 和 kube-controller-manager 的日志，进而再根据日志查找具体的错误原因。

### Kubelet 日志

查看 Kubelet 日志需要首先 SSH 登录到 Node 上，然后运行 `journalctl` 命令查看 kubelet 的日志：

```sh
journalctl -l -u kubelet
```

### kube-controller-manager 日志

kube-controller-manager 会自动在云平台中给 Node 创建路由，如果路由创建创建失败也有可能导致 Node 注册失败。

```sh
PODNAME=$(kubectl -n kube-system get pod -l component=kube-controller-manager -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100
```
