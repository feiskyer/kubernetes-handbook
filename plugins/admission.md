# 准入控制

准入控制（Admission Control）在授权后对请求做进一步的验证或添加默认参数。不同于授权和认证只关心请求的用户和操作，准入控制还处理请求的内容，并且仅对创建、更新、删除或连接（如代理）等有效，而对读操作无效。

准入控制支持同时开启多个插件，它们依次调用，只有全部插件都通过的请求才可以放过进入系统。

Kubernetes目前提供了以下几种准入控制插件

- AlwaysAdmit: 接受所有请求。
- AlwaysPullImages: 总是拉取最新镜像。在多租户场景下非常有用。
- DenyEscalatingExec: 禁止特权容器的exec和attach操作。
- ImagePolicyWebhook: 通过webhook决定image策略，需要同时配置`--admission-control-config-file`，配置文件格式见[这里](https://kubernetes.io/docs/admin/admission-controllers/#configuration-file-format)。
- ServiceAccount：自动创建默认ServiceAccount，并确保Pod引用的ServiceAccount已经存在
- SecurityContextDeny：拒绝包含非法SecurityContext配置的容器
- ResourceQuota：限制Pod的请求不会超过配额，需要在namespace中创建一个ResourceQuota对象
- LimitRanger：为Pod设置默认资源请求和限制，需要在namespace中创建一个LimitRange对象
- InitialResources：根据镜像的历史使用记录，为容器设置默认资源请求和限制
- NamespaceLifecycle：确保处于termination状态的namespace不再接收新的对象创建请求，并拒绝请求不存在的namespace
- DefaultStorageClass：为PVC设置默认StorageClass（见[这里](../architecture/persistent-volume.md#StorageClass)
- DefaultTolerationSeconds：设置Pod的默认forgiveness toleration为5分钟
- PodSecurityPolicy：使用Pod Security Policies时必须开启

## 推荐配置

对于Kubernetes >= 1.6.0，推荐API Server开启以下插件

```sh
--admission-control=NamespaceLifecycle,LimitRanger,ServiceAccount,PersistentVolumeLabel,DefaultStorageClass,ResourceQuota,DefaultTolerationSeconds
```

