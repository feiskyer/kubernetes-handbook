# ServiceAccounts 101

Think of service accounts as a way for the processes within your Pod to smoothly interact with the Kubernetes API and other external services. You see, they're distinct from user accounts:

* User accounts are designed for humans. On the other hand, service accounts are custom-made for processes within a Pod that want to interact with the Kubernetes API.
* User accounts transcend namespaces, while service accounts are restrained by their respective namespaces.
* Each namespace automatically conjures a default service account.
* The token controller keeps an eye out for any freshly spawned service accounts, creating a corresponding [secret](secret.md) for each one.
* With the ServiceAccount Admission Controller activated
  * Every newly created Pod is automatically assigned a `spec.serviceAccountName` set to default (unless another ServiceAccount is specified).
  * It double-checks if the service account [20] referenced by the Pod exists; if it doesn't, the creation process is denied.
  * If a Pod hasn't specified ImagePullSecrets, the service account's ImagePullSecrets are added to the Pod.
  * Each container brought to life will have a token and ‘ca.crt’ from its service account mounted on `/var/run/secrets/kubernetes.io/serviceaccount/`.

> Heads up: Starting with v1.24.0, ServiceAccount won’t spawn Secrets automatically. If you’re keen on retaining this feature, configure your kube-controller-manager to `LegacyServiceAccountTokenNoAutoGeneration=false`.

```bash
$ kubectl exec nginx-3137573019-md1u2 ls /var/run/secrets/kubernetes.io/serviceaccount
ca.crt
namespace
token
```

> Pro Tip: Head to [https://jwt.io/](https://jwt.io/) for an in-depth look at your token (like PAYLOAD, SIGNATURE, etc.).

## To create a Service Account:

```bash
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

The corresponding secret gets generated automatically:

```bash
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

## To add ImagePullSecrets:

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

## Giving Authorization

While service accounts smoothly enable service authentications, they remain apathetic towards authorization matters. To make them more useful, pair them with [RBAC](https://kubernetes.io/docs/admin/authorization/#a-quick-note-on-service-accounts) for granting Service Account access:

* Set up both `--authorization-mode=RBAC` and `--runtime-config=rbac.authorization.k8s.io/v1alpha1`
* Enable `--authorization-rbac-super-user=admin`
* Define your Role, ClusterRole, RoleBinding, or ClusterRoleBinding

Here's an example:

```yaml
# This role allows to read pods in the "default" namespace
kind: Role
apiVersion: rbac.authorization.k8s.io/v1alpha1
metadata:
  namespace: default
  name: pod-reader
rules:
  - apiGroups: [""] # The empty API group "" specifies the core API Group.
    resources: ["pods"]
    verbs: ["get", "watch", "list"]
    nonResourceURLs: []
---
# This role binding allows "default" to read pods in the "default" namespace
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1alpha1
metadata:
  name: read-pods
  namespace: default
subjects:
  - kind: ServiceAccount # Can be "User", "Group", or "ServiceAccount"
    name: default
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

