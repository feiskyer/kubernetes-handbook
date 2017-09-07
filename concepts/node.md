# Node

Node是Pod真正运行的主机，可以是物理机，也可以是虚拟机。为了管理Pod，每个Node节点上至少要运行container runtime（比如`docker`或者`rkt`）、`kubelet`和`kube-proxy`服务。

![node](images/node.png)

## Node管理

不像其他的资源（如Pod和Namespace），Node本质上不是Kubernetes来创建的，Kubernetes只是管理Node上的资源。虽然可以通过Manifest创建一个Node对象（如下yaml所示），但Kubernetes也只是去检查是否真的是有这么一个Node，如果检查失败，也不会往上调度Pod。

```yaml
kind: Node
apiVersion: v1
metadata:
  name: 10-240-79-157
  labels:
    name: my-first-k8s-node
```

这个检查是由Node Controller来完成的。Node Controller负责

- 维护Node状态
- 与Cloud Provider同步Node
- 给Node分配容器CIDR
- 删除带有`NoExecute` taint的Node上的Pods

默认情况下，kubelet在启动时会向master注册自己，并创建Node资源。

## Node的状态

每个Node都包括以下状态信息：

- 地址：包括hostname、外网IP和内网IP
- 条件（Condition）：包括OutOfDisk、Ready、MemoryPressure和DiskPressure
- 容量（Capacity）：Node上的可用资源，包括CPU、内存和Pod总数
- 基本信息（Info）：包括内核版本、容器引擎版本、OS类型等

## Taints和tolerations

Taints和tolerations用于保证Pod不被调度到不合适的Node上，Taint应用于Node上，而toleration则应用于Pod上（Toleration是可选的）。

比如，可以使用taint命令给node1添加taints：

```sh
kubectl taint nodes node1 key1=value1:NoSchedule
kubectl taint nodes node1 key1=value2:NoExecute
```

Taints和tolerations的具体使用方法请参考[调度器章节](../components/scheduler.md#Taints和tolerations)。

## Node维护模式

标志Node不可调度但不影响其上正在运行的Pod，这种维护Node时是非常有用的

```sh
kubectl cordon $NODENAME
```

## 参考文档

- [Kubernetes Node](https://kubernetes.io/docs/concepts/architecture/nodes/)
- [Taints和tolerations](https://kubernetes.io/docs/concepts/configuration/assign-pod-node/#taints-and-tolerations-beta-feature)
