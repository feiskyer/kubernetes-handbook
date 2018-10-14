# Persistent Volume

PersistentVolume (PV) 和 PersistentVolumeClaim (PVC) 提供了方便的持久化卷：PV 提供网络存储资源，而 PVC 请求存储资源。这样，设置持久化的工作流包括配置底层文件系统或者云数据卷、创建持久性数据卷、最后创建 PVC 来将 Pod 跟数据卷关联起来。PV 和 PVC 可以将 pod 和数据卷解耦，pod 不需要知道确切的文件系统或者支持它的持久化引擎。

## Volume 生命周期

Volume 的生命周期包括 5 个阶段

1. Provisioning，即 PV 的创建，可以直接创建 PV（静态方式），也可以使用 StorageClass 动态创建
2. Binding，将 PV 分配给 PVC
3. Using，Pod 通过 PVC 使用该 Volume，并可以通过准入控制 StorageObjectInUseProtection（1.9 及以前版本为 PVCProtection）阻止删除正在使用的 PVC
4. Releasing，Pod 释放 Volume 并删除 PVC
5. Reclaiming，回收 PV，可以保留 PV 以便下次使用，也可以直接从云存储中删除
6. Deleting，删除 PV 并从云存储中删除后段存储

根据这 5 个阶段，Volume 的状态有以下 4 种

- Available：可用
- Bound：已经分配给 PVC
- Released：PVC 解绑但还未执行回收策略
- Failed：发生错误

## API 版本对照表

| Kubernetes 版本 | PV/PVC 版本 | StorageClass 版本      |
| --------------- | ----------- | ---------------------- |
| v1.5-v1.6       | core/v1     | storage.k8s.io/v1beta1 |
| v1.7+           | core/v1     | storage.k8s.io/v1      |

## PV

PersistentVolume（PV）是集群之中的一块网络存储。跟 Node 一样，也是集群的资源。PV 跟 Volume (卷) 类似，不过会有独立于 Pod 的生命周期。比如一个 NFS 的 PV 可以定义为

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

PV 的访问模式（accessModes）有三种：

* ReadWriteOnce（RWO）：是最基本的方式，可读可写，但只支持被单个节点挂载。
* ReadOnlyMany（ROX）：可以以只读的方式被多个节点挂载。
* ReadWriteMany（RWX）：这种存储可以以读写的方式被多个节点共享。不是每一种存储都支持这三种方式，像共享方式，目前支持的还比较少，比较常用的是 NFS。在 PVC 绑定 PV 时通常根据两个条件来绑定，一个是存储的大小，另一个就是访问模式。

PV 的回收策略（persistentVolumeReclaimPolicy，即 PVC 释放卷的时候 PV 该如何操作）也有三种

- Retain，不清理, 保留 Volume（需要手动清理）
- Recycle，删除数据，即 `rm -rf /thevolume/*`（只有 NFS 和 HostPath 支持）
- Delete，删除存储资源，比如删除 AWS EBS 卷（只有 AWS EBS, GCE PD, Azure Disk 和 Cinder 支持）

## StorageClass

