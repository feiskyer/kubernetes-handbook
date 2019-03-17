# Operator

Operator 是 CoreOS 推出的旨在简化复杂有状态应用管理的框架，它是一个感知应用状态的控制器，通过扩展 Kubernetes API 来自动创建、管理和配置应用实例。

你可以在 [OperatorHub.io](https://www.operatorhub.io/) 上查看 Kubernetes 社区推荐的一些 Operator 范例。

## Operator 原理

Operator 基于 Third Party Resources 扩展了新的应用资源，并通过控制器来保证应用处于预期状态。比如 etcd operator 通过下面的三个步骤模拟了管理 etcd 集群的行为：

1. 通过 Kubernetes API 观察集群的当前状态；
2. 分析当前状态与期望状态的差别；
3. 调用 etcd 集群管理 API 或 Kubernetes API 消除这些差别。

![etcd](images/etcd.png)

## 如何创建 Operator

Operator 是一个感知应用状态的控制器，所以实现一个 Operator 最关键的就是把管理应用状态的所有操作封装到配置资源和控制器中。通常来说 Operator 需要包括以下功能：

- Operator 自身以 deployment 的方式部署
- Operator 自动创建一个 Third Party Resources 资源类型，用户可以用该类型创建应用实例
- Operator 应该利用 Kubernetes 内置的 Serivce/ReplicaSet 等管理应用
- Operator 应该向后兼容，并且在 Operator 自身退出或删除时不影响应用的状态
- Operator 应该支持应用版本更新
- Operator 应该测试 Pod 失效、配置错误、网络错误等异常情况

要创建一个新的 Operator，最简单的方法使用 [Operator Framework](https://github.com/operator-framework)。比如，要创建一个最简单的 Operator，需要以下几个步骤:

（1）安装 operator-sdk 工具：

```sh
$ mkdir -p $GOPATH/src/github.com/operator-framework
$ cd $GOPATH/src/github.com/operator-framework
$ git clone https://github.com/operator-framework/operator-sdk
$ cd operator-sdk
$ git checkout master
$ make dep
$ make install
```

（2）初始化项目：

```sh
$ mkdir -p $GOPATH/src/github.com/example-inc/
$ cd $GOPATH/src/github.com/example-inc/
$ operator-sdk new memcached-operator
$ cd memcached-operator
```

（3）添加 CRD 定义和控制器：

```sh
$ operator-sdk add api --api-version=cache.example.com/v1alpha1 --kind=Memcached
$ operator-sdk add controller --api-version=cache.example.com/v1alpha1 --kind=Memcached
```

（4）实现 Controller、Reconciler 等控制逻辑。

（5）部署 Operator 到 Kubernetes 集群中，并通过自定义的 CRD 创建资源。

完整的示例可以参考 [这里](https://github.com/operator-framework/operator-sdk/blob/master/doc/user-guide.md)。

## 如何使用 Operator

为了方便描述，以 Etcd Operator 为例，具体的链接可以参考 -[Etcd Operator](https://coreos.com/operators/etcd/docs/latest)。

在 Kubernetes 部署 Operator：
通过在 Kubernetes 集群中创建一个 deploymet 实例，来部署对应的 Operator。具体的 Yaml 示例如下：

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: admin
  namespace: default

---
kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1alpha1
metadata:
  name: admin
subjects:
  - kind: ServiceAccount
    name: admin
    namespace: default
roleRef:
  kind: ClusterRole
  name: cluster-admin
  apiGroup: rbac.authorization.k8s.io
---
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: etcd-operator
spec:
  replicas: 1
  template:
    metadata:
      labels:
        name: etcd-operator
    spec:
      serviceAccountName: admin
      containers:
      - name: etcd-operator
        image: quay.io/coreos/etcd-operator:v0.4.2
        env:
        - name: MY_POD_NAMESPACE
          valueFrom:
            fieldRef:
              fieldPath: metadata.namespace
        - name: MY_POD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
```

```sh
# kubectl create -f deployment.yaml
serviceaccount "admin" created
clusterrolebinding "admin" created
deployment "etcd-operator" created

# kubectl  get pod
NAME                            READY     STATUS    RESTARTS   AGE
etcd-operator-334633986-3nzk1   1/1       Running   0          31s
```

查看 operator 是否部署成功：

```sh
# kubectl get thirdpartyresources
NAME                      DESCRIPTION             VERSION(S)
cluster.etcd.coreos.com   Managed etcd clusters   v1beta1
```

对应的有状态服务 yaml 文件示例如下：

```yaml
apiVersion: "etcd.coreos.com/v1beta1"
kind: "Cluster"
metadata:
  name: "example-etcd-cluster"
spec:
  size: 3
  version: "3.1.8"
```

部署对应的有状态服务：

```sh
# kubectl create -f example-etcd-cluster.yaml
Cluster "example-etcd-cluster" created

# kubectl get  cluster
NAME                                        KIND
example-etcd-cluster   Cluster.v1beta1.etcd.coreos.com

# kubectl get  service
NAME                          CLUSTER-IP      EXTERNAL-IP   PORT(S)
example-etcd-cluster          None            <none>        2379/TCP,2380/TCP
example-etcd-cluster-client   10.105.90.190   <none>        2379/TCP

# kubectl get pod
NAME                            READY     STATUS    RESTARTS   AGE
example-etcd-cluster-0002       1/1       Running   0          5h
example-etcd-cluster-0003       1/1       Running   0          4h
example-etcd-cluster-0004       1/1       Running   0          4h
```

## 其他示例

- [Prometheus Operator](https://coreos.com/operators/prometheus/docs/latest)
- [Rook Operator](https://github.com/rook/rook): cloud-native storage orchestrator
- [Tectonic Operators](https://coreos.com/tectonic)
- https://github.com/sapcc/kubernetes-operators
- https://github.com/kbst/memcached
- https://github.com/Yolean/kubernetes-kafka
- https://github.com/krallistic/kafka-operator
- https://github.com/huawei-cloudfederation/redis-operator
- https://github.com/upmc-enterprises/elasticsearch-operator
- https://github.com/pires/nats-operator
- https://github.com/rosskukulinski/rethinkdb-operator
- https://istio.io/

## 与其他工具的关系

- StatefulSets：StatefulSets 为有状态服务提供了 DNS、持久化存储等，而 Operator 可以自动处理服务失效、备份、重配置等复杂的场景。
- Puppet：Puppet 是一个静态配置工具，而 Operator 则可以实时、动态地保证应用处于预期状态
- Helm：Helm 是一个打包工具，可以将多个应用打包到一起部署，而 Operator 则可以认为是 Helm 的补充，用来动态保证这些应用的正常运行

## 参考资料

- [Kubernetes Operators](https://coreos.com/operators)
- [Operator Framework](https://github.com/operator-framework)
- [OperatorHub.io](https://www.operatorhub.io/)
- [KubeDB: Run production-grade databases easily on Kubernetes](https://kubedb.com/)

