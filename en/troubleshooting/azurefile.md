# Troubleshooting AzureFile

[AzureFile](https://docs.microsoft.com/zh-cn/azure/storage/files/storage-files-introduction) provides a fully managed file shares based on Server Message Block (SMB) protocol (also known as Common Internet File System or CIFS). Azure File shares can be mounted concurrently by cloud or on-premises deployments of Windows, Linux and macOS.

Compared to AzureDisk, AzureFile could be shared by many Pods on different nodes. But please notice that AzureFile doesn't provide same good [performance](https://docs.microsoft.com/en-us/azure/storage/files/storage-files-scale-targets) as AzureDisks ([AKS#223](https://github.com/Azure/AKS/issues/223)).

It is also recommended to use AzureFile by StorageClass, e.g.

```yaml
kind: StorageClass
apiVersion: storage.k8s.io/v1
metadata:
  name: azurefile
provisioner: kubernetes.io/azure-file
mountOptions:
  - dir_mode=0777
  - file_mode=0777
  - uid=1000
  - gid=1000
parameters:
  skuName: Standard_LRS
```

## Access Mode

In kubernetes, AzureFile is mounted to node by [mount.cifs](https://linux.die.net/man/8/mount.cifs). Meanwhile, `fileMode` and `dirMode` options are set to control access modes. But their default values are different for different kubernetes versions:

| Kubernetes      | fileMode和dirMode |
| --------------- | ----------------- |
| v1.6.x, v1.7.x  | 0777              |
| v1.8.0-v1.8.5   | 0700              |
| v1.8.6 or above | 0755              |
| v1.9.0          | 0700              |
| v1.9.1 or above | 0755              |

With those default values, some containers with regular user (non-root user) couldn't create new files in the mounted path. Mitigation of this issue is

- For v1.8.0-v1.8.5: run container as root user, e.g. `spec.securityContext.runAsUser: 0`
- FOr v1.8.6 and later versions: set proper mountOptions in AzureFile StorageClass, e.g. to `0777`

```yaml
kind: StorageClass
apiVersion: storage.k8s.io/v1
metadata:
  name: azurefile
provisioner: kubernetes.io/azure-file
mountOptions:
  - dir_mode=0777
  - file_mode=0777
  - uid=1000
  - gid=1000
parameters:
  skuName: Standard_LRS
```

## AzureFile not working after rebooting Windows Node

After rebooting Windows Node, Pods with AzureFile may fail to start because of following errors ([#60624](https://github.com/kubernetes/kubernetes/issues/60624)):

```sh
Warning  Failed                 1m (x7 over 1m)  kubelet, 77890k8s9010  Error: Error response from daemon: invalid bind mount spec "c:\\var\\lib\\kubelet\\pods\\07251c5c-1cfc-11e8-8f70-000d3afd4b43\\volumes\\kubernetes.io~azure-file\\pvc-fb6159f6-1cfb-11e8-8f70-000d3afd4b43:c:/mnt/azure": invalid volume specification: 'c:\var\lib\kubelet\pods\07251c5c-1cfc-11e8-8f70-000d3afd4b43\volumes\kubernetes.io~azure-file\pvc-fb6159f6-1cfb-11e8-8f70-000d3afd4b43:c:/mnt/azure': invalid mount config for type "bind": bind source path does not exist
  Normal   SandboxChanged         1m (x8 over 1m)  kubelet, 77890k8s9010  Pod sandbox changed, it will be killed and re-created.
```

This is because `New-SmbGlobalMapping` cmdlet has lost account name/key after reboot. A mitigation of this issue is recreate the Pod, e.g. if the Pod is managed by controllers (Deployment or StatefulSet), delete the Pod with `kubectl delete pod <pod-name>` and a new Pod with be created automatically by its controller.

The fix of this issue [#60625](https://github.com/kubernetes/kubernetes/pull/60625) will be included in v1.10.

## AzureFile ProvisioningFailed

In Kubernetes v1.7.10 or older clusters, `ProvisioningFailed` error may occur because the name of AzureFile is too long (Azure only allows 63 in file share names):

```sh
persistentvolume-controller    Warning    ProvisioningFailed Failed to provision volume with StorageClass "azurefile": failed to find a matching storage account
```

The fix of this issue [#48326](https://github.com/kubernetes/kubernetes/pull/48326) is already inclued in v1.7.11 and v1.8. Upgrade cluster to newer version should solve this problem.

If the cluster has enabled RBAC, when there may be another issue causing AzureFile ProvisioningFailed:

```sh
Events:
  Type     Reason              Age   From                         Message
  ----     ------              ----  ----                         -------
  Warning  ProvisioningFailed  8s    persistentvolume-controller  Failed to provision volume with StorageClass "azurefile": Couldn't create secret secrets is forbidden: User "system:serviceaccount:kube-syste
m:persistent-volume-binder" cannot create secrets in the namespace "default"
  Warning  ProvisioningFailed  8s    persistentvolume-controller  Failed to provision volume with StorageClass "azurefile": failed to find a matching storage account
```

This is because kube-controller-manager is not authorized to Secrets by default. To solve this problem, authorize ServiceAccount `persistent-volume-binder` to Secret resources:

```yaml
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: system:azure-cloud-provider
rules:
- apiGroups: ['']
  resources: ['secrets']
  verbs:     ['get','create']
---
apiVersion: rbac.authorization.k8s.io/v1beta1
kind: ClusterRoleBinding
metadata:
  name: system:azure-cloud-provider
roleRef:
  kind: ClusterRole
  apiGroup: rbac.authorization.k8s.io
  name: system:azure-cloud-provider
subjects:
- kind: ServiceAccount
  name: persistent-volume-binder
  namespace: kube-system
```

## AzureFile not supported in Azure German Cloud

Azure German Cloud is only supported in v1.7.11+, v1.8+ and later versions ([#48460](https://github.com/kubernetes/kubernetes/pull/48460)).

## References

- [Known kubernetes issues on Azure](https://github.com/andyzhangx/demo/tree/master/issues)
- [Introduction of Azure File Storage](https://docs.microsoft.com/zh-cn/azure/storage/files/storage-files-introduction)
- [AzureFile volume examples](https://github.com/kubernetes/examples/tree/master/staging/volumes/azure_file)
- [Persistent volumes with Azure files](https://docs.microsoft.com/en-us/azure/aks/azure-files-dynamic-pv)
- [Azure Files scalability and performance targets](https://docs.microsoft.com/en-us/azure/storage/files/storage-files-scale-targets)
