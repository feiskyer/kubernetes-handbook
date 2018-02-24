# 本地数据卷

> 注意：仅在 v1.7 + 中支持，并从 v1.10 开始升级为 beta 版本。

本地数据卷（Local Volume）代表一个本地存储设备，比如磁盘、分区或者目录等。主要的应用场景包括分布式存储和数据库等需要高性能和高可靠性的环境里。本地数据卷同时支持块设备和文件系统，通过 `spec.local.path` 指定；但对于文件系统来说，kubernetes 并不会限制该目录可以使用的存储空间大小。

本地数据卷只能以静态创建的 PV 使用。相对于 [HostPath](volume.md#hostPath)，本地数据卷可以直接以持久化的方式使用（它总是通过 NodeAffinity 调度在某个指定的节点上）。

另外，社区还提供了一个 [local-volume-provisioner](https://github.com/kubernetes-incubator/external-storage/tree/master/local-volume/provisioner)，用于自动创建和清理本地数据卷。

## 示例

StorageClass

```yaml
kind: StorageClass
apiVersion: storage.k8s.io/v1
metadata:
  name: local-storage
provisioner: kubernetes.io/no-provisioner
volumeBindingMode: WaitForFirstConsumer
```

创建一个调度到 hostname 为 `example-node` 的本地数据卷：

```yaml
# For kubernetes v1.10
apiVersion: v1
kind: PersistentVolume
metadata:
  name: example-local-pv
spec:
  capacity:
    storage: 100Gi
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
```

```yaml
# For kubernetes v1.7-1.9
apiVersion: v1
kind: PersistentVolume
metadata:
  name: example-local-pv
  annotations:
    "volume.alpha.kubernetes.io/node-affinity": '{
      "requiredDuringSchedulingIgnoredDuringExecution": {
        "nodeSelectorTerms": [
          { "matchExpressions": [
            { "key": "kubernetes.io/hostname",
              "operator": "In",
              "values": ["example-node"]
            }
          ]}
         ]}
        }',
spec:
  capacity:
    storage: 5Gi
  accessModes:
  - ReadWriteOnce
  persistentVolumeReclaimPolicy: Delete
  storageClassName: local-storage
  local:
    path: /mnt/disks/ssd1
```

创建 PVC：

```yaml
kind: PersistentVolumeClaim
apiVersion: v1
metadata:
  name: example-local-claim
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi
  storageClassName: local-storage
```

创建 Pod，引用 PVC：

```yaml
kind: Pod
apiVersion: v1
metadata:
  name: mypod
spec:
  containers:
    - name: myfrontend
      image: nginx
      volumeMounts:
      - mountPath: "/var/www/html"
        name: mypd
  volumes:
    - name: mypd
      persistentVolumeClaim:
        claimName: example-local-claim
```

## 限制

- 暂不支持一个 Pod 绑定多个本地数据卷的 PVC（计划 v1.9 支持）
- 有可能导致调度冲突，比如 CPU 或者内存资源不足（计划 v1.9 增强）
- 外部 Provisoner 在启动后无法正确检测挂载点的空间大小（需要 Mount Propagation，计划 v1.9 支持）

## 最佳实践

- 推荐为每个存储卷分配独立的磁盘，以便隔离 IO 请求
- 推荐为每个存储卷分配独立的分区，以便隔离存储空间
- 避免重新创建同名的 Node，否则会导致新 Node 无法识别已绑定旧 Node 的 PV
- 推荐使用 UUID 而不是文件路径，以避免文件路径误配的问题
- 对于不带文件系统的块存储，推荐使用唯一 ID（如 `/dev/disk/by-id/`），以避免块设备路径误配的问题

## 参考文档

- [Local Persistent Storage User Guide](https://github.com/kubernetes-incubator/external-storage/tree/master/local-volume)