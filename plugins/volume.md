# 存儲插件

Kubernetes 已經提供豐富的 [Volume](../concepts/volume.md) 和 [Persistent Volume](../concepts/persistent-volume.md) 插件，可以根據需要使用這些插件給容器提供持久化存儲。

如果內置的這些 Volume 還不滿足要求，則可以使用 [FlexVolume](flex-volume.md) 或者 [容器存儲接口 CSI](csi.md) 實現自己的 Volume 插件。
