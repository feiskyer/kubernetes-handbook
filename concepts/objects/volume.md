# Volume

我们知道默认情况下容器的数据都是非持久化的，在容器消亡以后数据也跟着丢失，所以 Docker 提供了 Volume 机制以便将数据持久化存储。类似的，Kubernetes 提供了更强大的 Volume 机制和丰富的插件，解决了容器数据持久化和容器间共享数据的问题。

与 Docker 不同，Kubernetes Volume 的生命周期与 Pod 绑定

* 容器挂掉后 Kubelet 再次重启容器时，Volume 的数据依然还在
* 而 Pod 删除时，Volume 才会清理。数据是否丢失取决于具体的 Volume 类型，比如 emptyDir 的数据会丢失，而 PV 的数据则不会丢

## Volume 类型

目前，Kubernetes 支持以下 Volume 类型：

* emptyDir
* hostPath
* gcePersistentDisk
* awsElasticBlockStore
* nfs
* iscsi
* flocker
* glusterfs
* rbd
* cephfs
* gitRepo
* secret
* persistentVolumeClaim
* downwardAPI
* azureFileVolume
* azureDisk
* vsphereVolume
* Quobyte
* PortworxVolume
* ScaleIO
* FlexVolume
* StorageOS
* local
* image

注意，这些 volume 并非全部都是持久化的，比如 emptyDir、secret、gitRepo 等，这些 volume 会随着 Pod 的消亡而消失。

## API 版本对照表

| Kubernetes 版本 | Core API 版本 |
| :--- | :--- |
| v1.5+ | core/v1 |

## emptyDir

如果 Pod 设置了 emptyDir 类型 Volume， Pod 被分配到 Node 上时候，会创建 emptyDir，只要 Pod 运行在 Node 上，emptyDir 都会存在（容器挂掉不会导致 emptyDir 丢失数据），但是如果 Pod 从 Node 上被删除（Pod 被删除，或者 Pod 发生迁移），emptyDir 也会被删除，并且永久丢失。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: test-pd
spec:
  containers:
  - image: gcr.io/google_containers/test-webserver
    name: test-container
    volumeMounts:
    - mountPath: /cache
      name: cache-volume
  volumes:
  - name: cache-volume
    emptyDir: {}
```

## hostPath

hostPath 允许挂载 Node 上的文件系统到 Pod 里面去。如果 Pod 需要使用 Node 上的文件，可以使用 hostPath。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: test-pd
spec:
  containers:
  - image: gcr.io/google_containers/test-webserver
    name: test-container
    volumeMounts:
    - mountPath: /test-pd
      name: test-volume
  volumes:
  - name: test-volume
    hostPath:
      path: /data
```

## NFS

NFS 是 Network File System 的缩写，即网络文件系统。Kubernetes 中通过简单地配置就可以挂载 NFS 到 Pod 中，而 NFS 中的数据是可以永久保存的，同时 NFS 支持同时写操作。

```yaml
volumes:
- name: nfs
  nfs:
    # FIXME: use the right hostname
    server: 10.254.234.223
    path: "/"
```

## gcePersistentDisk

gcePersistentDisk 可以挂载 GCE 上的永久磁盘到容器，需要 Kubernetes 运行在 GCE 的 VM 中。

```yaml
volumes:
  - name: test-volume
    # This GCE PD must already exist.
    gcePersistentDisk:
      pdName: my-data-disk
      fsType: ext4
```

## awsElasticBlockStore

awsElasticBlockStore 可以挂载 AWS 上的 EBS 盘到容器，需要 Kubernetes 运行在 AWS 的 EC2 上。

```yaml
volumes:
  - name: test-volume
    # This AWS EBS volume must already exist.
    awsElasticBlockStore:
      volumeID: <volume-id>
      fsType: ext4
```

## gitRepo

gitRepo volume 将 git 代码下拉到指定的容器路径中

```yaml
  volumes:
  - name: git-volume
    gitRepo:
      repository: "git@somewhere:me/my-git-repository.git"
      revision: "22f1d8406d464b0c0874075539c1f2e96c253775"
```

