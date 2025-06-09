# 存储插件

Kubernetes 已经提供丰富的 [Volume](../../concepts/objects/volume.md) 和 [Persistent Volume](../../concepts/objects/persistent-volume.md) 插件，可以根据需要使用这些插件给容器提供持久化存储。

Kubernetes v1.33 中还引入了新的 image volume 功能（Beta），允许将容器镜像作为 volume 挂载，详见 [Volume 文档](../../concepts/objects/volume.md#image)。

如果内置的这些 Volume 还不满足要求，则可以使用 [FlexVolume](flex-volume.md) 或者 [容器存储接口 CSI](csi.md) 实现自己的 Volume 插件。

