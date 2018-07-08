# 准入控制

准入控制（Admission Control）在授权后对请求做进一步的验证或添加默认参数。不同于授权和认证只关心请求的用户和操作，准入控制还处理请求的内容，并且仅对创建、更新、删除或连接（如代理）等有效，而对读操作无效。

准入控制支持同时开启多个插件，它们依次调用，只有全部插件都通过的请求才可以放过进入系统。

Kubernetes 目前提供了以下几种准入控制插件

- AlwaysAdmit: 接受所有请求。
- AlwaysPullImages: 总是拉取最新镜像。在多租户场景下非常有用。
- DenyEscalatingExec: 禁止特权容器的 exec 和 attach 操作。
- ImagePolicyWebhook: 通过 webhook 决定 image 策略，需要同时配置 `--admission-control-config-file`，配置文件格式见 [这里](https://kubernetes.io/docs/admin/admission-controllers/#configuration-file-format)。
- ServiceAccount：自动创建默认 ServiceAccount，并确保 Pod 引用的 ServiceAccount 已经存在
- SecurityContextDeny：拒绝包含非法 SecurityContext 配置的容器
- ResourceQuota：限制 Pod 的请求不会超过配额，需要在 namespace 中创建一个 ResourceQuota 对象
- LimitRanger：为 Pod 设置默认资源请求和限制，需要在 namespace 中创建一个 LimitRange 对象
- InitialResources：根据镜像的历史使用记录，为容器设置默认资源请求和限制
- NamespaceLifecycle：确保处于 termination 状态的 namespace 不再接收新的对象创建请求，并拒绝请求不存在的 namespace
- DefaultStorageClass：为 PVC 设置默认 StorageClass（见 [这里](../concepts/persistent-volume.md#StorageClass)）
- DefaultTolerationSeconds：设置 Pod 的默认 forgiveness toleration 为 5 分钟
- PodSecurityPolicy：使用 Pod Security Policies 时必须开启
- NodeRestriction：限制 kubelet 仅可访问 node、endpoint、pod、service 以及 secret、configmap、PV 和 PVC 等相关的资源（仅适用于 v1.7+）
- EventRateLimit：限制事件请求数量（仅适用于 v1.9）
- ExtendedResourceToleration：为使用扩展资源（如 GPU 和 FPGA 等）的 Pod 自动添加 tolerations
- StorageProtection：自动给新创建的 PVC 增加 `kubernetes.io/pvc-protection` finalizer（v1.9 及以前版本为 `PVCProtection`，v.11 GA）
- PersistentVolumeClaimResize：允许设置 `allowVolumeExpansion=true` 的 StorageClass 调整 PVC 大小（v1.11 Beta）
- PodNodeSelector：限制一个 Namespace 中可以使用的 Node 选择标签
- ValidatingAdmissionWebhook：使用 Webhook 验证请求，这些 Webhook 并行调用，并且任何一个调用拒绝都会导致请求失败
- MutatingAdmissionWebhook：使用 Webhook 修改请求，这些 Webhook 依次顺序调用

Kubernetes v1.7 + 还支持 Initializers 和 GenericAdmissionWebhook，可以用来方便地扩展准入控制。

## Initializers

Initializers 可以用来给资源执行策略或者配置默认选项，包括 Initializers 控制器和用户定义的 Initializer 任务，控制器负责执行用户提交的任务，并完成后将任务从 `metadata.initializers` 列表中删除。

Initializers 的开启方法为

- kube-apiserver 配置 `--admission-control=...,Initializers`
- kube-apiserver 开启 `admissionregistration.k8s.io/v1alpha1` API，即配置 `--runtime-config=admissionregistration.k8s.io/v1alpha1`
- 部署 Initializers 控制器

另外，可以使用 `initializerconfigurations` 来自定义哪些资源开启 Initializer 功能

```yaml
apiVersion: admissionregistration.k8s.io/v1alpha1
kind: InitializerConfiguration
metadata:
  name: example-config
initializers:
  # the name needs to be fully qualified, i.e., containing at least two "."
  - name: podimage.example.com
    rules:
      # apiGroups, apiVersion, resources all support wildcard "*".
      # "*" cannot be mixed with non-wildcard.
      - apiGroups:
          - ""
        apiVersions:
          - v1
        resources:
          - pods
```

Initializers 可以用来

- 修改资源的配置，比如自动给 Pod 添加一个 sidecar 容器或者存储卷
- 如果不需要修改对象的话，建议使用性能更好的 GenericAdmissionWebhook。

如何开发 Initializers

- 参考 [Kubernetes Initializer Tutorial](https://github.com/kelseyhightower/kubernetes-initializer-tutorial) 开发 Initializer
- Initializer 必须有一个全局唯一的名字，比如 `initializer.vaultproject.io`
- Initializer 有可能收到信息不全的资源（比如还未调度的 Pod 没有 nodeName 和 status），在实现时需要考虑这种情况
- 对于 Initializer 自身的部署，可以使用 Deployment，但需要手动设置 initializers 列表为空，以避免无法启动的问题，如

```yaml
apiVersion: apps/v1beta1
kind: Deployment
metadata:
  initializers:
    pending: []
```

## GenericAdmissionWebhook

GenericAdmissionWebhook 提供了一种 Webhook 方式的准入控制机制，它不会改变请求对象，但可以用来验证用户的请求。

GenericAdmissionWebhook 的开启方法

- kube-apiserver 配置 `--admission-control=...,GenericAdmissionWebhook`
- kube-apiserver 开启 `admissionregistration.k8s.io/v1alpha1` API，即配置 `--runtime-config=admissionregistration.k8s.io/v1alpha1`
- 实现并部署 webhook 准入控制器，参考 [这里](https://github.com/caesarxuchao/example-webhook-admission-controller) 的示例

注意，webhook 准入控制器必须使用 TLS，并需要通过 `externaladmissionhookconfigurations.clientConfig.caBundle` 向 kube-apiserver 注册：

```yaml
apiVersion: admissionregistration.k8s.io/v1alpha1
kind: ExternalAdmissionHookConfiguration
metadata:
  name: example-config
externalAdmissionHooks:
- name: pod-image.k8s.io
  rules:
  - apiGroups:
    - ""
    apiVersions:
    - v1
    operations:
    - CREATE
    resources:
    - pods
  # fail upon a communication error with the webhook admission controller
  # Other options: Ignore
  failurePolicy: Fail
  clientConfig:
    caBundle: <pem encoded ca cert that signs the server cert used by the webhook>
    service:
      name: <name of the front-end service>
      namespace: <namespace of the front-end service>
```

## 推荐配置

对于 Kubernetes >= 1.9.0，推荐配置以下插件

```sh
--admission-control=NamespaceLifecycle,LimitRanger,ServiceAccount,DefaultStorageClass,DefaultTolerationSeconds,MutatingAdmissionWebhook,ValidatingAdmissionWebhook,ResourceQuota
```

对于 Kubernetes >= 1.6.0，推荐 kube-apiserver 开启以下插件

```sh
--admission-control=NamespaceLifecycle,LimitRanger,ServiceAccount,PersistentVolumeLabel,DefaultStorageClass,ResourceQuota,DefaultTolerationSeconds
```

对于 Kubernetes >= 1.4.0，推荐配置以下插件

```sh
--admission-control=NamespaceLifecycle,LimitRanger,ServiceAccount,DefaultStorageClass,ResourceQuota
```

## 参考文档

- [Using Admission Controllers](https://kubernetes.io/docs/admin/admission-controllers/)
- [How Kubernetes Initializers work](https://medium.com/google-cloud/how-kubernetes-initializers-work-22f6586e1589)
