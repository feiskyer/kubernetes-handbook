# 本地數據卷

> 注意：僅在 v1.7 + 中支持，並從 v1.10 開始升級為 beta 版本。

本地數據卷（Local Volume）代表一個本地存儲設備，比如磁盤、分區或者目錄等。主要的應用場景包括分佈式存儲和數據庫等需要高性能和高可靠性的環境裡。本地數據卷同時支持塊設備和文件系統，通過 `spec.local.path` 指定；但對於文件系統來說，kubernetes 並不會限制該目錄可以使用的存儲空間大小。

本地數據卷只能以靜態創建的 PV 使用。相對於 [HostPath](volume.md#hostPath)，本地數據卷可以直接以持久化的方式使用（它總是通過 NodeAffinity 調度在某個指定的節點上）。

另外，社區還提供了一個 [local-volume-provisioner](https://github.com/kubernetes-incubator/external-storage/tree/master/local-volume/provisioner)，用於自動創建和清理本地數據卷。

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

創建一個調度到 hostname 為 `example-node` 的本地數據卷：

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

創建 PVC：

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

創建 Pod，引用 PVC：

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

- 暫不支持一個 Pod 綁定多個本地數據卷的 PVC（計劃 v1.9 支持）
- 有可能導致調度衝突，比如 CPU 或者內存資源不足（計劃 v1.9 增強）
- 外部 Provisoner 在啟動後無法正確檢測掛載點的空間大小（需要 Mount Propagation，計劃 v1.9 支持）

## 最佳實踐

- 推薦為每個存儲卷分配獨立的磁盤，以便隔離 IO 請求
- 推薦為每個存儲卷分配獨立的分區，以便隔離存儲空間
- 避免重新創建同名的 Node，否則會導致新 Node 無法識別已綁定舊 Node 的 PV
- 推薦使用 UUID 而不是文件路徑，以避免文件路徑誤配的問題
- 對於不帶文件系統的塊存儲，推薦使用唯一 ID（如 `/dev/disk/by-id/`），以避免塊設備路徑誤配的問題

## 參考文檔

- [Local Persistent Storage User Guide](https://github.com/kubernetes-incubator/external-storage/tree/master/local-volume)