# 容器存储接口 CSI

Container Storage Interface \(CSI\) 是从 v1.9 引入的容器存储接口，并于 v1.13 版本正式 GA。实际上，CSI 是整个容器生态的标准存储接口，同样适用于 Mesos、Cloud Foundry 等其他的容器集群调度系统。

**版本信息**

| Kubernetes | CSI Spec | Status |
| :--- | :--- | :--- |
| v1.9 | v0.1.0 | Alpha |
| v1.10 | v0.2.0 | Beta |
| v1.11-v1.12 | v0.3.0 | Beta |
| v1.13 | [v0.3.0](https://github.com/container-storage-interface/spec/releases/tag/v0.3.0), [v1.0.0](https://github.com/container-storage-interface/spec/releases/tag/v1.0.0) | GA |

Sidecar 容器版本

| Container Name | Description | CSI spec | Latest Release Tag |
| :--- | :--- | :--- | :--- |
| external-provisioner | Watch PVC and create PV | v1.0.0 | v1.0.1 |
| external-attacher | Operate VolumeAttachment | v1.0.0 | v1.0.1 |
| external-snapshotter | Operate VolumeSnapshot | v1.0.0 | v1.0.1 |
| node-driver-registrar | Register kubelet plugin | v1.0.0 | v1.0.2 |
| cluster-driver-registrar | Register [CSIDriver Object](https://kubernetes-csi.github.io/docs/csi-driver-object.html) | v1.0.0 | v1.0.1 |
| livenessprobe | Monitors health of CSI driver | v1.0.0 | v1.0.2 |

## 原理

类似于 CRI，CSI 也是基于 gRPC 实现。详细的 CSI SPEC 可以参考 [这里](https://github.com/container-storage-interface/spec/blob/master/spec.md)，它要求插件开发者要实现三个 gRPC 服务：

* **Identity Service**：用于 Kubernetes 与 CSI 插件协调版本信息
* **Controller Service**：用于创建、删除以及管理 Volume 存储卷
* **Node Service**：用于将 Volume 存储卷挂载到指定的目录中以便 Kubelet 创建容器时使用（需要监听在 `/var/lib/kubelet/plugins/[SanitizedCSIDriverName]/csi.sock`）

由于 CSI 监听在 unix socket 文件上， kube-controller-manager 并不能直接调用 CSI 插件。为了协调 Volume 生命周期的管理，并方便开发者实现 CSI 插件，Kubernetes 提供了几个 sidecar 容器并推荐使用下述方法来部署 CSI 插件：

![Recommended CSI Deployment Diagram](../../.gitbook/assets/container-storage-interface_diagram1%20%282%29.png)

该部署方法包括：

* StatefuelSet：副本数为 1 保证只有一个实例运行，它包含三个容器
  * 用户实现的 CSI 插件
  * [External Attacher](https://github.com/kubernetes-csi/external-attacher)：Kubernetes 提供的 sidecar 容器，它监听 _VolumeAttachment_ 和 _PersistentVolume_ 对象的变化情况，并调用 CSI 插件的 ControllerPublishVolume 和 ControllerUnpublishVolume 等 API 将 Volume 挂载或卸载到指定的 Node 上
  * [External Provisioner](https://github.com/kubernetes-csi/external-provisioner)：Kubernetes 提供的 sidecar 容器，它监听  _PersistentVolumeClaim_ 对象的变化情况，并调用 CSI 插件的 _ControllerPublish_ 和 _ControllerUnpublish_ 等 API 管理 Volume
* Daemonset：将 CSI 插件运行在每个 Node 上，以便 Kubelet 可以调用。它包含 2 个容器
  * 用户实现的 CSI 插件
  * [Driver Registrar](https://github.com/kubernetes-csi/driver-registrar)：注册 CSI 插件到 kubelet 中，并初始化 _NodeId_（即给 Node 对象增加一个 Annotation `csi.volume.kubernetes.io/nodeid`）

## 配置

* API Server 配置：

```bash
--allow-privileged=true
--feature-gates=CSIPersistentVolume=true,MountPropagation=true
--runtime-config=storage.k8s.io/v1alpha1=true
```

* Controller-manager 配置：

```bash
--feature-gates=CSIPersistentVolume=true
```

* Kubelet 配置：

```bash
--allow-privileged=true
--feature-gates=CSIPersistentVolume=true,MountPropagation=true
```

## Kubernetes 1.33 新特性：动态 CSI 节点分配计数

从 Kubernetes 1.33 开始，引入了一个 Alpha 特性 `MutableCSINodeAllocatableCount`，允许 CSI 驱动程序动态更新节点可以处理的最大卷数量。这解决了静态卷附件限制报告的局限性，提高了 Pod 调度的准确性。

### 主要功能

- **动态更新能力**：CSI 驱动程序可以实时更新节点的卷附件容量限制
- **两种更新机制**：
  - 周期性更新：CSI 驱动程序可设置间隔时间来刷新节点附件容量
  - 反应式更新：当卷附件失败时触发立即更新
- **改善调度准确性**：防止将 Pod 调度到卷容量不足的节点上

### 配置要求

需要在以下组件上启用 `MutableCSINodeAllocatableCount` 特性门控：

```bash
# API Server
--feature-gates=MutableCSINodeAllocatableCount=true

# Kubelet  
--feature-gates=MutableCSINodeAllocatableCount=true
```

### CSI 驱动程序配置示例

```yaml
apiVersion: storage.k8s.io/v1
kind: CSIDriver
metadata:
  name: example.csi.k8s.io
spec:
  # 设置节点分配计数更新周期（秒）
  nodeAllocatableUpdatePeriodSeconds: 60
```

### 好处

- 防止 Pod 被调度到卷容量不足的节点
- 减少 Pod 卡在 "ContainerCreating" 状态的情况
- 提供更动态和准确的资源分配
- 改善存储资源的利用效率

> **注意**：这是 Kubernetes v1.33 中的 Alpha 特性。在生产环境中使用前，建议先进行充分测试并向 Kubernetes Storage SIG 提供反馈。

### 示例

Kubernetes 提供了几个 [CSI 示例](https://github.com/kubernetes-csi/drivers)，包括 NFS、ISCSI、HostPath、Cinder 以及 FlexAdapter 等。在实现 CSI 插件时，这些示例可以用作参考。

| Name | Status | More Information |
| :--- | :--- | :--- |
| [Cinder](https://github.com/kubernetes/cloud-provider-openstack/tree/master/pkg/csi/cinder) | v0.2.0 | A Container Storage Interface \(CSI\) Storage Plug-in for Cinder |
| [DigitalOcean Block Storage](https://github.com/digitalocean/csi-digitalocean) | v0.0.1 \(alpha\) | A Container Storage Interface \(CSI\) Driver for DigitalOcean Block Storage |
| [AWS Elastic Block Storage](https://github.com/kubernetes-sigs/aws-ebs-csi-driver) | v0.0.1\(alpha\) | A Container Storage Interface \(CSI\) Driver for AWS Elastic Block Storage \(EBS\) |
| [GCE Persistent Disk](https://github.com/kubernetes-sigs/gcp-compute-persistent-disk-csi-driver) | Alpha | A Container Storage Interface \(CSI\) Storage Plugin for Google Compute Engine Persistent Disk |
| [OpenSDS](https://www.opensds.io/) | Beta | For more information, please visit [releases](https://github.com/opensds/nbp/releases) and [https://github.com/opensds/nbp/tree/master/csi](https://github.com/opensds/nbp/tree/master/csi) |
| [Portworx](https://portworx.com/) | 0.2.0 | CSI implementation is available [here](https://github.com/libopenstorage/openstorage/tree/master/csi) which can be used as an example also. |
| [RBD](https://github.com/ceph/ceph-csi) | v0.2.0 | A Container Storage Interface \(CSI\) Storage RBD Plug-in for Ceph |
| [CephFS](https://github.com/ceph/ceph-csi) | v0.2.0 | A Container Storage Interface \(CSI\) Storage Plug-in for CephFS |
| [ScaleIO](https://github.com/thecodeteam/csi-scaleio) | v0.1.0 | A Container Storage Interface \(CSI\) Storage Plugin for DellEMC ScaleIO |
| [vSphere](https://github.com/thecodeteam/csi-vsphere) | v0.1.0 | A Container Storage Interface \(CSI\) Storage Plug-in for VMware vSphere |
| [NetApp](https://github.com/NetApp/trident) | v0.2.0 \(alpha\) | A Container Storage Interface \(CSI\) Storage Plug-in for NetApp's [Trident](https://netapp-trident.readthedocs.io/) container storage orchestrator |
| [Ember CSI](https://ember-csi.io/) | v0.2.0 \(alpha\) | Multi-vendor CSI plugin supporting over 80 storage drivers to provide block and mount storage to Container Orchestration systems. |
| [Nutanix](https://portal.nutanix.com/#/page/docs/details?targetId=CSI-Volume-Driver:CSI-Volume-Driver) | beta | A Container Storage Interface \(CSI\) Storage Driver for Nutanix |
| [Quobyte](https://github.com/quobyte/quobyte-csi) | v0.2.0 | A Container Storage Interface \(CSI\) Plugin for Quobyte |

## CSI 卷数据填充器

从 Kubernetes v1.33 开始，CSI 驱动程序可以实现卷数据填充器（Volume Populators）功能，支持在卷创建时从自定义数据源填充数据。

### 实现方式

CSI 驱动程序可以通过以下方式支持卷数据填充器：

1. **传统方式**：创建填充 Pod 来处理数据填充任务
2. **插件方式（v1.33 新增）**：实现插件函数，可选择性地跳过创建填充 Pod

### CSI 驱动程序配置

要支持卷数据填充器，CSI 驱动程序需要在 CSIDriver 对象中声明支持的自定义资源类型：

```yaml
apiVersion: storage.k8s.io/v1
kind: CSIDriver
metadata:
  name: example.csi.k8s.io
spec:
  # 其他 CSI 驱动程序配置...
  
  # 声明支持的数据源类型
  populatorPolicy:
    # 支持处理的自定义资源类型
    supportedVolumeDataSources:
    - apiGroup: backup.example.com
      kind: VolumeBackup
    - apiGroup: snapshot.example.com  
      kind: ExternalSnapshot
```

### 使用示例

配合 CSI 驱动程序使用卷数据填充器：

```yaml
# 自定义数据源
apiVersion: backup.example.com/v1
kind: VolumeBackup
metadata:
  name: database-backup-v1
  namespace: default
spec:
  backupURL: "s3://my-bucket/database-backup-20250101.tar.gz"
  restorePoint: "2025-01-01T10:00:00Z"
---
# 使用自定义数据源的 PVC
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: restored-database
  namespace: default
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 50Gi
  storageClassName: fast-csi-storage
  dataSourceRef:
    apiGroup: backup.example.com
    kind: VolumeBackup
    name: database-backup-v1
```

### CSI 插件实现要点

实现支持卷数据填充器的 CSI 驱动程序时需要注意：

1. **数据源识别**：解析 PVC 中的 `dataSourceRef` 字段
2. **填充逻辑**：根据自定义资源的规格实现数据填充
3. **状态报告**：准确报告填充进度和完成状态
4. **错误处理**：处理填充失败的情况并提供清晰的错误信息

### 与传统数据源的区别

| 特性 | 传统数据源 (VolumeSnapshot) | CSI 卷数据填充器 |
|------|------------------------------|------------------|
| 数据源类型 | 限制于内置类型 | 支持任意自定义资源 |
| 填充逻辑 | 内置实现 | CSI 驱动程序自定义 |
| 扩展性 | 有限 | 高度可扩展 |
| 数据来源 | 仅 Kubernetes 内部 | 可从外部系统获取 |

## NFS CSI 示例

下面以 NFS 为例来看一下 CSI 插件的使用方法。

首先需要部署 NFS 插件：

```bash
git clone https://github.com/kubernetes-csi/drivers
cd drivers/pkg/nfs
kubectl create -f deploy/kubernetes
```

然后创建一个使用 NFS 存储卷的容器

```bash
kubectl create -f examples/kubernetes/nginx.yaml
```

该例中已直接创建 PV 的方式使用 NFS

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: data-nfsplugin
  labels:
    name: data-nfsplugin
  annotations:
    csi.volume.kubernetes.io/volume-attributes: '{"server":"10.10.10.10","share":"share"}'
spec:
  accessModes:
  - ReadWriteOnce
  capacity:
    storage: 100Gi
  csi:
    driver: csi-nfsplugin
    volumeHandle: data-id
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data-nfsplugin
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
  selector:
    matchExpressions:
    - key: name
      operator: In
      values: ["data-nfsplugin"]
```

也可以用在 StorageClass 中

```yaml
kind: StorageClass
apiVersion: storage.k8s.io/v1
metadata:
  name: csi-sc-nfsplugin
provisioner: csi-nfsplugin
parameters:

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: request-for-storage
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
  storageClassName: csi-sc-nfsplugin
```

## 参考文档

* [Kubernetes CSI Documentation](https://kubernetes-csi.github.io/docs/)
* [CSI Volume Plugins in Kubernetes Design Doc](https://github.com/kubernetes/community/blob/master/contributors/design-proposals/storage/container-storage-interface.md#recommended-mechanism-for-deploying-csi-drivers-on-kubernetes)
