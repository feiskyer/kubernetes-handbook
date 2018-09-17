# 存储插件

Kubernetes 已经提供丰富的 [Volume](../concepts/volume.md) 和 [Persistent Volume](../concepts/persistent-volume.md) 插件，可以根据需要使用这些插件给容器提供持久化存储。

如果内置的这些 Volume 还不满足要求，则可以使用 [FlexVolume](flex-volume.md) 或者 [容器存储接口 CSI](csi.md) 实现自己的 Volume 插件。
