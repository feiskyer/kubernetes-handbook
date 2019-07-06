# RBAC

Kubernetes 从 1.6 开始支持基于角色的访问控制机制（Role-Based Access，RBAC），集群管理员可以对用户或服务账号的角色进行更精确的资源访问控制。在 RBAC 中，权限与角色相关联，用户通过成为适当角色的成员而得到这些角色的权限。这就极大地简化了权限的管理。在一个组织中，角色是为了完成各种工作而创造，用户则依据它的责任和资格来被指派相应的角色，用户可以很容易地从一个角色被指派到另一个角色。

## 前言

[Kubernetes 1.6](http://blog.kubernetes.io/2017/03/kubernetes-1.6-multi-user-multi-workloads-at-scale.html) 中的一个亮点时 RBAC 访问控制机制升级到了 beta 版本（版本为 `rbac.authorization.k8s.io/v1beta1` ）。RBAC，基于角色的访问控制机制，是用来管理 kubernetes 集群中资源访问权限的机制。使用 RBAC 可以很方便的更新访问授权策略而不用重启集群。

从 Kubernetes 1.8 开始，RBAC 进入稳定版，其 API 为 `rbac.authorization.k8s.io/v1`。

在使用 RBAC 时，只需要在启动 kube-apiserver 时配置 `--authorization-mode=RBAC` 即可。

## RBAC vs ABAC

目前 kubernetes 中已经有一系列 l [鉴权机制](https://kubernetes.io/docs/admin/authorization/)。鉴权的作用是，决定一个用户是否有权使用 Kubernetes API 做某些事情。它除了会影响 kubectl 等组件之外，还会对一些运行在集群内部并对集群进行操作的软件产生作用，例如使用了 Kubernetes 插件的 Jenkins，或者是利用 Kubernetes API 进行软件部署的 Helm。ABAC 和 RBAC 都能够对访问策略进行配置。

ABAC（Attribute Based Access Control）本来是不错的概念，但是在 Kubernetes 中的实现比较难于管理和理解，而且需要对 Master 所在节点的 SSH 和文件系统权限，而且要使得对授权的变更成功生效，还需要重新启动 API Server。

而 RBAC 的授权策略可以利用 kubectl 或者 Kubernetes API 直接进行配置。**RBAC 可以授权给用户，让用户有权进行授权管理，这样就可以无需接触节点，直接进行授权管理。**RBAC 在 Kubernetes 中被映射为 API 资源和操作。

因为 Kubernetes 社区的投入和偏好，相对于 ABAC 而言，RBAC 是更好的选择。

## 基础概念

需要理解 RBAC 一些基础的概念和思路，RBAC 是让用户能够访问 [Kubernetes API 资源](https://kubernetes.io/docs/api-reference/v1.15/) 的授权方式。

![RBAC 架构图 1](images/rbac1.png)

在 RBAC 中定义了两个对象，用于描述在用户和资源之间的连接权限。

### Role 与 ClusterRole

Role（角色）是一系列权限的集合，例如一个角色可以包含读取 Pod 的权限和列出 Pod 的权限。Role 只能用来给某个特定 namespace 中的资源作鉴权，对多 namespace 和集群级的资源或者是非资源类的 API（如 `/healthz`）使用 ClusterRole。

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

RoleBinding 把角色（Role 或 ClusterRole）的权限映射到用户或者用户组，从而让这些用户继承角色在 namespace 中的权限。ClusterRoleBinding 让用户继承 ClusterRole 在整个集群中的权限。

注意 ServiceAccount 的用户名格式为 `system:serviceaccount:<service-account-name>`，并且都属于 `system:serviceaccounts:` 用户组。

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

![RBAC 架构图 2](images/rbac2.png)

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

从 v1.9 开始，在 ClusterRole 中可以通过 `aggregationRule` 来与其他 ClusterRole 聚合使用（该特性在 v1.11 GA）。

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

### 默认 ClusterRole

RBAC 现在被 Kubernetes 深度集成，并使用它给系统组件进行授权。[System Roles](https://kubernetes.io/docs/admin/authorization/rbac/#default-roles-and-role-bindings) 一般具有前缀 `system:`，很容易识别：

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

其他的内置角色可以参考 [default-roles-and-role-bindings](https://kubernetes.io/docs/admin/authorization/rbac/#default-roles-and-role-bindings)。

RBAC 系统角色已经完成足够的覆盖，让集群可以完全在 RBAC 的管理下运行。

## 从 ABAC 迁移到 RBAC

在 ABAC 到 RBAC 进行迁移的过程中，有些在 ABAC 集群中缺省开放的权限，在 RBAC 中会被视为不必要的授权，会对其进行 [降级](https://kubernetes.io/docs/admin/authorization/rbac/#upgrading-from-15)。这种情况会影响到使用 Service Account 的应用。ABAC 配置中，从 Pod 中发出的请求会使用 Pod Token，API Server 会为其授予较高权限。例如下面的命令在 ABAC 集群中会返回 JSON 结果，而在 RBAC 的情况下则会返回错误。

```bash
$ kubectl run nginx --image=nginx:latest
$ kubectl exec -it $(kubectl get pods -o jsonpath='{.items[0].metadata.name}') bash
$ apt-get update && apt-get install -y curl
$ curl -ik \
  -H "Authorization: Bearer $(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" \
  https://kubernetes/api/v1/namespaces/default/pods
```

所有在 Kubernetes 集群中运行的应用，一旦和 API Server 进行通信，都会有可能受到迁移的影响。

要平滑的从 ABAC 升级到 RBAC，在创建 1.6 集群的时候，可以同时启用 [ABAC 和 RBAC](https://kubernetes.io/docs/admin/authorization/rbac/#parallel-authorizers)。当他们同时启用的时候，对一个资源的权限请求，在任何一方获得放行都会获得批准。然而在这种配置下的权限太过粗放，很可能无法在单纯的 RBAC 环境下工作。

目前 RBAC 已经进入稳定版，ABAC 可能会被弃用。在可见的未来 ABAC 依然会保留在 kubernetes 中，不过开发的重心已经转移到了 RBAC。

## Permissive RBAC

所谓 Permissive RBAC 是指授权给所有的 Service Accounts 管理员权限。注意，这是一个不推荐的配置。

```sh
kubectl create clusterrolebinding permissive-binding \
  --clusterrole=cluster-admin \
  --user=admin \
  --user=kubelet \
  --group=system:serviceaccounts
```

## 推荐配置

- 针对 namespace 内资源的访问权限，使用 Role 和 RoleBinding
- 针对集群级别的资源或者所有 namespace 的特定资源访问，使用 ClustetRole 和 ClusterRoleBinding
- 针对多个有限 namespace 的特定资源访问，使用 ClusterRole 和 RoleBinding

## 开源工具

- [liggitt/audit2rbac](https://github.com/liggitt/audit2rbac)
- [reactiveops/rbac-manager](https://github.com/reactiveops/rbac-manager)
- [jtblin/kube2iam](https://github.com/jtblin/kube2iam)

## 参考文档

- [RBAC documentation](https://kubernetes.io/docs/admin/authorization/rbac/)
- [Google Cloud Next talks 1](https://www.youtube.com/watch?v=Cd4JU7qzYbE#t=8m01s )
- [Google Cloud Next talks 2](https://www.youtube.com/watch?v=18P7cFc6nTU#t=41m06s )
- [在 Kubernetes Pod 中使用 Service Account 访问 API Server](http://tonybai.com/2017/03/03/access-api-server-from-a-pod-through-serviceaccount/)
- 部分翻译自 [RBAC Support in Kubernetes](http://blog.kubernetes.io/2017/04/rbac-support-in-kubernetes.html)（转载自[kubernetes 中文社区](https://www.kubernetes.org.cn/1879.html)，译者催总，[Jimmy Song](http://rootsongjc.github.com/about) 做了稍许修改）
