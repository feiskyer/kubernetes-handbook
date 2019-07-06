# Container Storage Interface

Container Storage Interface (CSI) 是从 v1.9 引入的容器存储接口，并于 v1.13 版本正式 GA。实际上，CSI 是整个容器生态的标准存储接口，同样适用于 Mesos、Cloud Foundry 等其他的容器集群调度系统。

**版本信息**

| Kubernetes | CSI Spec | Status |
| ---------- | -------- | ------ |
| v1.9 | v0.1.0   | Alpha  |
| v1.10      | v0.2.0   | Beta   |
| v1.11-v1.12 | v0.3.0   | Beta   |
| v1.13 | [v0.3.0](https://github.com/container-storage-interface/spec/releases/tag/v0.3.0), [v1.0.0](https://github.com/container-storage-interface/spec/releases/tag/v1.0.0) | GA |

Sidecar 容器版本

| Container Name           | Description                                                  | CSI spec | Latest Release Tag |
| ------------------------ | ------------------------------------------------------------ | -------- | ------------------ |
| external-provisioner     | Watch PVC and create PV                                      | v1.0.0   | v1.0.1             |
| external-attacher        | Operate VolumeAttachment                                     | v1.0.0   | v1.0.1             |
| external-snapshotter     | Operate VolumeSnapshot                                       | v1.0.0   | v1.0.1             |
| node-driver-registrar    | Register kubelet plugin                                      | v1.0.0   | v1.0.2             |
| cluster-driver-registrar | Register [CSIDriver Object](https://kubernetes-csi.github.io/docs/csi-driver-object.html) | v1.0.0   | v1.0.1             |
| livenessprobe            | Monitors health of CSI driver                                | v1.0.0   | v1.0.2             |

## 原理

类似于 CRI，CSI 也是基于 gRPC 实现。详细的 CSI SPEC 可以参考 [这里](https://github.com/container-storage-interface/spec/blob/master/spec.md)，它要求插件开发者要实现三个 gRPC 服务：

- **Identity Service**：用于 Kubernetes 与 CSI 插件协调版本信息
- **Controller Service**：用于创建、删除以及管理 Volume 存储卷
- **Node Service**：用于将 Volume 存储卷挂载到指定的目录中以便 Kubelet 创建容器时使用（需要监听在 `/var/lib/kubelet/plugins/[SanitizedCSIDriverName]/csi.sock`）

由于 CSI 监听在 unix socket 文件上， kube-controller-manager 并不能直接调用 CSI 插件。为了协调 Volume 生命周期的管理，并方便开发者实现 CSI 插件，Kubernetes 提供了几个 sidecar 容器并推荐使用下述方法来部署 CSI 插件：

![Recommended CSI Deployment Diagram](assets/container-storage-interface_diagram1.png)

该部署方法包括：

- StatefuelSet：副本数为 1 保证只有一个实例运行，它包含三个容器
  - 用户实现的 CSI 插件
  - [External Attacher](https://github.com/kubernetes-csi/external-attacher)：Kubernetes 提供的 sidecar 容器，它监听 *VolumeAttachment* 和 *PersistentVolume* 对象的变化情况，并调用 CSI 插件的 ControllerPublishVolume 和 ControllerUnpublishVolume 等 API 将 Volume 挂载或卸载到指定的 Node 上
  - [External Provisioner](https://github.com/kubernetes-csi/external-provisioner)：Kubernetes 提供的 sidecar 容器，它监听  *PersistentVolumeClaim* 对象的变化情况，并调用 CSI 插件的 *ControllerPublish* 和 *ControllerUnpublish* 等 API 管理 Volume
- Daemonset：将 CSI 插件运行在每个 Node 上，以便 Kubelet 可以调用。它包含 2 个容器
  - 用户实现的 CSI 插件
  - [Driver Registrar](https://github.com/kubernetes-csi/driver-registrar)：注册 CSI 插件到 kubelet 中，并初始化 *NodeId*（即给 Node 对象增加一个 Annotation `csi.volume.kubernetes.io/nodeid`）

## 配置

- API Server 配置：

```sh
--allow-privileged=true
--feature-gates=CSIPersistentVolume=true,MountPropagation=true
--runtime-config=storage.k8s.io/v1alpha1=true
```

- Controller-manager 配置：

```sh
--feature-gates=CSIPersistentVolume=true
```

- Kubelet 配置：

```sh
--allow-privileged=true
--feature-gates=CSIPersistentVolume=true,MountPropagation=true
```

### 示例

Kubernetes 提供了几个 [CSI 示例](https://github.com/kubernetes-csi/drivers)，包括 NFS、ISCSI、HostPath、Cinder 以及 FlexAdapter 等。在实现 CSI 插件时，这些示例可以用作参考。

| Name                                                         | Status         | More Information                                             |
| ------------------------------------------------------------ | -------------- | ------------------------------------------------------------ |
| [Cinder](https://github.com/kubernetes/cloud-provider-openstack/tree/master/pkg/csi/cinder) | v0.2.0         | A Container Storage Interface (CSI) Storage Plug-in for Cinder |
| [DigitalOcean Block Storage](https://github.com/digitalocean/csi-digitalocean) | v0.0.1 (alpha) | A Container Storage Interface (CSI) Driver for DigitalOcean Block Storage |
| [AWS Elastic Block Storage](https://github.com/kubernetes-sigs/aws-ebs-csi-driver) | v0.0.1(alpha)  | A Container Storage Interface (CSI) Driver for AWS Elastic Block Storage (EBS) |
| [GCE Persistent Disk](https://github.com/kubernetes-sigs/gcp-compute-persistent-disk-csi-driver) | Alpha          | A Container Storage Interface (CSI) Storage Plugin for Google Compute Engine Persistent Disk |
| [OpenSDS](https://www.opensds.io/)                           | Beta           | For more information, please visit [releases](https://github.com/opensds/nbp/releases) and https://github.com/opensds/nbp/tree/master/csi |
| [Portworx](https://portworx.com/)                            | 0.2.0          | CSI implementation is available [here](https://github.com/libopenstorage/openstorage/tree/master/csi) which can be used as an example also. |
| [RBD](https://github.com/ceph/ceph-csi)                      | v0.2.0         | A Container Storage Interface (CSI) Storage RBD Plug-in for Ceph |
| [CephFS](https://github.com/ceph/ceph-csi)                   | v0.2.0         | A Container Storage Interface (CSI) Storage Plug-in for CephFS |
| [ScaleIO](https://github.com/thecodeteam/csi-scaleio)        | v0.1.0         | A Container Storage Interface (CSI) Storage Plugin for DellEMC ScaleIO |
| [vSphere](https://github.com/thecodeteam/csi-vsphere)        | v0.1.0         | A Container Storage Interface (CSI) Storage Plug-in for VMware vSphere |
| [NetApp](https://github.com/NetApp/trident)                  | v0.2.0 (alpha) | A Container Storage Interface (CSI) Storage Plug-in for NetApp's [Trident](https://netapp-trident.readthedocs.io/) container storage orchestrator |
| [Ember CSI](https://ember-csi.io/)                           | v0.2.0 (alpha) | Multi-vendor CSI plugin supporting over 80 storage drivers to provide block and mount storage to Container Orchestration systems. |
| [Nutanix](https://portal.nutanix.com/#/page/docs/details?targetId=CSI-Volume-Driver:CSI-Volume-Driver) | beta           | A Container Storage Interface (CSI) Storage Driver for Nutanix |
| [Quobyte](https://github.com/quobyte/quobyte-csi)            | v0.2.0         | A Container Storage Interface (CSI) Plugin for Quobyte       |

下面以 NFS 为例来看一下 CSI 插件的使用方法。

首先需要部署 NFS 插件：

```sh
git clone https://github.com/kubernetes-csi/drivers
cd drivers/pkg/nfs
kubectl create -f deploy/kubernetes
```

然后创建一个使用 NFS 存储卷的容器

```sh
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

- [Kubernetes CSI Documentation](https://kubernetes-csi.github.io/docs/)
- [CSI Volume Plugins in Kubernetes Design Doc](https://github.com/kubernetes/community/blob/master/contributors/design-proposals/storage/container-storage-interface.md#recommended-mechanism-for-deploying-csi-drivers-on-kubernetes)