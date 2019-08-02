# FlexVolume

FlexVolume 是 Kubernetes v1.8+ 支持的一种存储插件扩展方式。类似于 CNI 插件，它需要外部插件将二进制文件放到预先配置的路径中（如 `/usr/libexec/kubernetes/kubelet-plugins/volume/exec/`），并需要在系统中安装好所有需要的依赖。

> 对于新的存储插件，推荐基于 [CSI](csi.md) 构建。

## FlexVolume 接口

实现一个 FlexVolume 包括两个步骤

- 实现 [FlexVolume 插件接口](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-storage/flexvolume.md)，包括 `init/attach/detach/waitforattach/isattached/mountdevice/unmountdevice/mount/umount` 等命令（可参考 [lvm 示例](https://github.com/kubernetes/examples/blob/master/staging/volumes/flexvolume/lvm) 和 [NFS 示例](https://github.com/kubernetes/examples/blob/master/staging/volumes/flexvolume/nfs)）
- 将插件放到 `/usr/libexec/kubernetes/kubelet-plugins/volume/exec/<vendor~driver>/<driver>` 目录中

FlexVolume 的接口包括

- init：kubelet/kube-controller-manager 初始化存储插件时调用，插件需要返回是否需要要 `attach` 和 `detach` 操作
- attach：将存储卷挂载到 Node 上
- detach：将存储卷从 Node 上卸载
- waitforattach： 等待 attach 操作成功（超时时间为 10 分钟）
- isattached：检查存储卷是否已经挂载
- mountdevice：将设备挂载到指定目录中以便后续 bind mount 使用
- unmountdevice：将设备取消挂载
- mount：将存储卷挂载到指定目录中
- umount：将存储卷取消挂载

而存储驱动在实现这些接口时需要以 JSON 格式返回数据，数据格式为

```json
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

## 使用 FlexVolume

在使用 flexVolume 时，需要指定卷的 driver，格式为 `<vendor~driver>/<driver>`，如下面的例子使用了 `kubernetes.io/lvm`

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

注意：

- 在 v1.7 版本，部署新的 FlevVolume 插件后需要重启 kubelet 和 kube-controller-manager；
- 而从 v1.8 开始不需要重启它们了。
