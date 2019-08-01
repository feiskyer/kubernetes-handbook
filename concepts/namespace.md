# Namespace

Namespace 是對一組資源和對象的抽象集合，比如可以用來將系統內部的對象劃分為不同的項目組或用戶組。常見的 pod, service, replication controller 和 deployment 等都是屬於某一個 namespace 的（默認是 default），而 node, persistent volume，namespace 等資源則不屬於任何 namespace。

Namespace 常用來隔離不同的用戶，比如 Kubernetes 自帶的服務一般運行在 `kube-system` namespace 中。

## Namespace 操作

> `kubectl` 可以通過 `--namespace` 或者 `-n` 選項指定 namespace。如果不指定，默認為 default。查看操作下, 也可以通過設置 --all-namespace=true 來查看所有 namespace 下的資源。

### 查詢

```sh
$ kubectl get namespaces
NAME          STATUS    AGE
default       Active    11d
kube-system   Active    11d
```

注意：namespace 包含兩種狀態 "Active" 和 "Terminating"。在 namespace 刪除過程中，namespace 狀態被設置成 "Terminating"。


### 創建

```sh
(1) 命令行直接創建
$ kubectl create namespace new-namespace

(2) 通過文件創建
$ cat my-namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: new-namespace

$ kubectl create -f ./my-namespace.yaml

```

注意：命名空間名稱滿足正則表達式 `[a-z0-9]([-a-z0-9]*[a-z0-9])?`, 最大長度為 63 位



### 刪除

```sh
$ kubectl delete namespaces new-namespace
```

注意：

1. 刪除一個 namespace 會自動刪除所有屬於該 namespace 的資源。
2. `default` 和 `kube-system` 命名空間不可刪除。
3. PersistentVolume 是不屬於任何 namespace 的，但 PersistentVolumeClaim 是屬於某個特定 namespace 的。
4. Event 是否屬於 namespace 取決於產生 event 的對象。
5. v1.7 版本增加了 `kube-public` 命名空間，該命名空間用來存放公共的信息，一般以 ConfigMap 的形式存放。

```sh
$ kubectl get configmap  -n=kube-public
NAME           DATA      AGE
cluster-info   2         29d
```

## 參考文檔

- [Kubernetes Namespace](https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/)
- [Share a Cluster with Namespaces](https://kubernetes.io/docs/tasks/administer-cluster/namespaces/)
