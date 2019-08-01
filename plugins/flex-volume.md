# FlexVolume

FlexVolume 是 Kubernetes v1.8+ 支持的一種存儲插件擴展方式。類似於 CNI 插件，它需要外部插件將二進制文件放到預先配置的路徑中（如 `/usr/libexec/kubernetes/kubelet-plugins/volume/exec/`），並需要在系統中安裝好所有需要的依賴。

> 對於新的存儲插件，推薦基於 [CSI](csi.md) 構建。

## FlexVolume 接口

實現一個 FlexVolume 包括兩個步驟

- 實現 [FlexVolume 插件接口](https://github.com/kubernetes/community/blob/master/contributors/devel/flexvolume.md)，包括 `init/attach/detach/waitforattach/isattached/mountdevice/unmountdevice/mount/umount` 等命令（可參考 [lvm 示例](https://github.com/kubernetes/examples/blob/master/staging/volumes/flexvolume/lvm) 和 [NFS 示例](https://github.com/kubernetes/examples/blob/master/staging/volumes/flexvolume/nfs)）
- 將插件放到 `/usr/libexec/kubernetes/kubelet-plugins/volume/exec/<vendor~driver>/<driver>` 目錄中

FlexVolume 的接口包括

- init：kubelet/kube-controller-manager 初始化存儲插件時調用，插件需要返回是否需要要 `attach` 和 `detach` 操作
- attach：將存儲卷掛載到 Node 上
- detach：將存儲卷從 Node 上卸載
- waitforattach： 等待 attach 操作成功（超時時間為 10 分鐘）
- isattached：檢查存儲卷是否已經掛載
- mountdevice：將設備掛載到指定目錄中以便後續 bind mount 使用
- unmountdevice：將設備取消掛載
- mount：將存儲卷掛載到指定目錄中
- umount：將存儲卷取消掛載

而存儲驅動在實現這些接口時需要以 JSON 格式返回數據，數據格式為

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

在使用 flexVolume 時，需要指定卷的 driver，格式為 `<vendor~driver>/<driver>`，如下面的例子使用了 `kubernetes.io/lvm`

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

- 在 v1.7 版本，部署新的 FlevVolume 插件後需要重啟 kubelet 和 kube-controller-manager；
- 而從 v1.8 開始不需要重啟它們了。
