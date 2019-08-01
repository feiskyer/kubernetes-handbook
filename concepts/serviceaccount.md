# Service Account

Service account 是為了方便 Pod 裡面的進程調用 Kubernetes API 或其他外部服務而設計的。它與 User account 不同

- User account 是為人設計的，而 service account 則是為 Pod 中的進程調用 Kubernetes API 而設計；
- User account 是跨 namespace 的，而 service account 則是僅侷限它所在的 namespace；
- 每個 namespace 都會自動創建一個 default service account
- Token controller 檢測 service account 的創建，併為它們創建 [secret](secret.md)
- 開啟 ServiceAccount Admission Controller 後
  - 每個 Pod 在創建後都會自動設置 `spec.serviceAccountName` 為 default（除非指定了其他 ServiceAccout）
  - 驗證 Pod 引用的 service account 已經存在，否則拒絕創建
  - 如果 Pod 沒有指定 ImagePullSecrets，則把 service account 的 ImagePullSecrets 加到 Pod 中
  - 每個 container 啟動後都會掛載該 service account 的 token 和 `ca.crt` 到 `/var/run/secrets/kubernetes.io/serviceaccount/`

```sh
$ kubectl exec nginx-3137573019-md1u2 ls /var/run/secrets/kubernetes.io/serviceaccount
ca.crt
namespace
token
```

> 注：你可以使用 <https://jwt.io/> 來查看 token 的詳細信息（如 PAYLOAD、SIGNATURE 等）。

## 創建 Service Account

```sh
$ kubectl create serviceaccount jenkins
serviceaccount "jenkins" created
$ kubectl get serviceaccounts jenkins -o yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  creationTimestamp: 2017-05-27T14:32:25Z
  name: jenkins
  namespace: default
  resourceVersion: "45559"
  selfLink: /api/v1/namespaces/default/serviceaccounts/jenkins
  uid: 4d66eb4c-42e9-11e7-9860-ee7d8982865f
secrets:
- name: jenkins-token-l9v7v
```

自動創建的 secret：

```sh
kubectl get secret jenkins-token-l9v7v -o yaml
apiVersion: v1
data:
  ca.crt: (APISERVER CA BASE64 ENCODED)
  namespace: ZGVmYXVsdA==
  token: (BEARER TOKEN BASE64 ENCODED)
kind: Secret
metadata:
  annotations:
    kubernetes.io/service-account.name: jenkins
    kubernetes.io/service-account.uid: 4d66eb4c-42e9-11e7-9860-ee7d8982865f
  creationTimestamp: 2017-05-27T14:32:25Z
  name: jenkins-token-l9v7v
  namespace: default
  resourceVersion: "45558"
  selfLink: /api/v1/namespaces/default/secrets/jenkins-token-l9v7v
  uid: 4d697992-42e9-11e7-9860-ee7d8982865f
type: kubernetes.io/service-account-token
```

## 添加 ImagePullSecrets

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  creationTimestamp: 2015-08-07T22:02:39Z
  name: default
  namespace: default
  selfLink: /api/v1/namespaces/default/serviceaccounts/default
  uid: 052fb0f4-3d50-11e5-b066-42010af0d7b6
secrets:
- name: default-token-uudge
imagePullSecrets:
- name: myregistrykey
```

## 授權

Service Account 為服務提供了一種方便的認證機制，但它不關心授權的問題。可以配合 [RBAC](https://kubernetes.io/docs/admin/authorization/#a-quick-note-on-service-accounts) 來為 Service Account 鑑權：
- 配置 `--authorization-mode=RBAC` 和 `--runtime-config=rbac.authorization.k8s.io/v1alpha1`
- 配置 `--authorization-rbac-super-user=admin`
- 定義 Role、ClusterRole、RoleBinding 或 ClusterRoleBinding

比如

```yaml
# This role allows to read pods in the namespace "default"
kind: Role
apiVersion: rbac.authorization.k8s.io/v1alpha1
metadata:
  namespace: default
  name: pod-reader
rules:
  - apiGroups: [""] # The API group"" indicates the core API Group.
    resources: ["pods"]
    verbs: ["get", "watch", "list"]
    nonResourceURLs: []
---
# This role binding allows "default" to read pods in the namespace "default"
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1alpha1
metadata:
  name: read-pods
  namespace: default
subjects:
  - kind: ServiceAccount # May be "User", "Group" or "ServiceAccount"
    name: default
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```
