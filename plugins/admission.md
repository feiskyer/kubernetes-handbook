# 准入控制

准入控制（Admission Control）在授權後對請求做進一步的驗證或添加默認參數。不同於授權和認證只關心請求的用戶和操作，准入控制還處理請求的內容，並且僅對創建、更新、刪除或連接（如代理）等有效，而對讀操作無效。

准入控制支持同時開啟多個插件，它們依次調用，只有全部插件都通過的請求才可以放過進入系統。

Kubernetes 目前提供了以下幾種准入控制插件

- AlwaysAdmit: 接受所有請求。
- AlwaysPullImages: 總是拉取最新鏡像。在多租戶場景下非常有用。
- DenyEscalatingExec: 禁止特權容器的 exec 和 attach 操作。
- ImagePolicyWebhook: 通過 webhook 決定 image 策略，需要同時配置 `--admission-control-config-file`，配置文件格式見 [這裡](https://kubernetes.io/docs/admin/admission-controllers/#configuration-file-format)。
- ServiceAccount：自動創建默認 ServiceAccount，並確保 Pod 引用的 ServiceAccount 已經存在
- SecurityContextDeny：拒絕包含非法 SecurityContext 配置的容器
- ResourceQuota：限制 Pod 的請求不會超過配額，需要在 namespace 中創建一個 ResourceQuota 對象
- LimitRanger：為 Pod 設置默認資源請求和限制，需要在 namespace 中創建一個 LimitRange 對象
- InitialResources：根據鏡像的歷史使用記錄，為容器設置默認資源請求和限制
- NamespaceLifecycle：確保處於 termination 狀態的 namespace 不再接收新的對象創建請求，並拒絕請求不存在的 namespace
- DefaultStorageClass：為 PVC 設置默認 StorageClass（見 [這裡](../concepts/persistent-volume.md#StorageClass)）
- DefaultTolerationSeconds：設置 Pod 的默認 forgiveness toleration 為 5 分鐘
- PodSecurityPolicy：使用 Pod Security Policies 時必須開啟
- NodeRestriction：限制 kubelet 僅可訪問 node、endpoint、pod、service 以及 secret、configmap、PV 和 PVC 等相關的資源（僅適用於 v1.7+）
- EventRateLimit：限制事件請求數量（僅適用於 v1.9）
- ExtendedResourceToleration：為使用擴展資源（如 GPU 和 FPGA 等）的 Pod 自動添加 tolerations
- StorageProtection：自動給新創建的 PVC 增加 `kubernetes.io/pvc-protection` finalizer（v1.9 及以前版本為 `PVCProtection`，v.11 GA）
- PersistentVolumeClaimResize：允許設置 `allowVolumeExpansion=true` 的 StorageClass 調整 PVC 大小（v1.11 Beta）
- PodNodeSelector：限制一個 Namespace 中可以使用的 Node 選擇標籤
- ValidatingAdmissionWebhook：使用 Webhook 驗證請求，這些 Webhook 並行調用，並且任何一個調用拒絕都會導致請求失敗
- MutatingAdmissionWebhook：使用 Webhook 修改請求，這些 Webhook 依次順序調用

Kubernetes v1.7 + 還支持 Initializers 和 GenericAdmissionWebhook，可以用來方便地擴展准入控制。

## Initializers

Initializers 可以用來給資源執行策略或者配置默認選項，包括 Initializers 控制器和用戶定義的 Initializer 任務，控制器負責執行用戶提交的任務，並完成後將任務從 `metadata.initializers` 列表中刪除。

Initializers 的開啟方法為

- kube-apiserver 配置 `--admission-control=...,Initializers`
- kube-apiserver 開啟 `admissionregistration.k8s.io/v1alpha1` API，即配置 `--runtime-config=admissionregistration.k8s.io/v1alpha1`
- 部署 Initializers 控制器

另外，可以使用 `initializerconfigurations` 來自定義哪些資源開啟 Initializer 功能

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

Initializers 可以用來

- 修改資源的配置，比如自動給 Pod 添加一個 sidecar 容器或者存儲卷
- 如果不需要修改對象的話，建議使用性能更好的 GenericAdmissionWebhook。

如何開發 Initializers

- 參考 [Kubernetes Initializer Tutorial](https://github.com/kelseyhightower/kubernetes-initializer-tutorial) 開發 Initializer
- Initializer 必須有一個全局唯一的名字，比如 `initializer.vaultproject.io`
- Initializer 有可能收到信息不全的資源（比如還未調度的 Pod 沒有 nodeName 和 status），在實現時需要考慮這種情況
- 對於 Initializer 自身的部署，可以使用 Deployment，但需要手動設置 initializers 列表為空，以避免無法啟動的問題，如

```yaml
apiVersion: apps/v1beta1
kind: Deployment
metadata:
  initializers:
    pending: []
```

## GenericAdmissionWebhook

GenericAdmissionWebhook 提供了一種 Webhook 方式的准入控制機制，它不會改變請求對象，但可以用來驗證用戶的請求。

GenericAdmissionWebhook 的開啟方法

- kube-apiserver 配置 `--admission-control=...,GenericAdmissionWebhook`
- kube-apiserver 開啟 `admissionregistration.k8s.io/v1alpha1` API，即配置 `--runtime-config=admissionregistration.k8s.io/v1alpha1`
- 實現並部署 webhook 准入控制器，參考 [這裡](https://github.com/caesarxuchao/example-webhook-admission-controller) 的示例

注意，webhook 准入控制器必須使用 TLS，並需要通過 `externaladmissionhookconfigurations.clientConfig.caBundle` 向 kube-apiserver 註冊：

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

## 推薦配置

對於 Kubernetes >= 1.9.0，推薦配置以下插件

```sh
--admission-control=NamespaceLifecycle,LimitRanger,ServiceAccount,DefaultStorageClass,DefaultTolerationSeconds,MutatingAdmissionWebhook,ValidatingAdmissionWebhook,ResourceQuota
```

對於 Kubernetes >= 1.6.0，推薦 kube-apiserver 開啟以下插件

```sh
--admission-control=NamespaceLifecycle,LimitRanger,ServiceAccount,PersistentVolumeLabel,DefaultStorageClass,ResourceQuota,DefaultTolerationSeconds
```

對於 Kubernetes >= 1.4.0，推薦配置以下插件

```sh
--admission-control=NamespaceLifecycle,LimitRanger,ServiceAccount,DefaultStorageClass,ResourceQuota
```

## 參考文檔

- [Using Admission Controllers](https://kubernetes.io/docs/admin/admission-controllers/)
- [How Kubernetes Initializers work](https://medium.com/google-cloud/how-kubernetes-initializers-work-22f6586e1589)
