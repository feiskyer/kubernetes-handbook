# Namespace

Namespace是对一组资源和对象的抽象集合，比如可以用来将系统内部的对象划分为不同的项目组或用户组。常见的pods, services, replication controllers和deployments等都是属于某一个namespace的（默认是default），而node, persistentVolumes等则不属于任何namespace。

Namespace常用来隔离不同的用户，比如Kubernetes自带的服务一般运行在`kube-system` namespace中。

## Namespace操作

> `kubectl`可以通过`--namespace`或者`-n`选项指定namespace。如果不指定，默认为default。

### 查询

```sh
$ kubectl get namespaces
NAME          STATUS    AGE
default       Active    11d
kube-system   Active    11d
```

### 创建

```sh
$ cat my-namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: new-namespace

$ kubectl create -f ./my-namespace.yaml
```

### 删除

```sh
$ kubectl delete namespaces new-namespace
```

注意，删除一个namespace会自动删除所有属于该namespace的资源。
