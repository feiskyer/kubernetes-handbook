# Persistent Volume

PersistentVolume (PV) 和 PersistentVolumeClaim (PVC) 提供了方便的持久化卷：PV 提供网络存储资源，而 PVC 请求存储资源。这样，设置持久化的工作流包括配置底层文件系统或者云数据卷、创建持久性数据卷、最后创建 PVC 来将 Pod 跟数据卷关联起来。PV 和 PVC 可以将 pod 和数据卷解耦，pod 不需要知道确切的文件系统或者支持它的持久化引擎。

## Volume生命周期

Volume的生命周期包括5个阶段

1. Provisioning，即PV的创建，可以直接创建PV（静态方式），也可以使用StorageClass动态创建
2. Binding，将PV分配给PVC
3. Using，Pod通过PVC使用该Volume
4. Releasing，Pod释放Volume并删除PVC
5. Reclaiming，回收PV，可以保留PV以便下次使用，也可以直接从云存储中删除

根据这5个阶段，Volume的状态有以下4种

- Available：可用
- Bound：已经分配给PVC
- Released：PVC解绑但还未执行回收策略
- Failed：发生错误

## PV

PersistentVolume（PV）是集群之中的一块网络存储。跟 Node 一样，也是集群的资源。PV 跟 Volume (卷) 类似，不过会有独立于 Pod 的生命周期。比如一个NFS的PV可以定义为

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

PV的访问模式（accessModes）有三种：

* ReadWriteOnce（RWO）：是最基本的方式，可读可写，但只支持被单个Pod挂载。
* ReadOnlyMany（ROX）：可以以只读的方式被多个Pod挂载。
* ReadWriteMany（RWX）：这种存储可以以读写的方式被多个Pod共享。不是每一种存储都支持这三种方式，像共享方式，目前支持的还比较少，比较常用的是NFS。在PVC绑定PV时通常根据两个条件来绑定，一个是存储的大小，另一个就是访问模式。

PV的回收策略（persistentVolumeReclaimPolicy，即PVC释放卷的时候PV该如何操作）也有三种

- Retain，不清理, 保留Volume（需要手动清理）
- Recycle，删除数据，即`rm -rf /thevolume/*`（只有NFS和HostPath支持）
- Delete，删除存储资源，比如删除AWS EBS卷（只有AWS EBS, GCE PD, Azure Disk和Cinder支持）

## StorageClass

上面通过手动的方式创建了一个NFS Volume，这在管理很多Volume的时候不太方便。Kubernetes还提供了[StorageClass](https://kubernetes.io/docs/user-guide/persistent-volumes/#storageclasses)来动态创建PV，不仅节省了管理员的时间，还可以封装不同类型的存储供PVC选用。

StorageClass包括四个部分

- provisioner：指定Volume插件的类型，包括内置插件（如`kubernetes.io/glusterfs`）和外部插件（如[external-storage](https://github.com/kubernetes-incubator/external-storage/tree/master/ceph/cephfs)提供的`ceph.com/cephfs`）。
- mountOptions：指定挂载选项，当PV不支持指定的选项时会直接失败。比如NFS支持`hard`和`nfsvers=4.1`等选项。
- parameters：指定provisioner的选项，比如`kubernetes.io/aws-ebs`支持`type`、`zone`、`iopsPerGB`等参数。
- reclaimPolicy：指定回收策略，同PV的回收策略。

在使用PVC时，可以通过`DefaultStorageClass`准入控制设置默认StorageClass, 即给未设置storageClassName的PVC自动添加默认的StorageClass。而默认的StorageClass带有annotation `storageclass.kubernetes.io/is-default-class=true`。

#### 修改默认StorageClass

取消原来的默认StorageClass

```sh
kubectl patch storageclass <default-class-name> -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"false"}}}'
```

标记新的默认StorageClass

```sh
kubectl patch storageclass <your-class-name> -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
```

#### GCE示例

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

#### Glusterfs示例

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

#### OpenStack Cinder示例

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

#### Ceph RBD示例

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

## 扩展PV空间

v1.8开始支持扩展PV空间，支持在不丢失数据和重启容器的情况下扩展PV的大小。注意，**当前的实现仅支持不需要调整文件系统大小的PV，并且只支持glusterfs**。

开启扩展PV空间的功能需要配置

- 开启ExpandPersistentVolumes功能，即配置`--feature-gates=ExpandPersistentVolumes=true`
- 开启准入控制插件PersistentVolumeClaimResize，它只允许扩展明确配置`allowVolumeExpansion=true`的StorageClass，比如

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

这样，用户就可以修改PVC中请求存储的大小（如通过`kubectl edit`命令）请求更大的存储空间。
