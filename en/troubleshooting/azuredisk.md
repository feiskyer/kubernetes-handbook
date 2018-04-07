# Troubleshooting AzureDisk

[AzureDisk](https://docs.microsoft.com/en-us/azure/virtual-machines/windows/about-disks-and-vhds) provides a persistent block device for Azure VMs. All Azure virtual machines have at least two disks – an operating system disk and a temporary disk. Virtual machines also can have one or more data disks. All of those disks are virtual hard disks (VHDs) stored in an Azure storage account.

AzureDisk provides has better performance compared to [AzureFile](azurefile.md), especially for [Premium](https://docs.microsoft.com/en-us/azure/virtual-machines/windows/premium-storage) tiers. But it can't be shared by multiple VMs (while AzureFile could).

## Types of AzureDisk

There are two performance tiers for storage that you can choose from when creating your disks -- Standard Storage and Premium Storage. Also, there are two types of disks -- unmanaged and managed -- and they can reside in either performance tier.

- Managed Disks: Managed Disks handles the storage account creation/management in the background for you, and ensures that you do not have to worry about the scalability limits of the storage account.
- Blob Disks:
  - Dedicated (default): storage accounts are separate for each disks. After PVC is deleted, related storage account will be removed for that PV
  - Shared: storage accounts are shared for all disks in same ResourceGroup. The storage account won't be deleted even after PVC removed

> Note: **When using AzureDisk, please ensure its type is matched with VM's operating system disk. That is say, operating system disk and data disk should be both Managed Disks or both Blob Disks (unmanaged). If they are not matched, AzureDisk PV usage will fail with attach error.**

If the kubernetes cluster is deployed by [acs-engine](https://github.com/Azure/acs-engine), two StorageClass for AzureDisk will be created automatically

```sh
kubectl get storageclass
NAME                PROVISIONER                AGE
default (default)   kubernetes.io/azure-disk   45d
managed-premium     kubernetes.io/azure-disk   53d
managed-standard    kubernetes.io/azure-disk   53d
```

## AzureDisk attach error

In some corner case (detaching multiple disks on a node simultaneously), when scheduling a pod with azure disk mount from one node to another, there could be lots of disk attach error (no recovery) due to the disk not being released in time from the previous node ([kubernetes#60101](https://github.com/kubernetes/kubernetes/issues/60101) [acs-engine#2002](https://github.com/Azure/acs-engine/issues/2002) [ACS#12](https://github.com/Azure/ACS/issues/12)). This issue is due to lack of lock before DetachDisk operation.

The error message could be found from kube-controller-manager logs:

```sh
Cannot attach data disk 'cdb-dynamic-pvc-92972088-11b9-11e8-888f-000d3a018174' to VM 'kn-edge-0' because the disk is currently being detached or the last detach operation failed. Please wait until the disk is completely detached and then try again or delete/detach the disk explicitly again.
```

Ways to mitigate the issue:

(1) Fix Azure VM status if they are in Error state

```powershell
$vm = Get-AzureRMVM -ResourceGroupName $rg -Name $vmname
Update-AzureRmVM -ResourceGroupName $rg -VM $vm -verbose -debug
```

(2) Drain the node and reboot VM

- `kubectl cordon NODE`
- Remove Pods managed by StatefulSets `kubectl delete pod <pod-name>`
- `kubectl drain NODE`
- `Get-AzureRMVM -ResourceGroupName $rg -Name $vmname | Restart-AzureVM`
- `kubectl uncordon NODE`

The fix to the issue will be included in v1.10+.

## Disk unavailable after attach/detach a data disk on a node

From kubernetes v1.7, default host cache setting changed from `None` to `ReadWrite`, this change would lead to device name change after attach multiple disks (usually more than 5 disks) on a node, finally lead to disk unavailable from pod ([kubernetes#60344](https://github.com/kubernetes/kubernetes/issues/60344) [kubernetes#57444](https://github.com/kubernetes/kubernetes/issues/57444) [AKS#201](https://github.com/Azure/AKS/issues/201) [acs-engine#1918](https://github.com/Azure/acs-engine/issues/1918)).

An example of the issue is when attaching the 6th data disk on the same node, `lun0`'s mount device changed from `sdc` to `sdk`:

```sh
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

In such case, Pod attaching `lun0` disk will not able to access its data:

```sh
[root@admin-0 /]# ls /datadisk
ls: reading directory .: Input/output error
```

A mitigation of this issue is change `cachingmode` to `None` for all AzureDisk StorageClass, e.g.

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

The fix of this issue [#60346](https://github.com/kubernetes/kubernetes/pull/60346) will be included in v1.10.

## Slow attaching of AzureDisk

The attaching process of AzureDisk usually takes 1 minutes for v1.9.1 and previous versions. The time are most on Azure ARM API calls, e.g. query the VM information and attach the disk to VM.

After v1.9.2 and v1.10, a VM cache [#57432](https://github.com/kubernetes/kubernetes/pull/57432) is added and reduced the whole attaching time to about 30 seconds.

## AzureDisk not supported in Azure German Cloud

Azure German Cloud is only supported in v1.7.9+, v1.8.3+ and newer versions ([#50673](https://github.com/kubernetes/kubernetes/pull/50673)).

## References

- [Known kubernetes issues on Azure](https://github.com/andyzhangx/demo/tree/master/issues)
- [Introduction of AzureDisk](https://docs.microsoft.com/zh-cn/azure/virtual-machines/windows/about-disks-and-vhds)
- [AzureDisk volume examples](https://github.com/kubernetes/examples/tree/master/staging/volumes/azure_disk)
- [High-performance Premium Storage and managed disks for VMs](https://docs.microsoft.com/en-us/azure/virtual-machines/windows/premium-storage)
