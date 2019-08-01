# Kubernetes 存儲卷

我們知道默認情況下容器的數據都是非持久化的，在容器消亡以後數據也跟著丟失，所以 Docker 提供了 Volume 機制以便將數據持久化存儲。類似的，Kubernetes 提供了更強大的 Volume 機制和豐富的插件，解決了容器數據持久化和容器間共享數據的問題。

與 Docker 不同，Kubernetes Volume 的生命週期與 Pod 綁定

- 容器掛掉後 Kubelet 再次重啟容器時，Volume 的數據依然還在
- 而 Pod 刪除時，Volume 才會清理。數據是否丟失取決於具體的 Volume 類型，比如 emptyDir 的數據會丟失，而 PV 的數據則不會丟

## Volume 類型

目前，Kubernetes 支持以下 Volume 類型：

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

注意，這些 volume 並非全部都是持久化的，比如 emptyDir、secret、gitRepo 等，這些 volume 會隨著 Pod 的消亡而消失。

## API 版本對照表

| Kubernetes 版本 | Core API 版本 |
| --------------- | ------------- |
| v1.5+           | core/v1       |

## emptyDir

如果 Pod 設置了 emptyDir 類型 Volume， Pod 被分配到 Node 上時候，會創建 emptyDir，只要 Pod 運行在 Node 上，emptyDir 都會存在（容器掛掉不會導致 emptyDir 丟失數據），但是如果 Pod 從 Node 上被刪除（Pod 被刪除，或者 Pod 發生遷移），emptyDir 也會被刪除，並且永久丟失。

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

hostPath 允許掛載 Node 上的文件系統到 Pod 裡面去。如果 Pod 需要使用 Node 上的文件，可以使用 hostPath。

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

NFS 是 Network File System 的縮寫，即網絡文件系統。Kubernetes 中通過簡單地配置就可以掛載 NFS 到 Pod 中，而 NFS 中的數據是可以永久保存的，同時 NFS 支持同時寫操作。

```yaml
volumes:
- name: nfs
  nfs:
    # FIXME: use the right hostname
    server: 10.254.234.223
    path: "/"
```

## gcePersistentDisk

gcePersistentDisk 可以掛載 GCE 上的永久磁盤到容器，需要 Kubernetes 運行在 GCE 的 VM 中。

```yaml
volumes:
  - name: test-volume
    # This GCE PD must already exist.
    gcePersistentDisk:
      pdName: my-data-disk
      fsType: ext4
```

## awsElasticBlockStore

awsElasticBlockStore 可以掛載 AWS 上的 EBS 盤到容器，需要 Kubernetes 運行在 AWS 的 EC2 上。

```yaml
volumes:
  - name: test-volume
    # This AWS EBS volume must already exist.
    awsElasticBlockStore:
      volumeID: <volume-id>
      fsType: ext4
```

## gitRepo

gitRepo volume 將 git 代碼下拉到指定的容器路徑中

```yaml
  volumes:
  - name: git-volume
    gitRepo:
      repository: "git@somewhere:me/my-git-repository.git"
      revision: "22f1d8406d464b0c0874075539c1f2e96c253775"
```

## 使用 subPath

Pod 的多個容器使用同一個 Volume 時，subPath 非常有用

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

