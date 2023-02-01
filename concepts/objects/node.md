# Node

Node 是 Pod 真正运行的主机，可以是物理机，也可以是虚拟机。为了管理 Pod，每个 Node 节点上至少要运行 container runtime（比如 `docker` 或者 `rkt`）、`kubelet` 和 `kube-proxy` 服务。

![node](../../.gitbook/assets/node%20%284%29.png)

## Node 管理

不像其他的资源（如 Pod 和 Namespace），Node 本质上不是 Kubernetes 来创建的，Kubernetes 只是管理 Node 上的资源。虽然可以通过 Manifest 创建一个 Node 对象（如下 yaml 所示），但 Kubernetes 也只是去检查是否真的是有这么一个 Node，如果检查失败，也不会往上调度 Pod。

```yaml
kind: Node
apiVersion: v1
metadata:
  name: 10-240-79-157
  labels:
    name: my-first-k8s-node
```

这个检查是由 Node Controller 来完成的。Node Controller 负责

* 维护 Node 状态
* 与 Cloud Provider 同步 Node
* 给 Node 分配容器 CIDR
* 删除带有 `NoExecute` taint 的 Node 上的 Pods

默认情况下，kubelet 在启动时会向 master 注册自己，并创建 Node 资源。

## Node 的状态

每个 Node 都包括以下状态信息：

* 地址：包括 hostname、外网 IP 和内网 IP
* 条件（Condition）：包括 OutOfDisk、Ready、MemoryPressure 和 DiskPressure
* 容量（Capacity）：Node 上的可用资源，包括 CPU、内存和 Pod 总数
* 基本信息（Info）：包括内核版本、容器引擎版本、OS 类型等

## Taints 和 tolerations

Taints 和 tolerations 用于保证 Pod 不被调度到不合适的 Node 上，Taint 应用于 Node 上，而 toleration 则应用于 Pod 上（Toleration 是可选的）。

比如，可以使用 taint 命令给 node1 添加 taints：

```bash
kubectl taint nodes node1 key1=value1:NoSchedule
kubectl taint nodes node1 key1=value2:NoExecute
```

Taints 和 tolerations 的具体使用方法请参考 [调度器章节](../components/scheduler.md#Taints%20和%20tolerations)。

## Node 维护模式

标志 Node 不可调度但不影响其上正在运行的 Pod，这在维护 Node 时是非常有用的：

```bash
kubectl cordon $NODENAME
```

## Node 优雅关闭

当配置 `ShutdownGracePeriod` 和 `ShutdownGracePeriodCriticalPods` 后，Kubelet 会根据 systemd 事件检测 Node 的关闭状态，并自动终止其上运行的 Pod（ShutdownGracePeriodCriticalPods 需要小于 ShutdownGracePeriod）。注意，这两个参数默认配置为 0，即优雅关闭特性默认是未开启的。

比如，如果 ShutdownGracePeriod 设置为 30s，而 ShutdownGracePeriodCriticalPods 设置为 10s，那么 Kubelet 将使节点关闭延迟 30 秒。 在关闭期间，将保留前20（30-10）秒以终止普通 Pod，而保留最后 10 秒以终止关键 Pod。

## Node 非优雅关闭

在 Node 发生异常的情况下，Kubelet 可能没有机会检测并执行优雅关闭。在这种情况下，StatefulSet 无法创建同名的新 Pod，如果 Pod 使用了卷，则 VolumeAttachments 不会从原来的已关闭节点上删除，因此这些 Pod 所使用的卷也无法挂接到新的运行节点上。

Node 非优雅关闭正是为了解决这些问题。用户可以手动将具有 `NoExecute` 或 `NoSchedule` 效果的 `node.kubernetes.io/out-of-service` 污点添加到节点上，标记其无法提供服务。如果在 kube-controller-manager 上启用了 `NodeOutOfServiceVolumeDetach` 特性，并且 Pod 上没有设置对应的容忍度，那么这些 Pod 将被强制删除，并且该在节点上被终止的 Pod 将立即进行卷卸载操作。这样就允许那些在无法提供服务节点上的 Pod 能在其他节点上快速恢复。

## 参考文档

* [Kubernetes Node](https://kubernetes.io/docs/concepts/architecture/nodes/)
* [Taints 和 tolerations](https://kubernetes.io/docs/concepts/configuration/assign-pod-node/#taints-and-tolerations-beta-feature)
