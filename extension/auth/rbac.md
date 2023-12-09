# RBAC: Role-Based Access Control Made Easy

Kubernetes now support Role-Based Access Control (RBAC) as of version 1.6, providing administrators more precise access control over resources associated with user or service accounts. The exciting thing with RBAC is permissions are tied to roles, and users are granted authority through their affiliation with specific roles, hugely simplifying management.

The key here is roles are created to accomplish various tasks within an organization, and users are assigned certain roles based on their responsibilities and qualifications. Users can effortlessly be assigned from one role to another, providing flexibility.

## Let’s Start

One of the highlights of [Kubernetes 1.6](http://blog.kubernetes.io/2017/03/kubernetes-1.6-multi-user-multi-workloads-at-scale.html) is the upgrade of RBAC to beta status (version `rbac.authorization.k8s.io/v1beta1`). RBAC is the tool used to manage resource access permissions in a Kubernetes cluster. Notably, RBAC aids in refreshing access authorization policies without the need to reboot the cluster.

Starting with Kubernetes 1.8, RBAC entered a stable release; its API is `rbac.authorization.k8s.io/v1`. Usage of RBAC is simple by initiating the kube-apiserver with the `--authorization-mode=RBAC` configuration.

## RBAC vs ABAC

Kubernetes now has a range of [authorization mechanisms](https://kubernetes.io/docs/admin/authorization/) in action. They determine a user's authority to perform certain actions on the Kubernetes API. They not only affect components like kubectl but also influence the operation of internal cluster software, like a Jenkins setup with Kubernetes plugin or Helm which utilizes the Kubernetes API for software deployment. ABAC and RBAC both can configure access policies.

ABAC (Attribute-Based Access Control) is an excellent concept, but implementing it in Kubernetes has proven a little tricky, particularly concerning management and comprehension. It requires SSH and filesystem permissions on the Master node, and to implement an authorized change, the API Server needs to be restarted.

RBAC authorization policies, on the other hand, can be set directly using kubectl or Kubernetes API. **In RBAC, users can be given the right to manage authorizations, allowing for authorization management without directly touching the nodes.** In Kubernetes, RBAC is mapped to API resources and operations. 

Due to the Kubernetes community's preference and investment, RBAC is a superior option in comparison to ABAC.

## Decoding Basic Concepts

A better understanding of the underlying concepts and attributes of RBAC as the go-to authorization method for Kubernetes API resources is needed.

![RBAC infrastructure image 1](../../.gitbook/assets/rbac1%20%281%29.png)

RBAC defines two objects to analyze the connection between user and resource permissions.

### Role & ClusterRole

Role is an aggregate of permissions––for instance, a role might include permissions to read and list Pods. Role is used for authorization for resources within a specific namespace. For multiple namespaces and cluster-level resources or non-resource API (like `/healthz`), ClusterRole is used.

Role examples:

```yaml
kind: Role
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  namespace: default
  name: pod-reader
rules:
- apiGroups: [""] #" " signifies the core API group
  resources: ["pods"]
  verbs: ["get", "watch", "list"]
```

ClusterRole examples:

```yaml
kind: ClusterRole
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  # "namespace" omitted as ClusterRoles are not namespaced
  name: secret-reader
rules:
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get", "watch", "list"]
```

### RoleBinding and ClusterRoleBinding

RoleBindings map the permissions of a role (Role or ClusterRole) to a user or user group, thus endowing these users with the role privileges within a namespace. ClusterRoleBindings extend a user the prerogatives of a ClusterRole across the entire cluster.

Note the username format for ServiceAccount is `system:serviceaccount:<service-account-name>`, all under user group `system:serviceaccounts:`.

RoleBinding example (references Role):

```yaml
# This role binding grants "jane" the right to read pods in "default" namespace.
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

![RBAC infrastructure image 2](../../.gitbook/assets/rbac2.png)

RoleBinding example (references ClusterRole):

```yaml
# This role binding grants "dave" the right to read secrets in the "development" namespace.
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: read-secrets
  namespace: development # This only allows permissions within the "development" namespace.
subjects:
- kind: User
  name: dave
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: ClusterRole
  name: secret-reader
  apiGroup: rbac.authorization.k8s.io
```

### ClusterRole Aggregation

Starting with v1.9, ClusterRoles can now be used in aggregate with other ClusterRoles via the `aggregationRule` (feature went GA in v1.11). 

For example

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

### Default ClusterRoles

RBAC is deeply integrated into Kubernetes and authorizes its system components. [System Roles](https://kubernetes.io/docs/admin/authorization/rbac/#default-roles-and-role-bindings) typically start with `system:`, making them easy to identify:

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

Other inbuilt roles can be referred to in [default-roles-and-role-bindings](https://kubernetes.io/docs/admin/authorization/rbac/#default-roles-and-role-bindings).

RBAC system roles provide sufficient coverage for the cluster to operate under RBAC management entirely.

## Shifting from ABAC to RBAC

In a shift from ABAC to RBAC, some permissions seen as 'open package' in ABAC are considered extraneous in the RBAC model and are subsequently [downgraded](https://kubernetes.io/docs/admin/authorization/rbac/#upgrading-from-15). This will likely impact applications using Service Account. In ABAC settings, requests from the Pod utilize the Pod Token and the API Server grants it higher privileges. In RBAC, however, the below command would return an error instead of a JSON result.

```bash
$ kubectl run nginx --image=nginx:latest
$ kubectl exec -it $(kubectl get pods -o jsonpath='{.items[0].metadata.name}') bash
$ apt-get update && apt-get install -y curl
$ curl -ik \
  -H "Authorization: Bearer $(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" \
  https://kubernetes/api/v1/namespaces/default/pods
```

All applications running on a Kubernetes cluster might be impacted if they communicate with the API Server.

You can smoothly upgrade from ABAC to RBAC by enabling [both ABAC and RBAC](https://kubernetes.io/docs/admin/authorization/rbac/#parallel-authorizers) simultaneously when setting up the 1.6 cluster. When both are enabled, resource permission requests are approved if either RBAC or ABAC gives a green signal. However, the permissions are too extensive in this configuration, and RBAC might not work independently.

While RBAC is now in a stable release, ABAC may be deprecated. It's likely ABAC will be retained in Kubernetes in the foreseeable future, but development focus is largely shifted to RBAC.

## Permissive RBAC

Permissive RBAC is a specific configuration that grants all Service Accounts administrator privileges. Note, it's generally not a recommended setup.

```bash
kubectl create clusterrolebinding permissive-binding \
  --clusterrole=cluster-admin \
  --user=admin \
  --user=kubelet \
  --group=system:serviceaccounts
```

## Recommended Configurations

* For access rights to namespace resources, use Role and RoleBinding
* For access to cluster-level resources or specific resources across all namespaces, use ClusterRole and ClusterRoleBinding
* For access to specific resources across several namespaces, use ClusterRole and RoleBinding

## Open Source Tools

* [liggitt/audit2rbac](https://github.com/liggitt/audit2rbac)
* [reactiveops/rbac-manager](https://github.com/reactiveops/rbac-manager)
* [jtblin/kube2iam](https://github.com/jtblin/kube2iam)

## Further Reading

* [RBAC documentation](https://kubernetes.io/docs/admin/authorization/rbac/)
* [Using RBAC Authorization](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
* [Google Cloud Next talks 1](https://www.youtube.com/watch?v=Cd4JU7qzYbE#t=8m01s%20)
* [Google Cloud Next talks 2](https://www.youtube.com/watch?v=18P7cFc6nTU#t=41m06s%20)
* [Accessing API Server from a Kubernetes Pod through Service Account](http://tonybai.com/2017/03/03/access-api-server-from-a-pod-through-serviceaccount/)