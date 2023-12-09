# LocalVolume: Storing Your Data on Local Drives

> Heads-up: This feature is only supported in v1.7 and onwards, and was upgraded to beta in v1.10.

LocalVolume is your bridge to local storage devices - be it a disk, partition, or even a humble directory. It's most at home in high-performance, high-reliability environments like distributed storage and databases. It can work smoothly with both block devices and file systems, and you can point it to the right place using `spec.local.path`. Don't sweat about space restrictions for file systems; Kubernetes won't impose any limits.

However, LocalVolumes can only play with statically provisioned Persistent Volumes (PVs). Compared to [HostPath](volume.md#hostPath), these data volumes are always available for use, since they always land on a specified node thanks to NodeAffinity.

Community developers have also crafted a [local-volume-provisioner](https://github.com/kubernetes-incubator/external-storage/tree/master/local-volume/provisioner), for automating the creation and cleanup of local data volumes.

## Example

Below is a StorageClass:

```yaml
kind: StorageClass
apiVersion: storage.k8s.io/v1
metadata:
  name: local-storage
provisioner: kubernetes.io/no-provisioner
volumeBindingMode: WaitForFirstConsumer
```

And here's how you create a local data volume on a hostname named `example-node`:

```yaml
# For Kubernetes v1.10
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
# For Kubernetes v1.7-1.9
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
  - AccessModeReadWriteOnce
  persistentVolumeReclaimPolicy: Delete
  storageClassName: local-storage
  local:
    path: /mnt/disks/ssd1
```

Creation of PVC:

```yaml
kind: PersistentVolumeClaim
apiVersion: v1
metadata:
  name: example-local-claim
spec:
  accessModes:
  - AccessModeReadWriteOnce
  resources:
    requests:
      storage: 5Gi
  storageClassName: local-storage
```

Pod creation, referencing PVC:

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
## Limitations

* As of the moment, you can't bind multiple PVCs of local data volumes to one Pod (but it's on the to-do list for v1.9).
* Scheduling conflicts might happen, especially when there's a shortage of CPU or memory resources (v1.9 aims to tackle this).
* The external Provisioner has some trouble detecting the size of a mount point right after starting up (the v1.9 update is expected to bring Mount Propagation feature to solve this).

## Best Practices

* For optimal IO isolation, consider allocating a separate disk for each storage volume.
* It's advisable to allocate separate partitions for each storage volume to isolate storage space.
* Avoid creating Nodes under the same name to prevent new Nodes from identifying PVs already bound to the old Nodes.
* Instead of file paths, it's recommended to use UUIDs to eliminate mismatch issues.
* For block storage without file systems, opt for unique IDs, like `/dev/disk/by-id/`, to circumvent block device path mismatch problems.

## Additional Readings

* For a more in-depth look, check out the [Local Persistent Storage User Guide](https://github.com/kubernetes-incubator/external-storage/tree/master/local-volume).
