# PersistentVolume

PersistentVolume (PV) and PersistentVolumeClaim (PVC) offer a handy tool to manage persistent volumes: PV provides network storage resources, and PVC requests these resources. As such, setting a persistent workflow involves configuring the underlying file system or cloud data volume, creating a persistent data volume, and then creating a PVC to link your Pods with the data volume. With PV and PVC, Pods and data volumes can be decoupled, meaning that Pods don't need to know the exact file system or the persistent engine that supports them.

## Volume Lifecycle 

The lifecycle of a volume goes through five stages:

1. Provisioning - the creation of PVs, can be done directly (statically) or dynamically using a StorageClass.
2. Binding - Assigning PVs to PVCs
3. Using - Pods can use the volume via the PVC, and stop the deletion of a PVC that is in use via the admission control of StorageObjectInUseProtection (PVCProtection for versions 1.9 and earlier).
4. Releasing - Pods release the volume and delete the PVC
5. Reclaiming - The PV is retrieved. It can be retained for future use, or it can be directly deleted from the cloud storage. Finally, both the PV and the backend storage are deleted.

Based on these 5 stages, we have four volume statuses:
* Available
* Bound
* Released  (PVC unbound, but reclaim policy not yet executed)
* Failed

## API Version Comparison Chart

|Kubernetes Version| PV / PVC Version | StorageClass Version |
| :--- | :--- | :--- |
| v1.5-v1.6 | core/v1 | storage.k8s.io/v1beta1 |
| v1.7+ | core/v1 | storage.k8s.io/v1 |

## PV

A PersistentVolume (PV) is a piece of network storage residing within the cluster. Similar to a Node, it's a resource of the cluster. PV shares similarities with Volume but has a lifecycle that's independent of Pods. Let's take the example of an NFS-based PV:

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

## StorageClass

In the existence of many volumes, creating an NFS Volume manually is not very convenient. Kubernetes also provides a [StorageClass](https://kubernetes.io/docs/user-guide/persistent-volumes/#storageclasses) to dynamically create PVs, saving administrators time and encapsulating different types of storage for PVCs to select.

## PVC

While PV is a storage resource, a PersistentVolumeClaim (PVC) is a request for a PV. PVCs are like Pods: Pods consume Node resources and PVCs consume PV resources. They can request specific storage sizes and access modes, just as Pods can request CPU and memory resources.

## Expanding PV Space

Starting from v1.8, Kubernetes supports expanding PV space. It allows you to expand the size of a PV without losing data or restarting containers. Please note that the current implementation only supports PVs that don't need to adjust the file system size and supports a few storage types.

## Block Storage (Raw Block Volume)

Starting from v1.9, Kubernetes has added a new Raw Block Volume feature. Raw Block Volume enables raw block devices to be used as K8s volumes. Note that before you use this feature, you need to enable the BlockVolume feature for kube-apiserver, kube-controller-manager, and kubelet.

## StorageObjectInUseProtection

Starting from v1.11, when you enable the admission control StorageObjectInUseProtection, PVs and PVCs that are in use will not be deleted immediately after the delete command is issued. Instead, they'll go through a graceful termination process once the users delete the objects.

More detailed information can be found in the reference section below.

## Reference Documentation

[Kubernetes Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
[Kubernetes Storage Classes](https://kubernetes.io/docs/concepts/storage/storage-classes/)
[Dynamic Volume Provisioning](https://kubernetes.io/docs/concepts/storage/dynamic-provisioning/)
[Kubernetes CSI Documentation](https://kubernetes-csi.github.io/docs/)
[Volume Snapshots Documentation](https://kubernetes.io/docs/concepts/storage/volume-snapshots/)