上面通过手动的方式创建了一个 NFS Volume，这在管理很多 Volume 的时候不太方便。Kubernetes 还提供了 [StorageClass](https://kubernetes.io/docs/user-guide/persistent-volumes/#storageclasses) 来动态创建 PV，不仅节省了管理员的时间，还可以封装不同类型的存储供 PVC 选用。

StorageClass 包括四个部分

- provisioner：指定 Volume 插件的类型，包括内置插件（如 `kubernetes.io/glusterfs`）和外部插件（如 [external-storage](https://github.com/kubernetes-incubator/external-storage/tree/master/ceph/cephfs) 提供的 `ceph.com/cephfs`）。
- mountOptions：指定挂载选项，当 PV 不支持指定的选项时会直接失败。比如 NFS 支持 `hard` 和 `nfsvers=4.1` 等选项。
- parameters：指定 provisioner 的选项，比如 `kubernetes.io/aws-ebs` 支持 `type`、`zone`、`iopsPerGB` 等参数。
- reclaimPolicy：指定回收策略，同 PV 的回收策略。

在使用 PVC 时，可以通过 `DefaultStorageClass` 准入控制设置默认 StorageClass, 即给未设置 storageClassName 的 PVC 自动添加默认的 StorageClass。而默认的 StorageClass 带有 annotation `storageclass.kubernetes.io/is-default-class=true`。

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

#### 修改默认 StorageClass

取消原来的默认 StorageClass

```sh
kubectl patch storageclass <default-class-name> -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"false"}}}'
```

标记新的默认 StorageClass

```sh
kubectl patch storageclass <your-class-name> -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
```

#### GCE 示例

> 单个 GCE 节点最大支持挂载 16 个 Google Persistent Disk。开启 `AttachVolumeLimit` 特性后，根据节点的类型最大可以挂载 128 个。

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

Local Volume 允许将 Node 本地的磁盘、分区或者目录作为持久化存储使用。注意，Local Volume 不支持动态创建，使用前需要预先创建好 PV。

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

推荐配置

- 对于需要强 IO 隔离的场景，推荐使用整块磁盘作为 Volume
- 对于需要容量隔离的场景，推荐使用分区作为 Volume
- 避免在集群中重新创建同名的 Node（无法避免时需要先删除通过 Affinity 引用该 Node 的 PV）
- 对于文件系统类型的本地存储，推荐使用 UUID （如 `ls -l /dev/disk/by-uuid`）作为系统挂载点
- 对于无文件系统的块存储，推荐生成一个唯一 ID 作软链接（如 `/dev/dis/by-id`）。这可以保证 Volume 名字唯一，并不会与其他 Node 上面的同名 Volume 混淆

## PVC

PV 是存储资源，而 PersistentVolumeClaim (PVC) 是对 PV 的请求。PVC 跟 Pod 类似：Pod 消费 Node 资源，而 PVC 消费 PV 资源；Pod 能够请求 CPU 和内存资源，而 PVC 请求特定大小和访问模式的数据卷。

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

PVC 可以直接挂载到 Pod 中：

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

## 扩展 PV 空间

> ExpandPersistentVolumes 在 v1.8 开始 Alpha，v1.11 升级为 Beta 版。

v1.8 开始支持扩展 PV 空间，支持在不丢失数据和重启容器的情况下扩展 PV 的大小。注意，** 当前的实现仅支持不需要调整文件系统大小（XFS、Ext3、Ext4）的 PV，并且只支持以下几种存储插件 **：

- AzureDisk
- AzureFile
- gcePersistentDisk
- awsElasticBlockStore
- Cinder
- glusterfs
- rbd
- Portworx

开启扩展 PV 空间的功能需要配置

- 开启 `ExpandPersistentVolumes` 功能，即配置 `--feature-gates=ExpandPersistentVolumes=true`
- 开启准入控制插件 `PersistentVolumeClaimResize`，它只允许扩展明确配置 `allowVolumeExpansion=true` 的 StorageClass，比如

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

这样，用户就可以修改 PVC 中请求存储的大小（如通过 `kubectl edit` 命令）请求更大的存储空间。

## 块存储（Raw Block Volume）

Kubernetes v1.9 新增了 Alpha 版的 Raw Block Volume，可通过设置 `volumeMode: Block`（可选项为 `Filesystem` 和 `Block`）来使用块存储。

> 注意：使用前需要为 kube-apiserver、kube-controller-manager 和 kubelet 开启 `BlockVolume` 特性，即添加命令行选项 `--feature-gates=BlockVolume=true,...`。

支持块存储的 PV 插件包括

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

当开启准入控制 StorageObjectInUseProtection（`--admission-control=StorageObjectInUseProtection`）时，删除使用中的 PV 和 PVC 后，它们会等待使用者删除后才删除（而不是之前的立即删除）。而在使用者删除之前，它们会一直处于 Terminating 状态。

## 拓扑感知动态调度

拓扑感知动态存储卷调度（topology-aware dynamic provisioning）是 v1.12 版本的一个 Beta 特性，用来支持在多可用区集群中动态创建和调度持久化存储卷。目前的实现支持以下几种存储：

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

然后查看 PV，可以发现它们创建在不同的可用区内

```sh
$ kubectl get pv -o=jsonpath='{range .items[*]}{.spec.claimRef.name}{"\t"}{.metadata.labels.failure\-domain\.beta\.kubernetes\.io/zone}{"\n"}{end}'
www-web-0       us-central1-f
logs-web-0      us-central1-f
www-web-1       us-central1-a
logs-web-1      us-central1-a
```

## 存储快照

存储快照是 v1.12 新增的 Alpha 特性，用来支持给存储卷创建快照。支持的插件包括

- [GCE Persistent Disk CSI Driver](https://github.com/kubernetes-sigs/gcp-compute-persistent-disk-csi-driver)
- [OpenSDS CSI Driver](https://github.com/opensds/nbp/tree/master/csi/server)
- [Ceph RBD CSI Driver](https://github.com/ceph/ceph-csi/tree/master/pkg/rbd)
- [Portworx CSI Driver](https://github.com/libopenstorage/openstorage/tree/master/csi)

![image-20181014215558480](assets/image-20181014215558480.png)

在使用前需要开启特性开关 VolumeSnapshotDataSource。

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

## 参考文档

- [Kubernetes Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
- [Kubernetes Storage Classes](https://kubernetes.io/docs/concepts/storage/storage-classes/)
- [Dynamic Volume Provisioning](https://kubernetes.io/docs/concepts/storage/dynamic-provisioning/)
- [Kubernetes CSI Documentation](https://kubernetes-csi.github.io/docs/)
- [Volume Snapshots Documentation](https://kubernetes.io/docs/concepts/storage/volume-snapshots/)