如果內置的這些 Volume 不滿足要求，則可以使用 FlexVolume 實現自己的 Volume 插件。注意要把 volume plugin 放到 `/usr/libexec/kubernetes/kubelet-plugins/volume/exec/<vendor~driver>/<driver>`，plugin 要實現 `init/attach/detach/mount/umount` 等命令（可參考 lvm 的 [示例](https://github.com/kubernetes/examples/tree/master/staging/volumes/flexvolume)）。

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

Projected volume 將多個 Volume 源映射到同一個目錄中，支持 secret、downwardAPI 和 configMap。

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

## 本地存儲限額

v1.7 + 支持對基於本地存儲（如 hostPath, emptyDir, gitRepo 等）的容量進行調度限額，可以通過 `--feature-gates=LocalStorageCapacityIsolation=true` 來開啟這個特性。

為了支持這個特性，Kubernetes 將本地存儲分為兩類

- `storage.kubernetes.io/overlay`，即 `/var/lib/docker` 的大小
- `storage.kubernetes.io/scratch`，即 `/var/lib/kubelet` 的大小

Kubernetes 根據 `storage.kubernetes.io/scratch` 的大小來調度本地存儲空間，而根據 `storage.kubernetes.io/overlay` 來調度容器的存儲。比如

為容器請求 64MB 的可寫層存儲空間

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

為 empty 請求 64MB 的存儲空間

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

## Mount 傳遞

在 Kubernetes 中，Volume Mount 默認是 [私有的](https://www.kernel.org/doc/Documentation/filesystems/sharedsubtree.txt)，但從 v1.8 開始，Kubernetes 支持配置 Mount 傳遞（mountPropagation）。它支持兩種選項

- HostToContainer：這是開啟 `MountPropagation=true` 時的默認模式，等效於 `rslave` 模式，即容器可以看到 Host 上面在該 volume 內的任何新 Mount 操作
- Bidirectional：等效於 `rshared` 模式，即 Host 和容器都可以看到對方在該 Volume 內的任何新 Mount 操作。該模式要求容器必須運行在特權模式（即 `securityContext.privileged=true`）

注意：

- 使用 Mount 傳遞需要開啟 `--feature-gates=MountPropagation=true`
- `rslave` 和 `rshared` 的說明可以參考 [內核文檔](https://www.kernel.org/doc/Documentation/filesystems/sharedsubtree.txt)

## Volume 快照

v1.8 新增了 pre-alpha 版本的 Volume 快照，但還只是一個雛形，並且其實現不在 Kubernetes 核心代碼中，而是存放在 [kubernetes-incubator/external-storage](https://github.com/kubernetes-incubator/external-storage/tree/master/snapshot) 中。

> TODO:  補充 Volume 快照的設計原理和示例。

## Windows Volume

Windows 容器暫時只支持 local、emptyDir、hostPath、AzureDisk、AzureFile 以及 flexvolume。注意 Volume 的路徑格式需要為 `mountPath: "C:\\etc\\foo"` 或者 `mountPath: "C:/etc/foo"`。

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

## 掛載傳播

[掛載傳播（MountPropagation）](https://www.kernel.org/doc/Documentation/filesystems/sharedsubtree.txt)是 v1.9 引入的新功能，並在 v1.10 中升級為 Beta 版本。掛載傳播用來解決同一個 Volume 在不同的容器甚至是 Pod 之間掛載的問題。通過設置 `Container.volumeMounts.mountPropagation），可以為該存儲卷設置不同的傳播類型。

支持三種選項：

- None：即私有掛載（private）
- HostToContainer：即 Host 內在該目錄中的新掛載都可以在容器中看到，等價於 Linux 內核的 rslave。
- Bidirectional：即 Host 內在該目錄中的新掛載都可以在容器中看到，同樣容器內在該目錄中的任何新掛載也都可以在 Host 中看到，等價於 Linux 內核的 rshared。僅特權容器（privileged）可以使用 Bidirectional 類型。

注意：

- 使用前需要開啟 MountPropagation 特性
- 如未設置，則 v1.9 和 v1.10 中默認為私有掛載（`None`），而 v1.11 中默認為 `HostToContainer`
- Docker 服務的 systemd 配置文件中需要設置 `MountFlags=shared`

## 其他的 Volume 參考示例

https://github.com/kubernetes/examples/tree/master/staging/volumes/iscsi

- [iSCSI Volume 示例](https://github.com/kubernetes/examples/tree/master/staging/volumes/iscsi)
- [cephfs Volume 示例](https://github.com/kubernetes/examples/tree/master/staging/volumes/cephfs)
- [Flocker Volume 示例](https://github.com/kubernetes/examples/tree/master/staging/volumes/flocker)
- [GlusterFS Volume 示例](https://github.com/kubernetes/examples/tree/master/staging/volumes/glusterfs)
- [RBD Volume 示例](https://github.com/kubernetes/examples/tree/master/staging/volumes/rbd)
- [Secret Volume 示例](secret.md)
- [downwardAPI Volume 示例](https://kubernetes.io/docs/tasks/inject-data-application/downward-api-volume-expose-pod-information/)
- [AzureFile Volume 示例](https://github.com/kubernetes/examples/tree/master/staging/volumes/azure_file)
- [AzureDisk Volume 示例](https://github.com/kubernetes/examples/tree/master/staging/volumes/azure_disk)
- [Quobyte Volume 示例](https://github.com/kubernetes/examples/tree/master/staging/volumes/quobyte)
- [Portworx Volume 示例](https://github.com/kubernetes/examples/tree/master/staging/volumes/portworx)
- [ScaleIO Volume 示例](https://github.com/kubernetes/examples/tree/master/staging/volumes/scaleio)
- [StorageOS Volume 示例](https://github.com/kubernetes/examples/tree/master/staging/volumes/storageos)
