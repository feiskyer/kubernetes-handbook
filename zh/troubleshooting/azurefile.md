# AzureFile 排错

[AzureFile](https://docs.microsoft.com/zh-cn/azure/storage/files/storage-files-introduction) 提供了基于 SMB 协议（也称 CIFS）托管文件共享服务。它支持 Windows 和 Linux 容器，并支持跨主机的共享，可用于多个 Pod 之间的共享存储。AzureFile 的缺点是性能[较差](https://docs.microsoft.com/en-us/azure/storage/files/storage-files-scale-targets)（[AKS#223](https://github.com/Azure/AKS/issues/223)），并且不提供 Premium 存储。

推荐基于 StorageClass 来使用 AzureFile，即

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

## 访问权限

AzureFile 使用 [mount.cifs](https://linux.die.net/man/8/mount.cifs) 将其远端存储挂载到 Node 上，而`fileMode` 和 `dirMode` 控制了挂载后文件和目录的访问权限。不同的 Kubernetes 版本，`fileMode` 和 `dirMode` 的默认选项是不同的

| Kubernetes 版本 | fileMode和dirMode |
| --------------- | ----------------- |
| v1.6.x, v1.7.x  | 0777              |
| v1.8.0-v1.8.5   | 0700              |
| v1.8.6 or above | 0755              |
| v1.9.0          | 0700              |
| v1.9.1 or above | 0755              |

按照默认的权限会导致非跟用户无法在目录中创建新的文件，解决方法为

- v1.8.0-v1.8.5：设置容器以 root 用户运行，如设置 `spec.securityContext.runAsUser: 0`
- v1.8.6 以及更新版本：在 AzureFile StorageClass 通过 mountOptions 设置默认权限，比如设置为 `0777` 的方法为

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

## Windows Node 重启后无法访问 AzureFile

Windows Node 重启后，挂载 AzureFile 的 Pod 可以看到如下错误（[#60624](https://github.com/kubernetes/kubernetes/issues/60624)）：

```sh
Warning  Failed                 1m (x7 over 1m)  kubelet, 77890k8s9010  Error: Error response from daemon: invalid bind mount spec "c:\\var\\lib\\kubelet\\pods\\07251c5c-1cfc-11e8-8f70-000d3afd4b43\\volumes\\kubernetes.io~azure-file\\pvc-fb6159f6-1cfb-11e8-8f70-000d3afd4b43:c:/mnt/azure": invalid volume specification: 'c:\var\lib\kubelet\pods\07251c5c-1cfc-11e8-8f70-000d3afd4b43\volumes\kubernetes.io~azure-file\pvc-fb6159f6-1cfb-11e8-8f70-000d3afd4b43:c:/mnt/azure': invalid mount config for type "bind": bind source path does not exist
  Normal   SandboxChanged         1m (x8 over 1m)  kubelet, 77890k8s9010  Pod sandbox changed, it will be killed and re-created.
```

临时性解决方法为删除并重新创建使用了 AzureFile 的 Pod。当 Pod 使用控制器（如 Deployment、StatefulSet等）时，删除 Pod 后控制器会自动创建一个新的 Pod。

该问题的修复 [#60625](https://github.com/kubernetes/kubernetes/pull/60625) 包含在 v1.10 中。

## AzureFile ProvisioningFailed

Azure 文件共享的名字最大只允许 63 个字节，因而在集群名字较长的集群（Kubernetes v1.7.10 或者更老的集群）里面有可能会碰到 AzureFile 名字长度超限的情况，导致 AzureFile ProvisioningFailed：

```sh
persistentvolume-controller    Warning    ProvisioningFailed Failed to provision volume with StorageClass "azurefile": failed to find a matching storage account
```

碰到该问题时可以通过升级集群解决，其修复 [#48326](https://github.com/kubernetes/kubernetes/pull/48326) 已经包含在 v1.7.11、v1.8 以及更新版本中。

在开启 RBAC 的集群中，由于 AzureFile 需要访问 Secret，而 kube-controller-manager 中并未为 AzureFile 自动授权，从而也会导致 ProvisioningFailed：

```sh
Events:
  Type     Reason              Age   From                         Message
  ----     ------              ----  ----                         -------
  Warning  ProvisioningFailed  8s    persistentvolume-controller  Failed to provision volume with StorageClass "azurefile": Couldn't create secret secrets is forbidden: User "system:serviceaccount:kube-syste
m:persistent-volume-binder" cannot create secrets in the namespace "default"
  Warning  ProvisioningFailed  8s    persistentvolume-controller  Failed to provision volume with StorageClass "azurefile": failed to find a matching storage account
```

解决方法是为 ServiceAccount `persistent-volume-binder` 授予 Secret 的访问权限：

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

## Azure German Cloud 无法使用 AzureFile

Azure German Cloud 仅在 v1.7.11+、v1.8+ 以及更新版本中支持（[#48460](https://github.com/kubernetes/kubernetes/pull/48460)），升级 Kubernetes 版本即可解决。

## 参考文档

- [Known kubernetes issues on Azure](https://github.com/andyzhangx/demo/tree/master/issues)
- [Introduction of Azure File Storage](https://docs.microsoft.com/zh-cn/azure/storage/files/storage-files-introduction)
- [AzureFile volume examples](https://github.com/kubernetes/examples/tree/master/staging/volumes/azure_file)
- [Persistent volumes with Azure files](https://docs.microsoft.com/en-us/azure/aks/azure-files-dynamic-pv)
- [Azure Files scalability and performance targets](https://docs.microsoft.com/en-us/azure/storage/files/storage-files-scale-targets)
