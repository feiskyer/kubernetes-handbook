# Navigating Namespaces

Think of a Namespace as a virtual cluster or compartment housing a collection of related resources and objects. This concept allows you to group and categorize entities like deployments, pods, services, and replication controllers based on projects or user groups. By default, these all belong to the 'default' namespace. However, 'nodes', 'persistent volumes', and namespaces themselves are not subordinate to any namespace.

You might find Namespaces being put to use to isolate users. For instance, Kubernetes' built-in services typically run in the `kube-system` namespace.

## Mastering Namespace Operations

> The Kubernetes command-line tool `kubectl` lets you specify a namespace using the `--namespace` or shorter `-n` option. If you don't specify one, it assumes 'default'. To view resources across all namespaces, set `--all-namespace=true`.

### Searching

```bash
$ kubectl get namespaces
NAME          STATUS    AGE
default       Active    11d
kube-system   Active    11d
```

Note: Keep an eye on the status - it'll indicate if a namespace is "Active" or in the process of being "Terminated". During the deletion process, the namespace status changes to "Terminating".

### Creating

```bash
(1) Go ahead and create it directly from the command line:
$ kubectl create namespace new-namespace

(2) Or play it traditional and create it via a file:
$ cat my-namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: new-namespace

$ kubectl create -f ./my-namespace.yaml
```

Note: Make sure your namespace name matches this regular expression `[a-z0-9]([-a-z0-9]*[a-z0-9])?` and doesn't exceed 63 characters in length.

### Deleting

```bash
$ kubectl delete namespaces new-namespace
```

Take heed:

1. Deleting a namespace automatically takes out all the resources belonging to that namespace as well.
2. The `default` and `kube-system` namespaces are off-limits for deletion.
3. While a PersistentVolume doesn't belong to any namespace, a PersistentVolumeClaim is tied to a specific namespace.
4. The namespace association of an Event depends on its source object.
5. With version v1.7 came the `kube-public` namespace for storing public information, usually in the form of ConfigMaps.

```bash
$ kubectl get configmap  -n=kube-public
NAME           DATA      AGE
cluster-info   2         29d
```

## For Further Reading

* [Kubernetes Namespace](https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/)
* [Share a Cluster with Namespaces](https://kubernetes.io/docs/tasks/administer-cluster/namespaces/)
