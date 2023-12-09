# AzureDisk

[AzureDisk](https://docs.microsoft.com/zh-cn/azure/virtual-machines/windows/about-disks-and-vhds) provides flexible block storage services for virtual machines operating on Azure. It mounts onto the virtual machine in VHD format and can be utilized within Kubernetes containers. One of the highlights of AzureDisk is its robust performance, especially with Premium Storage offering unparalleled [performance](https://docs.microsoft.com/en-us/azure/virtual-machines/windows/premium-storage). However, it falls short in one aspect - it doesn't support shared usage, and can only be used within a single Pod.

Based on various configurations, Kubernetes supports different types of AzureDisks, such as:

* Managed Disks: Azure automatically manages disks and storage accounts
* Blob Disks:
  * Dedicated (default): A unique storage account is created for each AzureDisk, which gets deleted when the PVC is deleted.
  * Shared: The AzureDisk shared a single storage account within the same ResourceGroup. Deleting PVC will not remove this storage account.

> Note:
>
> * The type of AzureDisk must match with the VM OS Disk type - they should either be both Manged Disks or Blob Disks. If there is a mismatch, AzureDisk PV will report a mounting error.
> * Since Managed Disks requires storage account creation and management, it takes longer to set up compared to Blob Disks (3 minutes vs 1-2 minutes).
> * However, a Node can mount up to 16 AzureDisks at the same time.

Recommended Kubernetes versions for using AzureDisk are:

| Kubernetes version | Recommended version |
| :--- | :---: |
| 1.12 | 1.12.9 or higher |
| 1.13 | 1.13.6 or higher |
| 1.14 | 1.14.2 or higher |
| &gt;=1.15 | &gt;=1.15 |

For Kubernetes clusters deployed using [aks-engine](https://github.com/Azure/aks-engine), two StorageClasses are automatically created. The default is managed-standard (HDD):

```bash
kubectl get storageclass
NAME                PROVISIONER                AGE
default (default)   kubernetes.io/azure-disk   45d
managed-premium     kubernetes.io/azure-disk   53d
managed-standard    kubernetes.io/azure-disk   53d
```

## AzureDisk Mounting Failures

This issue might occur when an AzureDisk is migrated from one Pod to another on a different Node or if multiple AzureDisks are used on the same Node. This scenario is caused by the kube-controller-manager not employing lock operations for AttachDisk and DetachDisk, ultimately leading to contention issues ([kubernetes\#60101](https://github.com/kubernetes/kubernetes/issues/60101) [acs-engine\#2002](https://github.com/Azure/acs-engine/issues/2002) [ACS\#12](https://github.com/Azure/ACS/issues/12)).

You can identify the root cause of the issue by examining the kube-controller-manager logs. A common error log might look like the following:

```bash
Cannot attach data disk 'cdb-dynamic-pvc-92972088-11b9-11e8-888f-000d3a018174' to VM 'kn-edge-0' because the disk is currently being detached or the last detach operation failed. Please wait until the disk is completely detached and then try again or delete/detach the disk explicitly again.
```

Temporary solutions include:

(1) Updating the status of all affected virtual machines

Use powershell:

```text
$vm = Get-AzureRMVM -ResourceGroupName $rg -Name $vmname
Update-AzureRmVM -ResourceGroupName $rg -VM $vm -verbose -debug
```

Use Azure CLI:

```bash
# For VM:
az vm update -n <VM_NAME> -g <RESOURCE_GROUP_NAME>

# For VMSS:
az vmss update-instances -g <RESOURCE_GROUP_NAME> --name <VMSS_NAME> --instance-id <ID>
```

(2) Restarting the virtual machine

* `kubectl cordon NODE`
* If a StatefulSet is running on the Node, the relevant Pod should be manually deleted.
* `kubectl drain NODE`
* `Get-AzureRMVM -ResourceGroupName $rg -Name $vmname | Restart-AzureVM`
* `kubectl uncordon NODE`

This issue has been addressed in the v1.10 patch with fix [\#60183](https://github.com/kubernetes/kubernetes/pull/60183).

## Already-Mounted AzureDisk Unavailable After New AzureDisk is Mounted

In Kubernetes v1.7, the default caching policy for AzureDisk was switched to `ReadWrite`. This change led to an issue where mounting more than five AzureDisks on a Node resulted in randomly changing disk identifiers of existing AzureDisks ([kubernetes\#60344](https://github.com/kubernetes/kubernetes/issues/60344) [kubernetes\#57444](https://github.com/kubernetes/kubernetes/issues/57444) [AKS\#201](https://github.com/Azure/AKS/issues/201) [acs-engine\#1918](https://github.com/Azure/acs-engine/issues/1918)). For instance, after the sixth AzureDisk is mounted, the originally recognised `sdc` disk identifier of the lun0 disk might change to `sdk`:

```bash
$ tree /dev/disk/azure
...
â””â”€â”€ scsi1
    â”œâ”€â”€ lun0 -> ../../../sdk
    â”œâ”€â”€ lun1 -> ../../../sdj
    â”œâ”€â”€ lun2 -> ../../../sde
    â”œâ”€â”€ lun3 -> ../../../sdf
    â”œâ”€â”€ lun4 -> ../../../sdg
    â”œâ”€â”€ lun5 -> ../../../sdh
    â””â”€â”€ lun6 -> ../../../sdi
```

This change leads to the situation where Pods originally using the lun0 disk lose access to the AzureDisk:

```bash
[root@admin-0 /]# ls /datadisk
ls: reading directory .: Input/output error
```

A temporary solution is to set the `cachingmode: None` in the AzureDisk StorageClass, as shown below:

```yaml
kind: StorageClass
apiVersion: storage.k8s.io/v1
metadata:
  name: managed-standard
provisioner: kubernetes.io/azure-disk
parameters:
  skuname: Standard_LRS
  kind: Managed
  cachingmode: None
```

This issue will be addressed in v1.10 in patch [\#60346](https://github.com/kubernetes/kubernetes/pull/60346).

## Slow AzureDisk Mounts

The use of AzureDisk PVC typically requires a 1-minute initial mount duration, which is mostly consumed by the Azure ARM API call (for VM queries and Disk mounts). With [\#57432](https://github.com/kubernetes/kubernetes/pull/57432), a cache was added for Azure VM, which removes the VM query time and brings the overall mount duration down to about 30 seconds. This fix is included in versions v1.9.2+ and v1.10.

Moreover, if a Node uses the `Standard_B1s` type of virtual machine, the first mount of the AzureDisk is likely to time out, and it will only be successful on the second attempt. This is because the AzureDisk formatting in `Standard_B1s` virtual machines takes a long time (over 70 seconds, for instance).

```bash
$ kubectl describe pod <pod-name>
...
Events:
  FirstSeen     LastSeen        Count   From                                    SubObjectPath                           Type            Reason                  Message
  ---------     --------        -----   ----                                    -------------                           --------        ------                  -------
  8m            8m              1       default-scheduler                                                               Normal          Scheduled               Successfully assigned nginx-azuredisk to aks-nodepool1-15012548-0
  7m            7m              1       kubelet, aks-nodepool1-15012548-0                                               Normal          SuccessfulMountVolume   MountVolume.SetUp succeeded for volume "default-token-mrw8h"
  5m            5m              1       kubelet, aks-nodepool1-15012548-0                                               Warning         FailedMount             Unable to mount volumes for pod "nginx-azuredisk_default(4eb22bb2-0bb5-11e8-8
d9e-0a58ac1f0a2e)": timeout expired waiting for volumes to attach/mount for pod "default"/"nginx-azuredisk". list of unattached/unmounted volumes=[disk01]
  5m            5m              1       kubelet, aks-nodepool1-15012548-0                                               Warning         FailedSync              Error syncing pod
  4m            4m              1       kubelet, aks-nodepool1-15012548-0                                               Normal          SuccessfulMountVolume   MountVolume.SetUp succeeded for volume "pvc-20240841-0bb5-11e8-8d9e-0a58ac1f0
a2e"
  4m            4m              1       kubelet, aks-nodepool1-15012548-0       spec.containers{nginx-azuredisk}        Normal          Pulling                 pulling image "nginx"
  3m            3m              1       kubelet, aks-nodepool1-15012548-0       spec.containers{nginx-azuredisk}        Normal          Pulled                  Successfully pulled image "nginx"
  3m            3m              1       kubelet, aks-nodepool1-15012548-0       spec.containers{nginx-azuredisk}        Normal          Created                 Created container
  2m            2m              1       kubelet, aks-nodepool1-15012548-0       spec.containers{nginx-azuredisk}        Normal          Started                 Started container
```

## AzureDisk Not Working with Azure German Cloud

Azure German Cloud only supports AzureDisk in versions v1.7.9+, v1.8.3+ and later versions ([\#50673](https://github.com/kubernetes/kubernetes/pull/50673)). Upgrading Kubernetes will solve the problem.

## Failure of MountVolume.WaitForAttach

```bash
MountVolume.WaitForAttach failed for volume "pvc-f1562ecb-3e5f-11e8-ab6b-000d3af9f967" : azureDisk - Wait for attach expect device path as a lun number, instead got: /dev/disk/azure/scsi1/lun1 (strconv.Atoi: parsing "/dev/disk/azure/scsi1/lun1": invalid syntax)
```

[This issue](https://github.com/kubernetes/kubernetes/issues/62540) only exists in Kubernetes v1.10.0 and v1.10.1 and will be fixed in v1.10.2.

## Failure When Setting uid and gid in mountOptions

By default, Azure Disk can't set uid and gid during the mount using ext4, xfs filesystem and mountOptions like uid=x, gid=x. For instance, if you try setting mountOptions uid=999,gid=999, you'll see an error similar to:

```text
Warning  FailedMount             63s                  kubelet, aks-nodepool1-29460110-0  MountVolume.MountDevice failed for volume "pvc-d783d0e4-85a1-11e9-8a90-369885447933" : azureDisk - mountDevice:FormatAndMount failed with mount failed: exit status 32
Mounting command: systemd-run
Mounting arguments: --description=Kubernetes transient mount for /var/lib/kubelet/plugins/kubernetes.io/azure-disk/mounts/m436970985 --scope -- mount -t xfs -o dir_mode=0777,file_mode=0777,uid=1000,gid=1000,defaults /dev/disk/azure/scsi1/lun2 /var/lib/kubelet/plugins/kubernetes.io/azure-disk/mounts/m436970985
Output: Running scope as unit run-rb21966413ab449b3a242ae9b0fbc9398.scope.
mount: wrong fs type, bad option, bad superblock on /dev/sde,
       missing codepage or helper program, or other error
```

This issue can be alleviated by either of the following:

* [Setting pod security context](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/) via runAsUser and gid in the fsGroup to set uid. For instance, the following configuration sets the pod to root, making it accessible for all files:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: security-context-demo
spec:
  securityContext:
    runAsUser: 0
    fsGroup: 0
```

> Note: Since the gid and uid default to root or 0 when mounting, if the gid or uid is set to a non-root value (for example, 1000), Kubernetes will use `chown` to change all directories and files beneath the disk. This operation can be time-consuming and may result in slow disk mounting speeds.

* Setting gid and uid using `chown` in initContainers. An example:

```yaml
initContainers:
- name: volume-mount
  image: busybox
  command: ["sh", "-c", "chown -R 100:100 /data"]
  volumeMounts:
  - name: <your data volume>
    mountPath: /data
```

## Errors When Deleting Azure Disk PersistentVolumeClaim Used by pod

Errors might occur if you try to delete an Azure Disk PersistentVolumeClaim being used by a pod. For instance:

```text
$ kubectl describe pv pvc-d8eebc1d-74d3-11e8-902b-e22b71bb1c06
...
Message:         disk.DisksClient#Delete: Failure responding to request: StatusCode=409 -- Original Error: autorest/azure: Service returned an error. Status=409 Code="OperationNotAllowed" Message="Disk kubernetes-dynamic-pvc-d8eebc1d-74d3-11e8-902b-e22b71bb1c06 is attached to VM /subscriptions/{subs-id}/resourceGroups/MC_markito-aks-pvc_markito-aks-pvc_westus/providers/Microsoft.Compute/virtualMachines/aks-agentpool-25259074-0."
```

In Kubernetes version 1.10 and higher, PersistentVolumeClaim protection is enabled by default to prevent this issue. If the Kubernetes version you are using isn't addressing this issue, you can work around it by deleting the pod using the PersistentVolumeClaim before deleting the PersistentVolumeClaim.

## Additional resources

* [Known Kubernetes issues on Azure](https://github.com/andyzhangx/demo/tree/master/issues)
* [Introduction to AzureDisk](https://docs.microsoft.com/zh-cn/azure/virtual-machines/windows/about-disks-and-vhds)
* [AzureDisk volume examples](https://github.com/kubernetes/examples/tree/master/staging/volumes/azure_disk)
* [High-performance Premium Storage and managed disks for VMs](https://docs.microsoft.com/en-us/azure/virtual-machines/windows/premium-storage)