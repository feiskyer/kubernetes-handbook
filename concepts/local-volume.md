# 本地数据卷

> 注意：仅在v1.7+中支持，目前为alpha版。

本地数据卷（Local Volume）代表一个本地存储设备，比如磁盘、分区或者目录等。主要的应用场景包括分布式存储和数据库等需要高性能和高可靠性的环境里。本地数据卷同时支持块设备和文件系统，通过`spec.local.path`指定；但对于文件系统来说，kubernetes并不会限制该目录可以使用的存储空间大小。

本地数据卷只能以静态创建的PV使用。相对于[HostPath](volume.md#hostPath)，本地数据卷可以直接以持久化的方式使用（它总是通过NodeAffinity调度在某个指定的节点上）。

另外，社区还提供了一个[local-volume-provisioner](https://github.com/kubernetes-incubator/external-storage/tree/master/local-volume/provisioner)，用于自动创建和清理本地数据卷。

## 示例

创建一个调度到hostname为`example-node`的本地数据卷：

```yaml
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

创建PVC：

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

创建Pod，引用PVC：

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



