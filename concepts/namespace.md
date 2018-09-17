# Namespace

Namespace 是对一组资源和对象的抽象集合，比如可以用来将系统内部的对象划分为不同的项目组或用户组。常见的 pod, service, replication controller 和 deployment 等都是属于某一个 namespace 的（默认是 default），而 node, persistent volume，namespace 等资源则不属于任何 namespace。

Namespace 常用来隔离不同的用户，比如 Kubernetes 自带的服务一般运行在 `kube-system` namespace 中。

## Namespace 操作

> `kubectl` 可以通过 `--namespace` 或者 `-n` 选项指定 namespace。如果不指定，默认为 default。查看操作下, 也可以通过设置 --all-namespace=true 来查看所有 namespace 下的资源。

### 查询

```sh
$ kubectl get namespaces
NAME          STATUS    AGE
default       Active    11d
kube-system   Active    11d
```

注意：namespace 包含两种状态 "Active" 和 "Terminating"。在 namespace 删除过程中，namespace 状态被设置成 "Terminating"。


### 创建

```sh
(1) 命令行直接创建
$ kubectl create namespace new-namespace

(2) 通过文件创建
$ cat my-namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: new-namespace

$ kubectl create -f ./my-namespace.yaml

```

注意：命名空间名称满足正则表达式 `[a-z0-9]([-a-z0-9]*[a-z0-9])?`, 最大长度为 63 位



### 删除

```sh
$ kubectl delete namespaces new-namespace
```

注意：

1. 删除一个 namespace 会自动删除所有属于该 namespace 的资源。
2. `default` 和 `kube-system` 命名空间不可删除。
3. PersistentVolume 是不属于任何 namespace 的，但 PersistentVolumeClaim 是属于某个特定 namespace 的。
4. Event 是否属于 namespace 取决于产生 event 的对象。
5. v1.7 版本增加了 `kube-public` 命名空间，该命名空间用来存放公共的信息，一般以 ConfigMap 的形式存放。

```sh
$ kubectl get configmap  -n=kube-public
NAME           DATA      AGE
cluster-info   2         29d
```

## 参考文档

- [Kubernetes Namespace](https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/)
- [Share a Cluster with Namespaces](https://kubernetes.io/docs/tasks/administer-cluster/namespaces/)
