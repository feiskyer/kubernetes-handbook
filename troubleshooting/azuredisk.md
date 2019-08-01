# AzureDisk 排錯

[AzureDisk](https://docs.microsoft.com/zh-cn/azure/virtual-machines/windows/about-disks-and-vhds) 為 Azure 上面運行的虛擬機提供了彈性塊存儲服務，它以 VHD 的形式掛載到虛擬機中，並可以在 Kubernetes 容器中使用。AzureDisk 有點是性能高，特別是 Premium Storage 提供了非常好的[性能](https://docs.microsoft.com/en-us/azure/virtual-machines/windows/premium-storage)；其缺點是不支持共享，只可以用在單個 Pod 內。

根據配置的不同，Kubernetes 支持的 AzureDisk 可以分為以下幾類

- Managed Disks: 由 Azure 自動管理磁盤和存儲賬戶
- Blob Disks:
  - Dedicated (默認)：為每個 AzureDisk 創建單獨的存儲賬戶，當刪除 PVC 的時候刪除該存儲賬戶
  - Shared：AzureDisk 共享 ResourceGroup 內的同一個存儲賬戶，這時刪除 PVC 不會刪除該存儲賬戶

> 注意：
> - AzureDisk 的類型必須跟 VM OS Disk 類型一致，即要麼都是 Manged Disks，要麼都是 Blob Disks。當兩者不一致時，AzureDisk PV 會報無法掛載的錯誤。
> - 由於 Managed Disks 需要創建和管理存儲賬戶，其創建過程會比 Blob Disks 慢（3 分鐘 vs 1-2 分鐘）。
> - 但節點最大支持同時掛載 16 個 AzureDisk。

使用 [acs-engine](https://github.com/Azure/acs-engine) 部署的 Kubernetes 集群，會自動創建兩個 StorageClass，默認為managed-standard（即HDD）：

```sh
kubectl get storageclass
NAME                PROVISIONER                AGE
default (default)   kubernetes.io/azure-disk   45d
managed-premium     kubernetes.io/azure-disk   53d
managed-standard    kubernetes.io/azure-disk   53d
```

## AzureDisk 掛載失敗

在 AzureDisk 從一個 Pod 遷移到另一 Node 上面的 Pod 時或者同一臺 Node 上面使用了多塊 AzureDisk 時有可能會碰到這個問題。這是由於 kube-controller-manager 未對 AttachDisk 和 DetachDisk 操作加鎖從而引發了競爭問題（[kubernetes#60101](https://github.com/kubernetes/kubernetes/issues/60101) [acs-engine#2002](https://github.com/Azure/acs-engine/issues/2002) [ACS#12](https://github.com/Azure/ACS/issues/12)）。

通過 kube-controller-manager 的日誌，可以查看具體的錯誤原因。常見的錯誤日誌為

```sh
Cannot attach data disk 'cdb-dynamic-pvc-92972088-11b9-11e8-888f-000d3a018174' to VM 'kn-edge-0' because the disk is currently being detached or the last detach operation failed. Please wait until the disk is completely detached and then try again or delete/detach the disk explicitly again.
```

臨時性解決方法為

（1）更新所有受影響的虛擬機狀態

```powershell
$vm = Get-AzureRMVM -ResourceGroupName $rg -Name $vmname
Update-AzureRmVM -ResourceGroupName $rg -VM $vm -verbose -debug
```

（2）重啟虛擬機

- `kubectl cordon NODE`
- 如果 Node 上運行有 StatefulSet，需要手動刪除相應的 Pod
- `kubectl drain NODE`
- `Get-AzureRMVM -ResourceGroupName $rg -Name $vmname | Restart-AzureVM`
- `kubectl uncordon NODE`

該問題的修復 [#60183](https://github.com/kubernetes/kubernetes/pull/60183) 已包含在 v1.10 中。

## 掛載新的 AzureDisk 後，該 Node 中其他 Pod 已掛載的 AzureDisk 不可用

在 Kubernetes v1.7 中，AzureDisk 默認的緩存策略修改為 `ReadWrite`，這會導致在同一個 Node 中掛載超過 5 塊 AzureDisk 時，已有 AzureDisk 的盤符會隨機改變（[kubernetes#60344](https://github.com/kubernetes/kubernetes/issues/60344) [kubernetes#57444](https://github.com/kubernetes/kubernetes/issues/57444) [AKS#201](https://github.com/Azure/AKS/issues/201) [acs-engine#1918](https://github.com/Azure/acs-engine/issues/1918)）。比如，當掛載第六塊 AzureDisk 後，原來 lun0 磁盤的掛載盤符有可能從 `sdc` 變成 `sdk`：

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

這樣，原來使用 lun0 磁盤的 Pod 就無法訪問 AzureDisk 了

```sh
[root@admin-0 /]# ls /datadisk
ls: reading directory .: Input/output error
```

臨時性解決方法是設置 AzureDisk StorageClass 的 `cachingmode: None`，如

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

該問題的修復 [#60346](https://github.com/kubernetes/kubernetes/pull/60346) 將包含在 v1.10 中。

## AzureDisk 掛載慢

AzureDisk PVC 的掛載過程一般需要 1 分鐘的時間，這些時間主要消耗在 Azure ARM API 的調用上（查詢 VM 以及掛載 Disk）。[#57432](https://github.com/kubernetes/kubernetes/pull/57432) 為 Azure VM 增加了一個緩存，消除了 VM 的查詢時間，將整個掛載過程縮短到大約 30 秒。該修復包含在v1.9.2+ 和 v1.10 中。

另外，如果 Node 使用了 `Standard_B1s` 類型的虛擬機，那麼 AzureDisk 的第一次掛載一般會超時，等再次重複時才會掛載成功。這是因為在 `Standard_B1s`  虛擬機中格式化 AzureDisk 就需要很長時間（如超過 70 秒）。

```sh
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

## Azure German Cloud 無法使用 AzureDisk

Azure German Cloud 僅在 v1.7.9+、v1.8.3+ 以及更新版本中支持（[#50673](https://github.com/kubernetes/kubernetes/pull/50673)），升級 Kubernetes 版本即可解決。

## MountVolume.WaitForAttach failed

```sh
MountVolume.WaitForAttach failed for volume "pvc-f1562ecb-3e5f-11e8-ab6b-000d3af9f967" : azureDisk - Wait for attach expect device path as a lun number, instead got: /dev/disk/azure/scsi1/lun1 (strconv.Atoi: parsing "/dev/disk/azure/scsi1/lun1": invalid syntax)
```

[該問題](https://github.com/kubernetes/kubernetes/issues/62540) 僅在 Kubernetes v1.10.0 和 v1.10.1 中存在，將在 v1.10.2 中修復。

## 參考文檔

- [Known kubernetes issues on Azure](https://github.com/andyzhangx/demo/tree/master/issues)
- [Introduction of AzureDisk](https://docs.microsoft.com/zh-cn/azure/virtual-machines/windows/about-disks-and-vhds)
- [AzureDisk volume examples](https://github.com/kubernetes/examples/tree/master/staging/volumes/azure_disk)
- [High-performance Premium Storage and managed disks for VMs](https://docs.microsoft.com/en-us/azure/virtual-machines/windows/premium-storage)
