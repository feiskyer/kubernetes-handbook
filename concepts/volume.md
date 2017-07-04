# Kubernetes存储卷

我们知道默认情况下容器的数据都是非持久化的，在容器消亡以后数据也跟着丢失，所以Docker提供了Volume机制以便将数据持久化存储。类似的，Kubernetes提供了更强大的Volume机制和丰富的插件，解决了容器数据持久化和容器间共享数据的问题。

与Docker不同，Kubernetes Volume的生命周期与Pod绑定

- 容器挂掉后Kubelet再次重启容器时，Volume的数据依然还在
- 而Pod删除时，Volume才会清理。数据是否丢失取决于具体的Volume类型，比如emptyDir的数据会丢失，而PV的数据则不会丢

## Volume类型

目前，Kubernetes支持以下Volume类型：

- emptyDir
- hostPath
- gcePersistentDisk
- awsElasticBlockStore
- nfs
- iscsi
- flocker
- glusterfs
- rbd
- cephfs
- gitRepo
- secret
- persistentVolumeClaim
- downwardAPI
- azureFileVolume
- azureDisk
- vsphereVolume
- Quobyte
- PortworxVolume
- ScaleIO
- FlexVolume
- StorageOS
- local

注意，这些volume并非全部都是持久化的，比如emptyDir、secret、gitRepo等，这些volume会随着Pod的消亡而消失。

## emptyDir

如果Pod设置了emptyDir类型Volume， Pod 被分配到Node上时候，会创建emptyDir，只要Pod运行在Node上，emptyDir都会存在（容器挂掉不会导致emptyDir丢失数据），但是如果Pod从Node上被删除（Pod被删除，或者Pod发生迁移），emptyDir也会被删除，并且永久丢失。

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

hostPath允许挂载Node上的文件系统到Pod里面去。如果Pod需要使用Node上的文件，可以使用hostPath。

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

NFS 是Network File System的缩写，即网络文件系统。Kubernetes中通过简单地配置就可以挂载NFS到Pod中，而NFS中的数据是可以永久保存的，同时NFS支持同时写操作。

```yaml
volumes:
- name: nfs
  nfs:
    # FIXME: use the right hostname
    server: 10.254.234.223
    path: "/"
```

## gcePersistentDisk

gcePersistentDisk可以挂载GCE上的永久磁盘到容器，需要Kubernetes运行在GCE的VM中。

```yaml
volumes:
  - name: test-volume
    # This GCE PD must already exist.
    gcePersistentDisk:
      pdName: my-data-disk
      fsType: ext4
```

## awsElasticBlockStore

awsElasticBlockStore可以挂载AWS上的EBS盘到容器，需要Kubernetes运行在AWS的EC2上。

```yaml
volumes:
  - name: test-volume
    # This AWS EBS volume must already exist.
    awsElasticBlockStore:
      volumeID: <volume-id>
      fsType: ext4
```

## gitRepo

gitRepo volume将git代码下拉到指定的容器路径中

```yaml
  volumes:
  - name: git-volume
    gitRepo:
      repository: "git@somewhere:me/my-git-repository.git"
      revision: "22f1d8406d464b0c0874075539c1f2e96c253775"
```

## 使用subPath

Pod的多个容器使用同一个Volume时，subPath非常有用

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

如果内置的这些Volume不满足要求，则可以使用FlexVolume实现自己的Volume插件。注意要把volume plugin放到`/usr/libexec/kubernetes/kubelet-plugins/volume/exec/<vendor~driver>/<driver>`，plugin要实现`init/attach/detach/mount/umount`等命令（可参考lvm的[示例](https://github.com/kubernetes/kubernetes/tree/master/examples/volumes/flexvolume)）。

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

Projected volume将多个Volume源映射到同一个目录中，支持secret、downwardAPI和configMap。

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

v1.7+支持对基于本地存储（如hostPath, emptyDir, gitRepo等）的容量进行调度限额，可以通过`--feature-gates=LocalStorageCapacityIsolation=true`来开启这个特性。

为了支持这个特性，Kubernetes将本地存储分为两类

- `storage.kubernetes.io/overlay`，即`/var/lib/docker`的大小
- `storage.kubernetes.io/scratch`，即`/var/lib/kubelet`的大小

Kubernetes根据`storage.kubernetes.io/scratch`的大小来调度本地存储空间，而根据`storage.kubernetes.io/overlay`来调度容器的存储。比如

为容器请求64MB的可写层存储空间

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

为empty请求64MB的存储空间

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

## 其他的Volume参考示例

- [iSCSI Volume示例](https://github.com/kubernetes/kubernetes/tree/master/examples/volumes/iscsi)
- [cephfs Volume示例](https://github.com/kubernetes/kubernetes/tree/master/examples/volumes/cephfs)
- [Flocker Volume示例](https://github.com/kubernetes/kubernetes/tree/master/examples/volumes/flocker)
- [GlusterFS Volume示例](https://github.com/kubernetes/kubernetes/tree/master/examples/volumes/glusterfs)
- [RBD Volume示例](https://github.com/kubernetes/kubernetes/tree/master/examples/volumes/rbd)
- [Secret Volume示例](secret.md#将secret挂载到volume中)
- [downwardAPI Volume示例](https://kubernetes.io/docs/tasks/inject-data-application/downward-api-volume-expose-pod-information/)
- [AzureFileVolume示例](https://github.com/kubernetes/kubernetes/blob/master/examples/volumes/azure_file/README.md)
- [AzureDiskVolume示例](https://github.com/kubernetes/kubernetes/blob/master/examples/volumes/azure_disk/README.md)
- [Quobyte Volume示例](https://github.com/kubernetes/kubernetes/tree/master/examples/volumes/quobyte)
- [PortworxVolume Volume示例](https://github.com/kubernetes/kubernetes/blob/master/examples/volumes/portworx/README.md)
- [ScaleIO Volume示例](https://github.com/kubernetes/kubernetes/tree/master/examples/volumes/scaleio)
- [StorageOS Volume示例](https://github.com/kubernetes/kubernetes/tree/master/examples/volumes/storageos)
