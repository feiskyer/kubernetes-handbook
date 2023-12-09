# Volumes: The Secret Lifeline of Docker and Kubernetes

Just as we know that our apps and data aren't destined to last forever, in the Docker universe, the lifecycle of container data is fundamentally ephemeral. Once a container bites the dust, so does its data. Recognizing the importance of data permanence, Docker created a clever system called 'Volumes' to persist container data.

Similarly, Kubernetes has embraced and even improved upon Docker's concept, offering its own robust version of volumes. Kubernetes volumes, accompanied by a plethora of plugins, help tremendously in ensuring data permanence and sharing data between containers.

However, a critical distinction lies between Docker and Kubernetes volumes. Unlike Docker, Kubernetes volumes are intrinsically tied to the lifecycle of a pod.

* Regardless of whether a container is brought back from the verge of oblivion by Kubelet, the volume's data will always remain unharmed.
* It's only when a Pod is deleted that the volume is cleaned up. Whether the data is also deleted depends on the type of volume being used. For an emptyDir volume, the data gets lost, but for a Persistent Volume (PV), it's preserved.

## Different Flavors of Kubernetes Volumes

As of now, Kubernetes offers the following types of volumes:

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

Remember, not all volume types are 'persistent'. For instance, emptyDir, secret, gitRepo volumes disppear along with the pod.

## API Version Compatibility Chart

| Kubernetes Version | Core API Version |
| :--- | :--- |
| v1.5+ | core/v1 |

## Getting into the Nuances of Different Volume Types

### emptyDir

When a Pod is assigned an emptyDir type volume, the emptyDir is created as soon as the Pod is scheduled on the node. As long as the Pod runs on the node, the emptyDir remains. However, if the Pod is removed from the node, the emptyDir is also removed, causing the data to be lost permanently.

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

### hostPath

The hostPath volume allows mounting of the node's filesystem within the pod – perfectly suited when a pod needs to use files on the node.

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

### NFS

Short for Network File System, NFS provides a way to easily mount its system to a Pod in Kubernetes. Notably, NFS ensures permanent data storage and supports concurrent write operations.

```yaml
volumes:
- name: nfs
  nfs:
    # FIXME: use the right hostname
    server: 10.254.234.223
    path: "/"
```

[...]

For the details and examples of all the other volume types, please visit the Kubernetes examples page at [https://github.com/kubernetes/examples/tree/master/staging/volumes/].

## The Art of Volume Snapshotting

Although in a pre-alpha state, the concept of volume snapshots was introduced to Kubernetes in version 1.8. However, its implementation is not in the core Kubernetes but rests in [kubernetes-incubator/external-storage](https://github.com/kubernetes-incubator/external-storage/tree/master/snapshot).

> Stay tuned for a detailed discussion and examples of volume snapshotting on our upcoming posts!

## Volume Mount Propagation

Introduced with version v1.9, Mount Propagation is quickly scaling its way through the beta version in Kubernetes v1.10. Mount Propagation is used to handle the mounting issues of the same volume across different containers or even Pods. By adjusting the `Container.volumeMounts.mountPropagation` setting, you can assign different types of propagation to the volume.

It provides three options:

* None: private mount
* HostToContainer: Where new mounts made inside the host directory are visible inside the container, equivalent to Linux kernel's rslave.
* Bidirectional: Where new mounts made inside the host or container's directory are visible in the opposite party, equivalent to Linux kernel's rshared. The privileged containers can only use the bi-directional type.

Note:

* The enabling of the Mount Propagation feature is required first.
* If not set, the default is 'private' for v1.9 and v1.10, whereas for v1.11, it defaults to 'HostToContainer'.
* Docker's systemd configuration file must be set to `MountFlags=shared`.

## Byte-Sized Guides to Other Volume Types

* [iSCSI Volume Example](https://github.com/kubernetes/examples/tree/master/staging/volumes/iscsi)
* [cephfs Volume Example](https://github.com/kubernetes/examples/tree/master/staging/volumes/cephfs)
* [Flocker Volume Example](https://github.com/kubernetes/examples/tree/master/staging/volumes/flocker)
* [GlusterFS Volume Example](https://github.com/kubernetes/examples/tree/master/staging/volumes/glusterfs)
* [RBD Volume Example](https://github.com/kubernetes/examples/tree/master/staging/volumes/rbd)
* [Secret Volume Example](secret.md)
* [downwardAPI Volume Example](https://kubernetes.io/docs/tasks/inject-data-application/downward-api-volume-expose-pod-information/)
* [AzureFile Volume Example](https://github.com/kubernetes/examples/tree/master/staging/volumes/azure_file)
* [AzureDisk Volume Example](https://github.com/kubernetes/examples/tree/master/staging/volumes/azure_disk)
* [Quobyte Volume Example](https://github.com/kubernetes/examples/tree/master/staging/volumes/quobyte)
* [Portworx Volume Example](https://github.com/kubernetes/examples/tree/master/staging/volumes/portworx)
* [ScaleIO Volume Example](https://github.com/kubernetes/examples/tree/master/staging/volumes/scaleio)
* [StorageOS Volume Example](https://github.com/kubernetes/examples/tree/master/staging/volumes/storageos)