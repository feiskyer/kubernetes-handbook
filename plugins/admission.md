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
- DefaultStorageClass：为PVC设置默认StorageClass（见[这里](../concepts/persistent-volume.md#StorageClass)
- DefaultTolerationSeconds：设置Pod的默认forgiveness toleration为5分钟
- PodSecurityPolicy：使用Pod Security Policies时必须开启
- NodeRestriction：限制kubelet仅可访问node、endpoint、pod、service以及secret、configmap、PV和PVC等相关的资源（仅适用于v1.7+）

Kubernetes v1.7+还支持Initializers和GenericAdmissionWebhook，可以用来方便地扩展准入控制。

## Initializers

Initializers可以用来给资源执行策略或者配置默认选项，包括Initializers控制器和用户定义的Initializer任务，控制器负责执行用户提交的任务，并完成后将任务从`metadata.initializers`列表中删除。

Initializers的开启方法为

- kube-apiserver配置`--admission-control=...,Initializers`
- kube-apiserver开启`admissionregistration.k8s.io/v1alpha1` API，即配置`--runtime-config=admissionregistration.k8s.io/v1alpha1`
- 部署Initializers控制器

另外，可以使用`initializerconfigurations`来自定义哪些资源开启Initializer功能

```yaml
apiVersion: admissionregistration.k8s.io/v1alpha1
kind: InitializerConfiguration
metadata:
  name: example-config
spec:
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

Initializers可以用来

- 修改资源的配置，比如自动给Pod添加一个sidecar容器或者存储卷
- 如果不需要修改对象的话，建议使用性能更好的GenericAdmissionWebhook。

如何开发Initializers

- 参考[Kubernetes Initializer Tutorial](https://github.com/kelseyhightower/kubernetes-initializer-tutorial) 开发Initializer
- Initializer必须有一个全局唯一的名字，比如`initializer.vaultproject.io`
- 对于Initializer自身的部署，可以使用Deployment，但需要手动设置initializers列表为空，以避免无法启动的问题，如
```
apiVersion: apps/v1beta1
kind: Deployment
metadata:
  initializers:
    pending: []
```
- Initializer有可能收到信息不全的资源（比如还未调度的Pod没有nodeName和status），在实现时需要考虑这种情况

## GenericAdmissionWebhook

GenericAdmissionWebhook提供了一种Webhook方式的准入控制机制，它不会改变请求对象，但可以用来验证用户的请求。

GenericAdmissionWebhook的开启方法

- kube-apiserver配置`--admission-control=...,GenericAdmissionWebhook`
- kube-apiserver开启`admissionregistration.k8s.io/v1alpha1` API，即配置`--runtime-config=admissionregistration.k8s.io/v1alpha1`
- 实现并部署webhook准入控制器，参考[这里](https://github.com/caesarxuchao/example-webhook-admission-controller)的示例

注意，webhook准入控制器必须使用TLS，并需要通过`externaladmissionhookconfigurations.clientConfig.caBundle`向kube-apiserver注册：

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

对于Kubernetes >= 1.6.0，推荐kube-apiserver开启以下插件

```sh
--admission-control=NamespaceLifecycle,LimitRanger,ServiceAccount,PersistentVolumeLabel,DefaultStorageClass,ResourceQuota,DefaultTolerationSeconds
```

## 参考文档

- [Using Admission Controllers](https://kubernetes.io/docs/admin/admission-controllers/)
- [How Kubernetes Initializers work](https://medium.com/google-cloud/how-kubernetes-initializers-work-22f6586e1589)

