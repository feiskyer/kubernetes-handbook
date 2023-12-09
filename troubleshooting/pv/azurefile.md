# Navigating AzureFile

[AzureFile](https://docs.microsoft.com/zh-cn/azure/storage/files/storage-files-introduction) delivers a host file sharing service based on the SMB protocol (also known as CIFS). Catering to both Windows and Linux containers, AzureFile supports sharing across hosts, making it suitable for shared storage among multiple Pods. One shortcoming of AzureFile is its relatively [poor performance](https://docs.microsoft.com/en-us/azure/storage/files/storage-files-scale-targets) ([AKS\#223](https://github.com/Azure/AKS/issues/223)), and it doesn't offer Premium storage.

To tap into the full potential of AzureFile, it's recommended that you use it as per StorageClass - like so:

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

Here are some versions of AzureFile we suggest using:

| Kubernetes prototype | Preferred version |
| :--- | :---: |
| 1.12 | 1.12.6 or higher |
| 1.13 | 1.13.4 or higher |
| 1.14 | 1.14.0 or higher |
| &gt;=1.15 | &gt;=1.15 |

## All About Access

AzureFile mounts its remote storage to the Node using [mount.cifs](https://linux.die.net/man/8/mount.cifs), while `fileMode` and `dirMode` govern the resulting access permission for the files and folders. Different Kubernetes versions come with varying `fileMode` and `dirMode` default options:

| Kubernetes version | fileMode and dirMode |
| :--- | :--- |
| v1.6.x, v1.7.x | 0777 |
| v1.8.0-v1.8.5 | 0700 |
| v1.8.6 or higher | 0755 |
| v1.9.0 | 0700 |
| v1.9.1-v1.12.1 | 0755 |
| &gt;=v1.12.2 | 0777 |

Default permissions can lead to non-root users losing the ability to create new files in directories. Here are a couple of solutions:

## Wandering Pods Following Windows Node Restart

Following a Windows Node reboot, Pods mounted with AzureFile may display the following error ([\#60624](https://github.com/kubernetes/kubernetes/issues/60624)):

```bash
Warning  Failed                 1m (x7 over 1m)  kubelet, 77890k8s9010  Error: Error response from daemon: invalid bind mount spec "c:\\var\\lib\\kubelet\\pods\\07251c5c-1cfc-11e8-8f70-000d3afd4b43\\volumes\\kubernetes.io~azure-file\\pvc-fb6159f6-1cfb-11e8-8f70-000d3afd4b43:c:/mnt/azure": invalid volume specification: 'c:\var\lib\kubelet\pods\07251c5c-1cfc-11e8-8f70-000d3afd4b43\volumes\kubernetes.io~azure-file\pvc-fb6159f6-1cfb-11e8-8f70-000d3afd4b43:c:/mnt/azure': invalid mount config for type "bind": bind source path does not exist
  Normal   SandboxChanged         1m (x8 over 1m)  kubelet, 77890k8s9010  Pod sandbox changed, it will be killed and re-created.
```

A temporary solution involves deleting and re-creating Pods hosted on AzureFile. If the Pod uses controllers—like Deployment or StatefulSets—the controller will automatically generate a new Pod in its place once the old one is eradicated.

The issue's been resolved in v1.10 ([\#60625](https://github.com/kubernetes/kubernetes/pull/60625)).

## Provisioning Woes with AzureFile

Azure File shares are limited to a mere 63 characters—this means that clusters with exceedingly long names (Kubernetes v1.7.10 or older) may exceed AzureFile's character limit, leading to AzureFile ProvisioningFailed:

```bash
persistentvolume-controller    Warning    ProvisioningFailed Failed to provision volume with StorageClass "azurefile": failed to find a matching storage account
```

A cluster upgrade will solve such an issue, as the fix ([\#48326](https://github.com/kubernetes/kubernetes/pull/48326)) is part of v1.7.11, v1.8, and all subsequent versions.

In clusters with the RBAC option enabled, AzureFile may not auto-authorize access to Secret in the kube-controller-manager, causing ProvisioningFailed.

```bash
Events:
  Type     Reason              Age   From                         Message
  ----     ------              ----  ----                         -------
  Warning  ProvisioningFailed  8s    persistentvolume-controller  Failed to provision volume with StorageClass "azurefile": Couldn't create secret secrets is forbidden: User "system:serviceaccount:kube-syste
m:persistent-volume-binder" cannot create secrets in the namespace "default"
  Warning  ProvisioningFailed  8s    persistentvolume-controller  Failed to provision volume with StorageClass "azurefile": failed to find a matching storage account
```

To address this, just grant the Secret access permission to the ServiceAccount `persistent-volume-binder`:

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
## AzureFile and Azure German Cloud

Azure German Cloud only supports AzureFile as of v1.7.11+ and v1.8+ ([\#48460](https://github.com/kubernetes/kubernetes/pull/48460)). Updating your Kubernetes version will solve this problem.

## Dealing with the "Could not change permissions" Error

When running PostgreSQL on an Azure Files plugin, you may come across an error message like this:

```text
initdb: could not change permissions of directory "/var/lib/postgresql/data": Operation not permitted
fixing permissions on existing directory /var/lib/postgresql/data
```

This error is caused by the Azure File plugin using the cifs/SMB protocol. You can't change file and directory permission after mounting when using the cifs/SMB protocol. To solve this, you should use subpaths in conjunction with the Azure Disk plugin.

## Further Reading

* [Known kubernetes issues on Azure](https://github.com/andyzhangx/demo/tree/master/issues)
* [Introduction of Azure File Storage](https://docs.microsoft.com/zh-cn/azure/storage/files/storage-files-introduction)
* [AzureFile volume examples](https://github.com/kubernetes/examples/tree/master/staging/volumes/azure_file)
* [Persistent volumes with Azure files](https://docs.microsoft.com/en-us/azure/aks/azure-files-dynamic-pv)
* [Azure Files scalability and performance targets](https://docs.microsoft.com/en-us/azure/storage/files/storage-files-scale-targets)