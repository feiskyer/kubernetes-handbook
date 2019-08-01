# Operator

Operator 是 CoreOS 推出的旨在簡化複雜有狀態應用管理的框架，它是一個感知應用狀態的控制器，通過擴展 Kubernetes API 來自動創建、管理和配置應用實例。

你可以在 [OperatorHub.io](https://www.operatorhub.io/) 上查看 Kubernetes 社區推薦的一些 Operator 範例。

## Operator 原理

Operator 基於 Third Party Resources 擴展了新的應用資源，並通過控制器來保證應用處於預期狀態。比如 etcd operator 通過下面的三個步驟模擬了管理 etcd 集群的行為：

1. 通過 Kubernetes API 觀察集群的當前狀態；
2. 分析當前狀態與期望狀態的差別；
3. 調用 etcd 集群管理 API 或 Kubernetes API 消除這些差別。

![etcd](images/etcd.png)

## 如何創建 Operator

Operator 是一個感知應用狀態的控制器，所以實現一個 Operator 最關鍵的就是把管理應用狀態的所有操作封裝到配置資源和控制器中。通常來說 Operator 需要包括以下功能：

- Operator 自身以 deployment 的方式部署
- Operator 自動創建一個 Third Party Resources 資源類型，用戶可以用該類型創建應用實例
- Operator 應該利用 Kubernetes 內置的 Serivce/ReplicaSet 等管理應用
- Operator 應該向後兼容，並且在 Operator 自身退出或刪除時不影響應用的狀態
- Operator 應該支持應用版本更新
- Operator 應該測試 Pod 失效、配置錯誤、網絡錯誤等異常情況

要創建一個新的 Operator，最簡單的方法使用 [Operator Framework](https://github.com/operator-framework)。比如，要創建一個最簡單的 Operator，需要以下幾個步驟:

（1）安裝 operator-sdk 工具：

```sh
$ mkdir -p $GOPATH/src/github.com/operator-framework
$ cd $GOPATH/src/github.com/operator-framework
$ git clone https://github.com/operator-framework/operator-sdk
$ cd operator-sdk
$ git checkout master
$ make dep
$ make install
```

（2）初始化項目：

```sh
$ mkdir -p $GOPATH/src/github.com/example-inc/
$ cd $GOPATH/src/github.com/example-inc/
$ operator-sdk new memcached-operator
$ cd memcached-operator
```

（3）添加 CRD 定義和控制器：

```sh
$ operator-sdk add api --api-version=cache.example.com/v1alpha1 --kind=Memcached
$ operator-sdk add controller --api-version=cache.example.com/v1alpha1 --kind=Memcached
```

（4）實現 Controller、Reconciler 等控制邏輯。

（5）部署 Operator 到 Kubernetes 集群中，並通過自定義的 CRD 創建資源。

完整的示例可以參考 [這裡](https://github.com/operator-framework/operator-sdk/blob/master/doc/user-guide.md)。

## 如何使用 Operator

為了方便描述，以 Etcd Operator 為例，具體的鏈接可以參考 -[Etcd Operator](https://coreos.com/operators/etcd/docs/latest)。

在 Kubernetes 部署 Operator：
通過在 Kubernetes 集群中創建一個 deploymet 實例，來部署對應的 Operator。具體的 Yaml 示例如下：

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

對應的有狀態服務 yaml 文件示例如下：

```yaml
apiVersion: "etcd.coreos.com/v1beta1"
kind: "Cluster"
metadata:
  name: "example-etcd-cluster"
spec:
  size: 3
  version: "3.1.8"
```

部署對應的有狀態服務：

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

## 與其他工具的關係

- StatefulSets：StatefulSets 為有狀態服務提供了 DNS、持久化存儲等，而 Operator 可以自動處理服務失效、備份、重配置等複雜的場景。
- Puppet：Puppet 是一個靜態配置工具，而 Operator 則可以實時、動態地保證應用處於預期狀態
- Helm：Helm 是一個打包工具，可以將多個應用打包到一起部署，而 Operator 則可以認為是 Helm 的補充，用來動態保證這些應用的正常運行

## 參考資料

- [Kubernetes Operators](https://coreos.com/operators)
- [Operator Framework](https://github.com/operator-framework)
- [OperatorHub.io](https://www.operatorhub.io/)
- [KubeDB: Run production-grade databases easily on Kubernetes](https://kubedb.com/)

