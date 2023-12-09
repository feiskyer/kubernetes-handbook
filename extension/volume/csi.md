# Unveiling the Container Storage Interface (CSI)

The Container Storage Interface (CSI) first made its appearance in Kubernetes v1.9 and reached General Availability (GA) in version v1.13. CSI is not just tethered to Kubernetes—it's a universal storage interface for the container ecosystem, compatible with other container orchestration systems like Mesos and Cloud Foundry.

**Version information**

| Kubernetes | CSI Spec | Status |
| :--- | :--- | :--- |
| v1.9 | v0.1.0 | Alpha |
| v1.10 | v0.2.0 | Beta |
| v1.11-v1.12 | v0.3.0 | Beta |
| v1.13 | [v0.3.0](https://github.com/container-storage-interface/spec/releases/tag/v0.3.0), [v1.0.0](https://github.com/container-storage-interface/spec/releases/tag/v1.0.0) | GA |

Sidecar container versions

| Container Name | Description | CSI spec | Latest Release Tag |
| :--- | :--- | :--- | :--- |
| external-provisioner | Watch PVC and create PV | v1.0.0 | v1.0.1 |
| external-attacher | Operate VolumeAttachment | v1.0.0 | v1.0.1 |
| external-snapshotter | Operate VolumeSnapshot | v1.0.0 | v1.0.1 |
| node-driver-registrar | Register kubelet plugin | v1.0.0 | v1.0.2 |
| cluster-driver-registrar | Register [CSIDriver Object](https://kubernetes-csi.github.io/docs/csi-driver-object.html) | v1.0.0 | v1.0.1 |
| livenessprobe | Monitors health of CSI driver | v1.0.0 | v1.0.2 |

## The Principles

Similar to CRI, CSI is implemented based on gRPC. The detailed CSI SPEC can be referred to [here](https://github.com/container-storage-interface/spec/blob/master/spec.md). It requires plugin developers to implement three gRPC services:

* **Identity Service**: For Kubernetes to coordinate version information with CSI plugin
* **Controller Service**: For creating, deleting, and managing Volume storage
* **Node Service**: For mounting the Volume storage to a specified directory for Kubelet to use when creating containers (must listen on `/var/lib/kubelet/plugins/[SanitizedCSIDriverName]/csi.sock`)

Since CSI listens on a Unix socket file, kube-controller-manager can't directly call the CSI plugin. To manage the lifecycle of Volumes and to simplify the development of CSI plugins for developers, Kubernetes provides several sidecar containers and recommends deploying CSI plugins using the following method:

![Recommended CSI Deployment Diagram](../../.gitbook/assets/container-storage-interface_diagram1%20%282%29.png)

This deployment method includes:

* StatefulSet: Ensuring only one instance is running with a replica number of 1, it contains three containers:
  * The CSI plugin implemented by the user
  * [External Attacher](https://github.com/kubernetes-csi/external-attacher): A sidecar container provided by Kubernetes. It listens for changes in _VolumeAttachment_ and _PersistentVolume_ objects and calls the CSI plugin's ControllerPublishVolume and ControllerUnpublishVolume APIs to mount or unmount the Volume to the specified Node.
  * [External Provisioner](https://github.com/kubernetes-csi/external-provisioner): A sidecar container provided by Kubernetes. It listens for changes in _PersistentVolumeClaim_ objects and calls APIs like _ControllerPublish_ and _ControllerUnpublish_ of the CSI plugin to manage Volumes.
* Daemonset: Runs the CSI plugin on every Node so that Kubelet can call it. It contains 2 containers:
  * The CSI plugin implemented by the user
  * [Driver Registrar](https://github.com/kubernetes-csi/driver-registrar): Registers the CSI plugin with kubelet and initiates the _NodeId_ (i.e., adds an Annotation `csi.volume.kubernetes.io/nodeid` to the Node object)

## Configuration

* API Server configuration:

```bash
--allow-privileged=true
--feature-gates=CSIPersistentVolume=true,MountPropagation=true
--runtime-config=storage.k8s.io/v1alpha1=true
```

* Controller-manager configuration:

```bash
--feature-gates=CSIPersistentVolume=true
```

* Kubelet configuration:

```bash
--allow-privileged=true
--feature-gates=CSIPersistentVolume=true,MountPropagation=true
```

### Example

Kubernetes provides several [CSI examples](https://github.com/kubernetes-csi/drivers), including NFS, iSCSI, HostPath, Cinder, and FlexAdapter, among others. These examples can be used as references when creating a CSI plugin.

| Name | Status | More Information |
| :--- | :--- | :--- |
| [Cinder](https://github.com/kubernetes/cloud-provider-openstack/tree/master/pkg/csi/cinder) | v0.2.0 | A Container Storage Interface \(CSI\) Storage Plug-in for Cinder |
... and more

Let's look at the usage of a CSI plugin, using NFS as an example.

First, you need to deploy the NFS plugin:

```bash
git clone https://github.com/kubernetes-csi/drivers
cd drivers/pkg/nfs
kubectl create -f deploy/kubernetes
```

Then create a container using an NFS storage volume:

```bash
kubectl create -f examples/kubernetes/nginx.yaml
```

The example directly creates a PV to use NFS:

```yaml
apiVersion: v1
kind: PersistentVolume
...
```

You can also use it with StorageClass:

```yaml
kind: StorageClass
...
```

## Reference Documents

* [Kubernetes CSI Documentation](https://kubernetes-csi.github.io/docs/)
* [CSI Volume Plugins in Kubernetes Design Doc](https://github.com/kubernetes/community/blob/master/contributors/design-proposals/storage/container-storage-interface.md#recommended-mechanism-for-deploying-csi-drivers-on-kubernetes)