## image

image volume 是 Kubernetes v1.33 中升级为 Beta 的新功能，允许将容器镜像作为 volume 挂载到 Pod 中。这个功能对于需要共享容器镜像内容或访问镜像中的静态文件非常有用。

### 主要特性

* 从 Alpha 升级为 Beta（需要开启 `ImageVolume` 特性开关）
* 支持 `subPath` 和 `subPathExpr` 挂载方式
* 卷被挂载为只读，且具有 `noexec` 限制
* 新增了 kubelet 指标来跟踪镜像卷的请求和挂载操作

### 使用示例

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: image-volume-example
spec:
  containers:
  - name: shell
    image: debian
    volumeMounts:
    - name: volume
      mountPath: /volume
      subPath: dir
  volumes:
  - name: volume
    image:
      reference: quay.io/crio/artifact:v2
      pullPolicy: IfNotPresent
```

### 容器运行时支持

* CRI-O 从 v1.31 开始支持此功能
* containerd 正在开发完整的 Beta 支持

### 注意事项

* 需要开启 `ImageVolume` 特性开关
* 检查容器运行时是否支持此功能
* 可以使用新的 kubelet 指标监控镜像卷性能

## 使用 subPath

Pod 的多个容器使用同一个 Volume 时，subPath 非常有用

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-lamp-site
spec:
    containers:
    - name: mysql
      image: mysql
      volumeMounts:
      - mountPath: /var/lib/mysql
        name: site-data
        subPath: mysql
    - name: php
      image: php
      volumeMounts:
      - mountPath: /var/www/html
        name: site-data
        subPath: html
    volumes:
    - name: site-data
      persistentVolumeClaim:
        claimName: my-lamp-site-data
```

## FlexVolume

