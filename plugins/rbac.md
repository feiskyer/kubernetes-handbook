# RBAC

Kubernetes 從 1.6 開始支持基於角色的訪問控制機制（Role-Based Access，RBAC），集群管理員可以對用戶或服務賬號的角色進行更精確的資源訪問控制。在 RBAC 中，權限與角色相關聯，用戶通過成為適當角色的成員而得到這些角色的權限。這就極大地簡化了權限的管理。在一個組織中，角色是為了完成各種工作而創造，用戶則依據它的責任和資格來被指派相應的角色，用戶可以很容易地從一個角色被指派到另一個角色。

## 前言

[Kubernetes 1.6](http://blog.kubernetes.io/2017/03/kubernetes-1.6-multi-user-multi-workloads-at-scale.html) 中的一個亮點時 RBAC 訪問控制機制升級到了 beta 版本（版本為 `rbac.authorization.k8s.io/v1beta1` ）。RBAC，基於角色的訪問控制機制，是用來管理 kubernetes 集群中資源訪問權限的機制。使用 RBAC 可以很方便的更新訪問授權策略而不用重啟集群。

從 Kubernetes 1.8 開始，RBAC 進入穩定版，其 API 為 `rbac.authorization.k8s.io/v1`。

在使用 RBAC 時，只需要在啟動 kube-apiserver 時配置 `--authorization-mode=RBAC` 即可。

## RBAC vs ABAC

目前 kubernetes 中已經有一系列 l [鑑權機制](https://kubernetes.io/docs/admin/authorization/)。鑑權的作用是，決定一個用戶是否有權使用 Kubernetes API 做某些事情。它除了會影響 kubectl 等組件之外，還會對一些運行在集群內部並對集群進行操作的軟件產生作用，例如使用了 Kubernetes 插件的 Jenkins，或者是利用 Kubernetes API 進行軟件部署的 Helm。ABAC 和 RBAC 都能夠對訪問策略進行配置。

ABAC（Attribute Based Access Control）本來是不錯的概念，但是在 Kubernetes 中的實現比較難於管理和理解，而且需要對 Master 所在節點的 SSH 和文件系統權限，而且要使得對授權的變更成功生效，還需要重新啟動 API Server。

而 RBAC 的授權策略可以利用 kubectl 或者 Kubernetes API 直接進行配置。**RBAC 可以授權給用戶，讓用戶有權進行授權管理，這樣就可以無需接觸節點，直接進行授權管理。**RBAC 在 Kubernetes 中被映射為 API 資源和操作。

因為 Kubernetes 社區的投入和偏好，相對於 ABAC 而言，RBAC 是更好的選擇。

## 基礎概念

需要理解 RBAC 一些基礎的概念和思路，RBAC 是讓用戶能夠訪問 [Kubernetes API 資源](https://kubernetes.io/docs/api-reference/v1.15/) 的授權方式。

![RBAC 架構圖 1](images/rbac1.png)

在 RBAC 中定義了兩個對象，用於描述在用戶和資源之間的連接權限。

### Role 與 ClusterRole

Role（角色）是一系列權限的集合，例如一個角色可以包含讀取 Pod 的權限和列出 Pod 的權限。Role 只能用來給某個特定 namespace 中的資源作鑑權，對多 namespace 和集群級的資源或者是非資源類的 API（如 `/healthz`）使用 ClusterRole。

```yaml
# Role 示例
kind: Role
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  namespace: default
  name: pod-reader
rules:
- apiGroups: [""] #"" indicates the core API group
  resources: ["pods"]
  verbs: ["get", "watch", "list"]
```

```yaml
# ClusterRole 示例
kind: ClusterRole
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  # "namespace" omitted since ClusterRoles are not namespaced
  name: secret-reader
rules:
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get", "watch", "list"]
```

### RoleBinding 和 ClusterRoleBinding

RoleBinding 把角色（Role 或 ClusterRole）的權限映射到用戶或者用戶組，從而讓這些用戶繼承角色在 namespace 中的權限。ClusterRoleBinding 讓用戶繼承 ClusterRole 在整個集群中的權限。

注意 ServiceAccount 的用戶名格式為 `system:serviceaccount:<service-account-name>`，並且都屬於 `system:serviceaccounts:` 用戶組。

```yaml
# RoleBinding 示例（引用 Role）
# This role binding allows "jane" to read pods in the "default" namespace.
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: read-pods
  namespace: default
subjects:
- kind: User
  name: jane
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

![RBAC 架構圖 2](images/rbac2.png)

```yaml
# RoleBinding 示例（引用 ClusterRole）
# This role binding allows "dave" to read secrets in the "development" namespace.
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: read-secrets
  namespace: development # This only grants permissions within the "development" namespace.
subjects:
- kind: User
  name: dave
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: secret-reader
  apiGroup: rbac.authorization.k8s.io
```

### ClusterRole 聚合

從 v1.9 開始，在 ClusterRole 中可以通過 `aggregationRule` 來與其他 ClusterRole 聚合使用（該特性在 v1.11 GA）。

比如

```yaml
kind: ClusterRole
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: monitoring
aggregationRule:
  clusterRoleSelectors:
  - matchLabels:
      rbac.example.com/aggregate-to-monitoring: "true"
rules: [] # Rules are automatically filled in by the controller manager.
---
kind: ClusterRole
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: monitoring-endpoints
  labels:
    rbac.example.com/aggregate-to-monitoring: "true"
# These rules will be added to the "monitoring" role.
rules:
- apiGroups: [""]
  resources: ["services", "endpoints", "pods"]
  verbs: ["get", "list", "watch"]
```

### 默認 ClusterRole

RBAC 現在被 Kubernetes 深度集成，並使用它給系統組件進行授權。[System Roles](https://kubernetes.io/docs/admin/authorization/rbac/#default-roles-and-role-bindings) 一般具有前綴 `system:`，很容易識別：

```bash
$ kubectl get clusterroles --namespace=kube-system
NAME                                           AGE
admin                                          10d
cluster-admin                                  10d
edit                                           10d
system:auth-delegator                          10d
system:basic-user                              10d
system:controller:attachdetach-controller      10d
system:controller:certificate-controller       10d
system:controller:cronjob-controller           10d
system:controller:daemon-set-controller        10d
system:controller:deployment-controller        10d
system:controller:disruption-controller        10d
system:controller:endpoint-controller          10d
system:controller:generic-garbage-collector    10d
system:controller:horizontal-pod-autoscaler    10d
system:controller:job-controller               10d
system:controller:namespace-controller         10d
system:controller:node-controller              10d
system:controller:persistent-volume-binder     10d
system:controller:pod-garbage-collector        10d
system:controller:replicaset-controller        10d
system:controller:replication-controller       10d
system:controller:resourcequota-controller     10d
system:controller:route-controller             10d
system:controller:service-account-controller   10d
system:controller:service-controller           10d
system:controller:statefulset-controller       10d
system:controller:ttl-controller               10d
system:discovery                               10d
system:heapster                                10d
system:kube-aggregator                         10d
system:kube-controller-manager                 10d
system:kube-dns                                10d
system:kube-scheduler                          10d
system:node                                    10d
system:node-bootstrapper                       10d
system:node-problem-detector                   10d
system:node-proxier                            10d
system:persistent-volume-provisioner           10d
view                                           10d
```

其他的內置角色可以參考 [default-roles-and-role-bindings](https://kubernetes.io/docs/admin/authorization/rbac/#default-roles-and-role-bindings)。

RBAC 系統角色已經完成足夠的覆蓋，讓集群可以完全在 RBAC 的管理下運行。

## 從 ABAC 遷移到 RBAC

在 ABAC 到 RBAC 進行遷移的過程中，有些在 ABAC 集群中缺省開放的權限，在 RBAC 中會被視為不必要的授權，會對其進行 [降級](https://kubernetes.io/docs/admin/authorization/rbac/#upgrading-from-15)。這種情況會影響到使用 Service Account 的應用。ABAC 配置中，從 Pod 中發出的請求會使用 Pod Token，API Server 會為其授予較高權限。例如下面的命令在 ABAC 集群中會返回 JSON 結果，而在 RBAC 的情況下則會返回錯誤。

```bash
$ kubectl run nginx --image=nginx:latest
$ kubectl exec -it $(kubectl get pods -o jsonpath='{.items[0].metadata.name}') bash
$ apt-get update && apt-get install -y curl
$ curl -ik \
  -H "Authorization: Bearer $(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" \
  https://kubernetes/api/v1/namespaces/default/pods
```

所有在 Kubernetes 集群中運行的應用，一旦和 API Server 進行通信，都會有可能受到遷移的影響。

要平滑的從 ABAC 升級到 RBAC，在創建 1.6 集群的時候，可以同時啟用 [ABAC 和 RBAC](https://kubernetes.io/docs/admin/authorization/rbac/#parallel-authorizers)。當他們同時啟用的時候，對一個資源的權限請求，在任何一方獲得放行都會獲得批准。然而在這種配置下的權限太過粗放，很可能無法在單純的 RBAC 環境下工作。

目前 RBAC 已經進入穩定版，ABAC 可能會被棄用。在可見的未來 ABAC 依然會保留在 kubernetes 中，不過開發的重心已經轉移到了 RBAC。

## Permissive RBAC

所謂 Permissive RBAC 是指授權給所有的 Service Accounts 管理員權限。注意，這是一個不推薦的配置。

```sh
kubectl create clusterrolebinding permissive-binding \
  --clusterrole=cluster-admin \
  --user=admin \
  --user=kubelet \
  --group=system:serviceaccounts
```

## 推薦配置

- 針對 namespace 內資源的訪問權限，使用 Role 和 RoleBinding
- 針對集群級別的資源或者所有 namespace 的特定資源訪問，使用 ClustetRole 和 ClusterRoleBinding
- 針對多個有限 namespace 的特定資源訪問，使用 ClusterRole 和 RoleBinding

## 開源工具

- [liggitt/audit2rbac](https://github.com/liggitt/audit2rbac)
- [reactiveops/rbac-manager](https://github.com/reactiveops/rbac-manager)
- [jtblin/kube2iam](https://github.com/jtblin/kube2iam)

## 參考文檔

- [RBAC documentation](https://kubernetes.io/docs/admin/authorization/rbac/)
- [Google Cloud Next talks 1](https://www.youtube.com/watch?v=Cd4JU7qzYbE#t=8m01s )
- [Google Cloud Next talks 2](https://www.youtube.com/watch?v=18P7cFc6nTU#t=41m06s )
- [在 Kubernetes Pod 中使用 Service Account 訪問 API Server](http://tonybai.com/2017/03/03/access-api-server-from-a-pod-through-serviceaccount/)
- 部分翻譯自 [RBAC Support in Kubernetes](http://blog.kubernetes.io/2017/04/rbac-support-in-kubernetes.html)（轉載自[kubernetes 中文社區](https://www.kubernetes.org.cn/1879.html)，譯者催總，[Jimmy Song](http://rootsongjc.github.com/about) 做了稍許修改）
