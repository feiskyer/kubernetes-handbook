# FlexVolume: Enabling Advanced Storage in Kubernetes

FlexVolume is an extension mechanism for storage plugins supported by Kubernetes v1.8 and later. Similar to CNI plugins, it requires external plugins to place binary files in a pre-configured path (such as `/usr/libexec/kubernetes/kubelet-plugins/volume/exec/`), and all necessary dependencies must be installed on the system.

> For new storage plugins, it is recommended to build based on [CSI](csi.md).

## FlexVolume Interface

Creating a FlexVolume involves two steps:

- Implementing the [FlexVolume plugin interface](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-storage/flexvolume.md), which includes commands such as `init/attach/detach/waitforattach/isattached/mountdevice/unmountdevice/mount/umount` (see [LVM example](https://github.com/kubernetes/examples/blob/master/staging/volumes/flexvolume/lvm) and [NFS example](https://github.com/kubernetes/examples/blob/master/staging/volumes/flexvolume/nfs))
- Placing the plugin in the `/usr/libexec/kubernetes/kubelet-plugins/volume/exec/<vendor~driver>/<driver>` directory

The FlexVolume interface includes:

- `init`: Called by kubelet/kube-controller-manager when initializing the storage plugin. The plugin needs to return whether `attach` and `detach` operations are necessary.
- `attach`: Mounts the storage volume to the Node.
- `detach`: Unmounts the storage volume from the Node.
- `waitforattach`: Waits for the `attach` operation to succeed (timeout is 10 minutes).
- `isattached`: Checks if the storage volume is mounted.
- `mountdevice`: Mounts the device to a specific directory for subsequent bind mounting.
- `unmountdevice`: Unmounts the device.
- `mount`: Mounts the storage volume to a specific directory.
- `umount`: Unmounts the storage volume.

When storage drivers implement these interfaces, they need to return data in JSON format. The data format is as follows:

```javascript
{
  "status": "<Success/Failure/Not supported>",
  "message": "<Reason for success/failure>",
  "device": "<Path to the device attached. This field is valid only for attach & waitforattach call-outs>",
  "volumeName": "<Cluster wide unique name of the volume. Valid only for getvolumename call-out>",
  "attached": "<True/False (Return true if volume is attached on the node. Valid only for isattached call-out)>",
    "capabilities":
    {
        "attach": "<True/False (Return true if the driver implements attach and detach)>"
    }
}
```

## Utilizing FlexVolume

When using FlexVolume, you need to specify the volume's driver in the format `<vendor~driver>/<driver>`, as in the example below using `kubernetes.io/lvm`:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
  namespace: default
spec:
  containers:
  - name: nginx
    image: nginx
    volumeMounts:
    - name: test
      mountPath: /data
    ports:
    - containerPort: 80
  volumes:
  - name: test
    flexVolume:
      driver: "kubernetes.io/lvm"
      fsType: "ext4"
      options:
        volumeID: "vol1"
        size: "1000m"
        volumegroup: "kube_vg"
```

Note:

- In version v1.7, deploying a new FlexVolume plugin required restarting kubelet and kube-controller-manager.
- Starting from v1.8, restarting them is no longer necessary.

**Rephrased version:**

# FlexVolume: Expanding Storage Possibilities in Kubernetes

FlexVolume is a storage plugin extension method supported by Kubernetes starting from version 1.8. In a manner akin to CNI plugins, it leverages external plugins that add binary files to an established path (e.g., `/usr/libexec/kubernetes/kubelet-plugins/volume/exec/`). Prior installation of all essential dependencies is a must.

> It's advised for newcomers to storage plugin creation to use [CSI](csi.md) as their building block.

## The FlexVolume Blueprint

To spin up a FlexVolume, you'll need to:

- Forge the [FlexVolume plugin interface](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-storage/flexvolume.md), which involves sequences like `init/attach/detach/waitforattach/isattached/mountdevice/unmountdevice/mount/umount` (check out the [LVM example](https://github.com/kubernetes/examples/blob/master/staging/volumes/flexvolume/lvm) or the [NFS example](https://github.com/kubernetes/examples/blob/master/staging/volumes/flexvolume/nfs))
- Plant the plugin firmly in the `/usr/libexec/kubernetes/kubelet-plugins/volume/exec/<vendor~driver>/<driver>` garden

FlexVolume's interface boasts features such as:

- 'init': Springs into action when the kubelet or kube-controller-manager is getting the storage plugin up to speed. It determines if 'attach' and 'detach' are on the day's agenda.
- 'attach': Latches the storage volume onto the Node.
- 'detach': Peels the storage volume off the Node.
- 'waitforattach': Plays the waiting game for 'attach' to triumph (10-minute countdown).
- 'isattached': Plays detective, sleuthing if the storage volume is indeed attached.
- 'mountdevice': Transforms a specific directory to accommodate the device pre-bind mount.
- 'unmountdevice': Revers the mounting spell.
- 'mount': Sets up camp for the storage volume in its designated directory.
- 'umount': Breaks camp and leaves no trace.

Storage drivers that are up to the challenge of these interfaces should send back their stories in JSON format, something like this:

```javascript
{
  "status": "<Success/Failure/Not supported>",
  "message": "<Reason for success/failure>",
  "device": "<Path to the device attached. Saves only for times of attach & waitforattach excitement>",
  "volumeName": "<Unique name of the volume across the whole cluster. Only chimes in for getvolumename moments>",
  "attached": "<True/False (A true here confirms the volume’s hitched on the node. Only rings true for isattached checks)>",
    "capabilities":
    {
        "attach": "<True/False (A true suggests the driver can handle both attach and detach)>"
    }
}
```

## FlexVolume in Action

To get FlexVolume rolling, pin down the driver's identity in `<vendor~driver>/<driver>` fashion. Here's how you do it, demonstrated by the `kubernetes.io/lvm` case:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
  namespace: default
spec:
  containers:
  - name: nginx
    image: nginx
    volumeMounts:
    - name: test
      mountPath: /data
    ports:
    - containerPort: 80
  volumes:
  - name: test
    flexVolume:
      driver: "kubernetes.io/lvm"
      fsType: "ext4"
      options:
        volumeID: "vol1"
        size: "1000m"
        volumegroup: "kube_vg"
```

Things to bear in mind:

- With v1.7, welcoming a new FlexVolume plugin into the fold meant restarting the kubelet and kube-controller-manager.
- Come v1.8, this reboot ritual is a thing of the past.