如果内置的这些 Volume 不满足要求，则可以使用 FlexVolume 实现自己的 Volume 插件。注意要把 volume plugin 放到 `/usr/libexec/kubernetes/kubelet-plugins/volume/exec/<vendor~driver>/<driver>`，plugin 要实现 `init/attach/detach/mount/umount` 等命令（可参考 lvm 的 [示例](https://github.com/kubernetes/examples/tree/master/staging/volumes/flexvolume)）。

```yaml
  - name: test
    flexVolume:
      driver: "kubernetes.io/lvm"
      fsType: "ext4"
      options:
        volumeID: "vol1"
        size: "1000m"
        volumegroup: "kube_vg"
```

## Projected Volume

Projected volume 将多个 Volume 源映射到同一个目录中，支持 secret、downwardAPI 和 configMap。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: volume-test
spec:
  containers:
  - name: container-test
    image: busybox
    volumeMounts:
    - name: all-in-one
      mountPath: "/projected-volume"
      readOnly: true
  volumes:
  - name: all-in-one
    projected:
      sources:
      - secret:
          name: mysecret
          items:
            - key: username
              path: my-group/my-username
      - downwardAPI:
          items:
            - path: "labels"
              fieldRef:
                fieldPath: metadata.labels
            - path: "cpu_limit"
              resourceFieldRef:
                containerName: container-test
                resource: limits.cpu
      - configMap:
          name: myconfigmap
          items:
            - key: config
              path: my-group/my-config
```

## 本地存储限额

v1.7 + 支持对基于本地存储（如 hostPath, emptyDir, gitRepo 等）的容量进行调度限额，可以通过 `--feature-gates=LocalStorageCapacityIsolation=true` 来开启这个特性。

为了支持这个特性，Kubernetes 将本地存储分为两类

* `storage.kubernetes.io/overlay`，即 `/var/lib/docker` 的大小
* `storage.kubernetes.io/scratch`，即 `/var/lib/kubelet` 的大小

Kubernetes 根据 `storage.kubernetes.io/scratch` 的大小来调度本地存储空间，而根据 `storage.kubernetes.io/overlay` 来调度容器的存储。比如

为容器请求 64MB 的可写层存储空间

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: ls1
spec:
  restartPolicy: Never
  containers:
  - name: hello
    image: busybox
    command: ["df"]
    resources:
      requests:
        storage.kubernetes.io/overlay: 64Mi
```

为 empty 请求 64MB 的存储空间

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: ls1
spec:
  restartPolicy: Never
  containers:
  - name: hello
    image: busybox
    command: ["df"]
    volumeMounts:
    - name: data
      mountPath: /data
  volumes:
  - name: data
    emptyDir:
      sizeLimit: 64Mi
```

## Mount 传递

在 Kubernetes 中，Volume Mount 默认是 [私有的](https://www.kernel.org/doc/Documentation/filesystems/sharedsubtree.txt)，但从 v1.8 开始，Kubernetes 支持配置 Mount 传递（mountPropagation）。它支持两种选项

* HostToContainer：这是开启 `MountPropagation=true` 时的默认模式，等效于 `rslave` 模式，即容器可以看到 Host 上面在该 volume 内的任何新 Mount 操作
* Bidirectional：等效于 `rshared` 模式，即 Host 和容器都可以看到对方在该 Volume 内的任何新 Mount 操作。该模式要求容器必须运行在特权模式（即 `securityContext.privileged=true`）

注意：

* 使用 Mount 传递需要开启 `--feature-gates=MountPropagation=true`
* `rslave` 和 `rshared` 的说明可以参考 [内核文档](https://www.kernel.org/doc/Documentation/filesystems/sharedsubtree.txt)

## Volume 快照

v1.8 新增了 pre-alpha 版本的 Volume 快照，但还只是一个雏形，并且其实现不在 Kubernetes 核心代码中，而是存放在 [kubernetes-incubator/external-storage](https://github.com/kubernetes-incubator/external-storage/tree/master/snapshot) 中。

> TODO: 补充 Volume 快照的设计原理和示例。

## Windows Volume

Windows 容器暂时只支持 local、emptyDir、hostPath、AzureDisk、AzureFile 以及 flexvolume。注意 Volume 的路径格式需要为 `mountPath: "C:\\etc\\foo"` 或者 `mountPath: "C:/etc/foo"`。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: hostpath-pod
spec:
  containers:
  - name: hostpath-nano
    image: microsoft/nanoserver:1709
    stdin: true
    tty: true
    volumeMounts:
    - name: blah
      mountPath: "C:\\etc\\foo"
      readOnly: true
  nodeSelector:
    beta.kubernetes.io/os: windows
  volumes:
  - name: blah
    hostPath:
      path: "C:\\AzureData"
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: empty-dir-pod
spec:
  containers:
  - image: microsoft/nanoserver:1709
    name: empty-dir-nano
    stdin: true
    tty: true
    volumeMounts:
    - mountPath: /cache
      name: cache-volume
    - mountPath: C:/scratch
      name: scratch-volume
  volumes:
  - name: cache-volume
    emptyDir: {}
  - name: scratch-volume
    emptyDir: {}
  nodeSelector:
    beta.kubernetes.io/os: windows
```

## 卷数据填充器（Volume Populators，v1.33 GA）

卷数据填充器是 Kubernetes v1.33 正式稳定（GA）的特性，允许在创建 PersistentVolumeClaim 时使用自定义资源作为数据源来预填充卷的内容。

### 基本概念

卷数据填充器支持在 PVC 创建时指定自定义资源作为数据源，这些自定义资源可以包含初始化数据的相关信息，如备份位置、模板数据或其他数据源配置。

### 使用方式

通过在 PVC 中使用 `dataSourceRef` 字段指定自定义数据源：

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: app-data-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
  storageClassName: example-storage
  dataSourceRef:
    apiGroup: backup.example.com
    kind: BackupSource
    name: app-backup-20250109
```

### 主要特性

* **自定义数据源** - 支持任意类型的自定义资源作为数据源
* **灵活的初始化** - 可从备份、模板、或外部系统初始化数据
* **AnyVolumeDataSource 默认启用** - v1.33 中该特性门控默认开启
* **可选填充 Pod** - 支持基于插件的填充方式，可选择性跳过创建填充 Pod

### 应用场景

1. **数据库初始化** - 从备份恢复数据库到新的存储卷
2. **应用模板** - 使用预配置的应用数据模板
3. **开发环境** - 快速创建包含测试数据的开发环境
4. **灾难恢复** - 从备份系统恢复数据到新集群

### 实现示例

```yaml
# 自定义数据源定义
apiVersion: template.example.com/v1
kind: DataTemplate
metadata:
  name: wordpress-template
spec:
  templateURL: "https://example.com/templates/wordpress-starter.tar.gz"
  includeDatabase: true
  sampleContent: true
---
# 使用数据源的 PVC
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: wordpress-data
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 20Gi
  storageClassName: fast-ssd
  dataSourceRef:
    apiGroup: template.example.com
    kind: DataTemplate
    name: wordpress-template
```

### 注意事项

* 需要相应的卷填充器控制器来处理特定的自定义资源类型
* 数据填充过程可能需要时间，Pod 会等待填充完成后才能启动
* 确保自定义资源与 PVC 在相同的命名空间中

## 挂载传播

[挂载传播（MountPropagation）](https://www.kernel.org/doc/Documentation/filesystems/sharedsubtree.txt)是 v1.9 引入的新功能，并在 v1.10 中升级为 Beta 版本。挂载传播用来解决同一个 Volume 在不同的容器甚至是 Pod 之间挂载的问题。通过设置 \`Container.volumeMounts.mountPropagation），可以为该存储卷设置不同的传播类型。

支持三种选项：

* None：即私有挂载（private）
* HostToContainer：即 Host 内在该目录中的新挂载都可以在容器中看到，等价于 Linux 内核的 rslave。
* Bidirectional：即 Host 内在该目录中的新挂载都可以在容器中看到，同样容器内在该目录中的任何新挂载也都可以在 Host 中看到，等价于 Linux 内核的 rshared。仅特权容器（privileged）可以使用 Bidirectional 类型。

注意：

* 使用前需要开启 MountPropagation 特性
* 如未设置，则 v1.9 和 v1.10 中默认为私有挂载（`None`），而 v1.11 中默认为 `HostToContainer`
* Docker 服务的 systemd 配置文件中需要设置 `MountFlags=shared`

## 其他的 Volume 参考示例

[https://github.com/kubernetes/examples/tree/master/staging/volumes/iscsi](https://github.com/kubernetes/examples/tree/master/staging/volumes/iscsi)

* [iSCSI Volume 示例](https://github.com/kubernetes/examples/tree/master/staging/volumes/iscsi)
* [cephfs Volume 示例](https://github.com/kubernetes/examples/tree/master/staging/volumes/cephfs)
* [Flocker Volume 示例](https://github.com/kubernetes/examples/tree/master/staging/volumes/flocker)
* [GlusterFS Volume 示例](https://github.com/kubernetes/examples/tree/master/staging/volumes/glusterfs)
* [RBD Volume 示例](https://github.com/kubernetes/examples/tree/master/staging/volumes/rbd)
* [Secret Volume 示例](secret.md)
* [downwardAPI Volume 示例](https://kubernetes.io/docs/tasks/inject-data-application/downward-api-volume-expose-pod-information/)
* [AzureFile Volume 示例](https://github.com/kubernetes/examples/tree/master/staging/volumes/azure_file)
* [AzureDisk Volume 示例](https://github.com/kubernetes/examples/tree/master/staging/volumes/azure_disk)
* [Quobyte Volume 示例](https://github.com/kubernetes/examples/tree/master/staging/volumes/quobyte)
* [Portworx Volume 示例](https://github.com/kubernetes/examples/tree/master/staging/volumes/portworx)
* [ScaleIO Volume 示例](https://github.com/kubernetes/examples/tree/master/staging/volumes/scaleio)
* [StorageOS Volume 示例](https://github.com/kubernetes/examples/tree/master/staging/volumes/storageos)

