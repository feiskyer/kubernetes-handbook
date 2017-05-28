# Volume插件扩展

Kubernetes已经提供丰富的[Volume](../architecture/volume.md)和[Persistent Volume](../architecture/persistent-volume.md)插件，可以根据需要使用这些插件给容器提供持久化存储。

如果内置的这些Volume还不满足要求，则可以使用FlexVolume实现自己的Volume插件。

## FlexVolume

实现一个FlexVolume包括两个步骤

- 实现[FlexVolume插件接口](https://github.com/kubernetes/community/blob/master/contributors/devel/flexvolume.md)，包括`init/attach/detach/mount/umount`等命令（可参考[lvm示例](https://github.com/kubernetes/kubernetes/tree/master/examples/volumes/flexvolume)和[NFS示例](https://github.com/kubernetes/kubernetes/blob/master/examples/volumes/flexvolume/nfs)）
- 将插件放到`/usr/libexec/kubernetes/kubelet-plugins/volume/exec/<vendor~driver>/<driver>`目录中

而在使用flexVolume时，需要指定卷的driver，格式为`<vendor~driver>/<driver>`，如下面的例子使用了`kubernetes.io/lvm`

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
