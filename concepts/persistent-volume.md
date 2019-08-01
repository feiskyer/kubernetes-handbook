# Persistent Volume

PersistentVolume (PV) 和 PersistentVolumeClaim (PVC) 提供了方便的持久化卷：PV 提供網絡存儲資源，而 PVC 請求存儲資源。這樣，設置持久化的工作流包括配置底層文件系統或者雲數據卷、創建持久性數據卷、最後創建 PVC 來將 Pod 跟數據卷關聯起來。PV 和 PVC 可以將 pod 和數據卷解耦，pod 不需要知道確切的文件系統或者支持它的持久化引擎。

## Volume 生命週期

Volume 的生命週期包括 5 個階段

1. Provisioning，即 PV 的創建，可以直接創建 PV（靜態方式），也可以使用 StorageClass 動態創建
2. Binding，將 PV 分配給 PVC
3. Using，Pod 通過 PVC 使用該 Volume，並可以通過准入控制 StorageObjectInUseProtection（1.9 及以前版本為 PVCProtection）阻止刪除正在使用的 PVC
4. Releasing，Pod 釋放 Volume 並刪除 PVC
5. Reclaiming，回收 PV，可以保留 PV 以便下次使用，也可以直接從雲存儲中刪除
6. Deleting，刪除 PV 並從雲存儲中刪除後段存儲

根據這 5 個階段，Volume 的狀態有以下 4 種

- Available：可用
- Bound：已經分配給 PVC
- Released：PVC 解綁但還未執行回收策略
- Failed：發生錯誤

## API 版本對照表

| Kubernetes 版本 | PV/PVC 版本 | StorageClass 版本      |
| --------------- | ----------- | ---------------------- |
| v1.5-v1.6       | core/v1     | storage.k8s.io/v1beta1 |
| v1.7+           | core/v1     | storage.k8s.io/v1      |

## PV

PersistentVolume（PV）是集群之中的一塊網絡存儲。跟 Node 一樣，也是集群的資源。PV 跟 Volume (卷) 類似，不過會有獨立於 Pod 的生命週期。比如一個 NFS 的 PV 可以定義為

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv0003
spec:
  capacity:
    storage: 5Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Recycle
  nfs:
    path: /tmp
    server: 172.17.0.2
