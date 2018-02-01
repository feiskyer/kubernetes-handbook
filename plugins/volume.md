# Volume插件扩展

Kubernetes已经提供丰富的[Volume](../concepts/volume.md)和[Persistent Volume](../concepts/persistent-volume.md)插件，可以根据需要使用这些插件给容器提供持久化存储。

如果内置的这些Volume还不满足要求，则可以使用 FlexVolume 或者 CSI 实现自己的Volume插件。

## CSI

Contaner Storage Interface (CSI) 是从 v1.9 引入的容器存储接口（alpha版本），用于扩展 Kubernetes 的存储生态。实际上，CSI 是整个容器生态的标准存储接口，同样适用于 Mesos、Cloud Foundry 等其他的容器集群调度系统。

### 原理

类似于 CRI，CSI 也是基于 gRPC 实现。详细的 CSI SPEC 可以参考[这里](https://github.com/container-storage-interface/spec/blob/master/spec.md)，它要求插件开发者要实现三个 gRPC 服务：

- **Identity Service**：用于 Kubernetes 与 CSI 插件协调版本信息
- **Controller Service**：用于创建、删除以及管理 Volume 存储卷
- **Node Service**：用于将 Volume 存储卷挂载到指定的目录中以便 Kubelet 创建容器时使用（需要监听在 `/var/lib/kubelet/plugins/[SanitizedCSIDriverName]/csi.sock`）

由于 CSI 监听在 unix socket 文件上， kube-controller-manager 并不能直接调用 CSI 插件。为了协调 Volume 生命周期的管理，并方便开发者实现 CSI 插件，Kubernetes 提供了几个 sidecar 容器并推荐使用下述方法来部署 CSI 插件：

![](images/container-storage-interface_diagram1.png)

该部署方法包括：

* StatefuelSet：副本数为1保证只有一个实例运行，它包含三个容器
  * 用户实现的 CSI 插件
  * [External Attacher](https://github.com/kubernetes-csi/external-attacher)：Kubernetes 提供的 sidecar 容器，它监听 *VolumeAttachment* 和 *PersistentVolume* 对象的变化情况，并调用 CSI 插件的 ControllerPublishVolume 和 ControllerUnpublishVolume 等 API 将 Volume 挂载或卸载到指定的 Node 上
  * [External Provisioner](https://github.com/kubernetes-csi/external-provisioner)：Kubernetes 提供的 sidecar 容器，它监听  *PersistentVolumeClaim* 对象的变化情况，并调用 CSI 插件的 *ControllerPublish* 和 *ControllerUnpublish* 等 API管理 Volume
* Daemonset：将 CSI 插件运行在每个 Node 上，以便 Kubelet 可以调用。它包含 2 个容器
  * 用户实现的 CSI 插件
  * [Driver Registrar](https://github.com/kubernetes-csi/driver-registrar)：注册 CSI 插件到 kubelet 中，并初始化 *NodeId*（即给 Node 对象增加一个 Annotation `csi.volume.kubernetes.io/nodeid`）

### 配置

- API Server 配置：

```
--allow-privileged=true
--feature-gates=CSIPersistentVolume=true,MountPropagation=true
--runtime-config=storage.k8s.io/v1alpha1=true
```

- Controller-manager 配置：

```
--feature-gates=CSIPersistentVolume=true
```

- Kubelet 配置：

```
--allow-privileged=true
--feature-gates=CSIPersistentVolume=true,MountPropagation=true
```

### 示例

Kubernetes 提供了几个 [CSI 示例](https://github.com/kubernetes-csi/drivers)，包括 NFS、ISCSI、HostPath、Cinder 以及 FlexAdapter 等。在实现 CSI 插件时，这些示例可以用作参考。下面以 NFS 为例来看一下 CSI 插件的使用方法。

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
    csi.volume.kubernetes.io/volume-attributes: '{"server": "10.10.10.10", "share": "share"}'
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

## FlexVolume

实现一个FlexVolume包括两个步骤

- 实现[FlexVolume插件接口](https://github.com/kubernetes/community/blob/master/contributors/devel/flexvolume.md)，包括`init/attach/detach/mount/umount`等命令（可参考[lvm示例](https://github.com/kubernetes/kubernetes/tree/master/examples/volumes/flexvolume)和[NFS示例](https://github.com/kubernetes/kubernetes/blob/master/examples/volumes/flexvolume/nfs)）
- 将插件放到`/usr/libexec/kubernetes/kubelet-plugins/volume/exec/<vendor~driver>/<driver>`目录中

而在使用flexVolume时，需要指定卷的driver，格式为`<vendor~driver>/<driver>`，如下面的例子使用了`kubernetes.io/lvm`

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
  namespace: default
spec:
  containers:
  - name: nginx
    image: nginx
    volumeMounts:
    - name: test
      mountPath: /data
    ports:
    - containerPort: 80
  volumes:
  - name: test
    flexVolume:
      driver: "kubernetes.io/lvm"
      fsType: "ext4"
      options:
        volumeID: "vol1"
        size: "1000m"
        volumegroup: "kube_vg"
```

> 注意：在v1.7版本，部署新的FlevVolume插件后需要重启 kubelet 和 kube-controller-manager；而从v1.8开始不需要重启它们了。

## 参考文档

- [Kubernetes CSI Documentation](https://kubernetes-csi.github.io/docs/Home.html)
- [CSI Volume Plugins in Kubernetes Design Doc](https://github.com/kubernetes/community/blob/master/contributors/design-proposals/storage/container-storage-interface.md#recommended-mechanism-for-deploying-csi-drivers-on-kubernetes)