```

PV 的訪問模式（accessModes）有三種：

* ReadWriteOnce（RWO）：是最基本的方式，可讀可寫，但只支持被單個節點掛載。
* ReadOnlyMany（ROX）：可以以只讀的方式被多個節點掛載。
* ReadWriteMany（RWX）：這種存儲可以以讀寫的方式被多個節點共享。不是每一種存儲都支持這三種方式，像共享方式，目前支持的還比較少，比較常用的是 NFS。在 PVC 綁定 PV 時通常根據兩個條件來綁定，一個是存儲的大小，另一個就是訪問模式。

PV 的回收策略（persistentVolumeReclaimPolicy，即 PVC 釋放卷的時候 PV 該如何操作）也有三種

- Retain，不清理, 保留 Volume（需要手動清理）
- Recycle，刪除數據，即 `rm -rf /thevolume/*`（只有 NFS 和 HostPath 支持）
- Delete，刪除存儲資源，比如刪除 AWS EBS 卷（只有 AWS EBS, GCE PD, Azure Disk 和 Cinder 支持）

## StorageClass

上面通過手動的方式創建了一個 NFS Volume，這在管理很多 Volume 的時候不太方便。Kubernetes 還提供了 [StorageClass](https://kubernetes.io/docs/user-guide/persistent-volumes/#storageclasses) 來動態創建 PV，不僅節省了管理員的時間，還可以封裝不同類型的存儲供 PVC 選用。

StorageClass 包括四個部分

- provisioner：指定 Volume 插件的類型，包括內置插件（如 `kubernetes.io/glusterfs`）和外部插件（如 [external-storage](https://github.com/kubernetes-incubator/external-storage/tree/master/ceph/cephfs) 提供的 `ceph.com/cephfs`）。
- mountOptions：指定掛載選項，當 PV 不支持指定的選項時會直接失敗。比如 NFS 支持 `hard` 和 `nfsvers=4.1` 等選項。
- parameters：指定 provisioner 的選項，比如 `kubernetes.io/aws-ebs` 支持 `type`、`zone`、`iopsPerGB` 等參數。
- reclaimPolicy：指定回收策略，同 PV 的回收策略。

在使用 PVC 時，可以通過 `DefaultStorageClass` 准入控制設置默認 StorageClass, 即給未設置 storageClassName 的 PVC 自動添加默認的 StorageClass。而默認的 StorageClass 帶有 annotation `storageclass.kubernetes.io/is-default-class=true`。

| Volume Plugin        | Internal Provisioner | Config Example                           |
| -------------------- | -------------------- | ---------------------------------------- |
| AWSElasticBlockStore | ✓                    | [AWS](https://kubernetes.io/docs/concepts/storage/storage-classes/#aws) |
| AzureFile            | ✓                    | [Azure File](https://kubernetes.io/docs/concepts/storage/storage-classes/#azure-file) |
| AzureDisk            | ✓                    | [Azure Disk](https://kubernetes.io/docs/concepts/storage/storage-classes/#azure-disk) |
| CephFS               | -                    | -                                        |
| Cinder               | ✓                    | [OpenStack Cinder](https://kubernetes.io/docs/concepts/storage/storage-classes/#openstack-cinder) |
| FC                   | -                    | -                                        |
| FlexVolume           | -                    | -                                        |
| Flocker              | ✓                    | -                                        |
| GCEPersistentDisk    | ✓                    | [GCE](https://kubernetes.io/docs/concepts/storage/storage-classes/#gce) |
| Glusterfs            | ✓                    | [Glusterfs](https://kubernetes.io/docs/concepts/storage/storage-classes/#glusterfs) |
| iSCSI                | -                    | -                                        |
| PhotonPersistentDisk | ✓                    | -                                        |
| Quobyte              | ✓                    | [Quobyte](https://kubernetes.io/docs/concepts/storage/storage-classes/#quobyte) |
| NFS                  | -                    | -                                        |
| RBD                  | ✓                    | [Ceph RBD](https://kubernetes.io/docs/concepts/storage/storage-classes/#ceph-rbd) |
| VsphereVolume        | ✓                    | [vSphere](https://kubernetes.io/docs/concepts/storage/storage-classes/#vsphere) |
| PortworxVolume       | ✓                    | [Portworx Volume](https://kubernetes.io/docs/concepts/storage/storage-classes/#portworx-volume) |
| ScaleIO              | ✓                    | [ScaleIO](https://kubernetes.io/docs/concepts/storage/storage-classes/#scaleio) |
| StorageOS            | ✓                    | [StorageOS](https://kubernetes.io/docs/concepts/storage/storage-classes/#storageos) |
| Local                | -                    | [Local](https://kubernetes.io/docs/concepts/storage/storage-classes/#local) |

#### 修改默認 StorageClass

取消原來的默認 StorageClass

```sh
kubectl patch storageclass <default-class-name> -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"false"}}}'
```

標記新的默認 StorageClass

```sh
kubectl patch storageclass <your-class-name> -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
```

#### GCE 示例

> 單個 GCE 節點最大支持掛載 16 個 Google Persistent Disk。開啟 `AttachVolumeLimit` 特性後，根據節點的類型最大可以掛載 128 個。

```yaml
kind: StorageClass
apiVersion: storage.k8s.io/v1
metadata:
  name: slow
provisioner: kubernetes.io/gce-pd
parameters:
  type: pd-standard
  zone: us-central1-a
```

#### Glusterfs 示例

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: slow
provisioner: kubernetes.io/glusterfs
parameters:
  resturl: "http://127.0.0.1:8081"
  clusterid: "630372ccdc720a92c681fb928f27b53f"
  restauthenabled: "true"
  restuser: "admin"
  secretNamespace: "default"
  secretName: "heketi-secret"
  gidMin: "40000"
  gidMax: "50000"
  volumetype: "replicate:3"
```

#### OpenStack Cinder 示例

```yaml
kind: StorageClass
apiVersion: storage.k8s.io/v1
metadata:
  name: gold
provisioner: kubernetes.io/cinder
parameters:
  type: fast
  availability: nova
```

#### Ceph RBD 示例

```yaml
apiVersion: storage.k8s.io/v1
  kind: StorageClass
  metadata:
    name: fast
  provisioner: kubernetes.io/rbd
  parameters:
    monitors: 10.16.153.105:6789
    adminId: kube
    adminSecretName: ceph-secret
    adminSecretNamespace: kube-system
    pool: kube
    userId: kube
    userSecretName: ceph-secret-user
```

### Local Volume

Local Volume 允許將 Node 本地的磁盤、分區或者目錄作為持久化存儲使用。注意，Local Volume 不支持動態創建，使用前需要預先創建好 PV。

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: example-pv
spec:
  capacity:
    storage: 100Gi
  # volumeMode field requires BlockVolume Alpha feature gate to be enabled.
  volumeMode: Filesystem
  accessModes:
  - ReadWriteOnce
  persistentVolumeReclaimPolicy: Delete
  storageClassName: local-storage
  local:
    path: /mnt/disks/ssd1
  nodeAffinity:
    required:
      nodeSelectorTerms:
      - matchExpressions:
        - key: kubernetes.io/hostname
          operator: In
          values:
          - example-node
---
kind: StorageClass
apiVersion: storage.k8s.io/v1
metadata:
  name: local-storage
provisioner: kubernetes.io/no-provisioner
volumeBindingMode: WaitForFirstConsumer
```

推薦配置

- 對於需要強 IO 隔離的場景，推薦使用整塊磁盤作為 Volume
- 對於需要容量隔離的場景，推薦使用分區作為 Volume
- 避免在集群中重新創建同名的 Node（無法避免時需要先刪除通過 Affinity 引用該 Node 的 PV）
- 對於文件系統類型的本地存儲，推薦使用 UUID （如 `ls -l /dev/disk/by-uuid`）作為系統掛載點
- 對於無文件系統的塊存儲，推薦生成一個唯一 ID 作軟鏈接（如 `/dev/dis/by-id`）。這可以保證 Volume 名字唯一，並不會與其他 Node 上面的同名 Volume 混淆

## PVC

PV 是存儲資源，而 PersistentVolumeClaim (PVC) 是對 PV 的請求。PVC 跟 Pod 類似：Pod 消費 Node 資源，而 PVC 消費 PV 資源；Pod 能夠請求 CPU 和內存資源，而 PVC 請求特定大小和訪問模式的數據卷。

```yaml
kind: PersistentVolumeClaim
apiVersion: v1
metadata:
  name: myclaim
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 8Gi
  storageClassName: slow
  selector:
    matchLabels:
      release: "stable"
    matchExpressions:
      - {key: environment, operator: In, values: [dev]}
```

PVC 可以直接掛載到 Pod 中：

```yaml
kind: Pod
apiVersion: v1
metadata:
  name: mypod
spec:
  containers:
    - name: myfrontend
      image: dockerfile/nginx
      volumeMounts:
      - mountPath: "/var/www/html"
        name: mypd
  volumes:
    - name: mypd
      persistentVolumeClaim:
        claimName: myclaim
```

## 擴展 PV 空間

> ExpandPersistentVolumes 在 v1.8 開始 Alpha，v1.11 升級為 Beta 版。

v1.8 開始支持擴展 PV 空間，支持在不丟失數據和重啟容器的情況下擴展 PV 的大小。注意，** 當前的實現僅支持不需要調整文件系統大小（XFS、Ext3、Ext4）的 PV，並且只支持以下幾種存儲插件 **：

- AzureDisk
- AzureFile
- gcePersistentDisk
- awsElasticBlockStore
- Cinder
- glusterfs
- rbd
- Portworx

開啟擴展 PV 空間的功能需要配置

- 開啟 `ExpandPersistentVolumes` 功能，即配置 `--feature-gates=ExpandPersistentVolumes=true`
- 開啟准入控制插件 `PersistentVolumeClaimResize`，它只允許擴展明確配置 `allowVolumeExpansion=true` 的 StorageClass，比如

```yaml
kind: StorageClass
apiVersion: storage.k8s.io/v1
metadata:
  name: gluster-vol-default
provisioner: kubernetes.io/glusterfs
parameters:
  resturl: "http://192.168.10.100:8080"
  restuser: ""
  secretNamespace: ""
  secretName: ""
allowVolumeExpansion: true
```

這樣，用戶就可以修改 PVC 中請求存儲的大小（如通過 `kubectl edit` 命令）請求更大的存儲空間。

## 塊存儲（Raw Block Volume）

Kubernetes v1.9 新增了 Alpha 版的 Raw Block Volume，可通過設置 `volumeMode: Block`（可選項為 `Filesystem` 和 `Block`）來使用塊存儲。

> 注意：使用前需要為 kube-apiserver、kube-controller-manager 和 kubelet 開啟 `BlockVolume` 特性，即添加命令行選項 `--feature-gates=BlockVolume=true,...`。

支持塊存儲的 PV 插件包括

- Local Volume
- fc
- iSCSI
- Ceph RBD
- AWS EBS
- GCE PD
- AzureDisk
- Cinder

使用示例

```yaml
# Persistent Volumes using a Raw Block Volume
apiVersion: v1
kind: PersistentVolume
metadata:
  name: block-pv
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce
  volumeMode: Block
  persistentVolumeReclaimPolicy: Retain
  fc:
    targetWWNs: ["50060e801049cfd1"]
    lun: 0
    readOnly: false
---
# Persistent Volume Claim requesting a Raw Block Volume
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: block-pvc
spec:
  accessModes:
    - ReadWriteOnce
  volumeMode: Block
  resources:
    requests:
      storage: 10Gi
---
# Pod specification adding Raw Block Device path in container
apiVersion: v1
kind: Pod
metadata:
  name: pod-with-block-volume
  annotations:
    # apparmor should be unconfied for mounting the device inside container.
    container.apparmor.security.beta.kubernetes.io/fc-container: unconfined
spec:
  containers:
    - name: fc-container
      image: fedora:26
      command: ["/bin/sh", "-c"]
      args: ["tail -f /dev/null"]
      securityContext:
        capabilities:
          # CAP_SYS_ADMIN is required for mount() syscall.
          add: ["SYS_ADMIN"]
      volumeDevices:
        - name: data
          devicePath: /dev/xvda
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: block-pvc
```

## StorageObjectInUseProtection

> 准入控制 StorageObjectInUseProtection 在 v1.11 版本 GA。

當開啟准入控制 StorageObjectInUseProtection（`--admission-control=StorageObjectInUseProtection`）時，刪除使用中的 PV 和 PVC 後，它們會等待使用者刪除後才刪除（而不是之前的立即刪除）。而在使用者刪除之前，它們會一直處於 Terminating 狀態。

## 拓撲感知動態調度

拓撲感知動態存儲卷調度（topology-aware dynamic provisioning）是 v1.12 版本的一個 Beta 特性，用來支持在多可用區集群中動態創建和調度持久化存儲卷。目前的實現支持以下幾種存儲：

- AWS EBS
- Azure Disk
- GCE PD (including Regional PD)
- CSI (alpha) - currently only the GCE PD CSI driver has implemented topology support

使用示例

```yaml
# set WaitForFirstConsumer in storage class
kind: StorageClass
apiVersion: storage.k8s.io/v1
metadata:
  name: topology-aware-standard
provisioner: kubernetes.io/gce-pd
volumeBindingMode: WaitForFirstConsumer
parameters:
  type: pd-standard

# Refer storage class
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: web
spec:   
  serviceName: "nginx"
  replicas: 2
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
            - matchExpressions:
              - key: failure-domain.beta.kubernetes.io/zone
                operator: In
                values:
                - us-central1-a
                - us-central1-f
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector:
              matchExpressions:
              - key: app
                operator: In
                values:
                - nginx
            topologyKey: failure-domain.beta.kubernetes.io/zone
      containers:
      - name: nginx
        image: gcr.io/google_containers/nginx-slim:0.8
        ports:
        - containerPort: 80
          name: web
        volumeMounts:
        - name: www
          mountPath: /usr/share/nginx/html
        - name: logs
          mountPath: /logs
 volumeClaimTemplates:
  - metadata:
      name: www
    spec:
      accessModes: [ "ReadWriteOnce" ]
      storageClassName: topology-aware-standard
      resources:
        requests:
          storage: 10Gi
  - metadata:
      name: logs
    spec:
      accessModes: [ "ReadWriteOnce" ]
      storageClassName: topology-aware-standard
      resources:
        requests:
          storage: 1Gi
```

然後查看 PV，可以發現它們創建在不同的可用區內

```sh
$ kubectl get pv -o=jsonpath='{range .items[*]}{.spec.claimRef.name}{"\t"}{.metadata.labels.failure\-domain\.beta\.kubernetes\.io/zone}{"\n"}{end}'
www-web-0       us-central1-f
logs-web-0      us-central1-f
www-web-1       us-central1-a
logs-web-1      us-central1-a
```

## 存儲快照

存儲快照是 v1.12 新增的 Alpha 特性，用來支持給存儲卷創建快照。支持的插件包括

- [GCE Persistent Disk CSI Driver](https://github.com/kubernetes-sigs/gcp-compute-persistent-disk-csi-driver)
- [OpenSDS CSI Driver](https://github.com/opensds/nbp/tree/master/csi/server)
- [Ceph RBD CSI Driver](https://github.com/ceph/ceph-csi/tree/master/pkg/rbd)
- [Portworx CSI Driver](https://github.com/libopenstorage/openstorage/tree/master/csi)

![image-20181014215558480](assets/image-20181014215558480.png)

在使用前需要開啟特性開關 VolumeSnapshotDataSource。

使用示例：

```yaml
# create snapshot
apiVersion: snapshot.storage.k8s.io/v1alpha1
kind: VolumeSnapshot
metadata:
  name: new-snapshot-demo
  namespace: demo-namespace
spec:
  snapshotClassName: csi-snapclass
  source:
    name: mypvc
    kind: PersistentVolumeClaim
    
# import from snapshot
apiVersion: snapshot.storage.k8s.io/v1alpha1
kind: VolumeSnapshotContent
metadata:
  name: static-snapshot-content
spec:
  csiVolumeSnapshotSource:
    driver: com.example.csi-driver
    snapshotHandle: snapshotcontent-example-id
  volumeSnapshotRef:
    kind: VolumeSnapshot
    name: static-snapshot-demo
    namespace: demo-namespace
    
# provision volume from snapshot
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pvc-restore
  Namespace: demo-namespace
spec:
  storageClassName: csi-storageclass
  dataSource:
    name: new-snapshot-demo
    kind: VolumeSnapshot
    apiGroup: snapshot.storage.k8s.io
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
```

## 參考文檔

- [Kubernetes Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
- [Kubernetes Storage Classes](https://kubernetes.io/docs/concepts/storage/storage-classes/)
- [Dynamic Volume Provisioning](https://kubernetes.io/docs/concepts/storage/dynamic-provisioning/)
- [Kubernetes CSI Documentation](https://kubernetes-csi.github.io/docs/)
- [Volume Snapshots Documentation](https://kubernetes.io/docs/concepts/storage/volume-snapshots/)

