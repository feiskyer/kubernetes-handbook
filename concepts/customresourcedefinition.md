# CustomResourceDefinition

CustomResourceDefinition（CRD）是 v1.7 新增的無需改變代碼就可以擴展 Kubernetes API 的機制，用來管理自定義對象。它實際上是 ThirdPartyResources（TPR）的升級版本，而 TPR 已經在 v1.8 中棄用。

## API 版本對照表

| Kubernetes 版本 | CRD API 版本                 |
| --------------- | ---------------------------- |
| v1.8+           | apiextensions.k8s.io/v1beta1 |

## CRD 示例

下面的例子會創建一個 `/apis/stable.example.com/v1/namespaces/<namespace>/crontabs/…` 的自定義 API：

```sh
apiVersion: apiextensions.k8s.io/v1beta1
kind: CustomResourceDefinition
metadata:
  # name must match the spec fields below, and be in the form: <plural>.<group>
  name: crontabs.stable.example.com
spec:
  # group name to use for REST API: /apis/<group>/<version>
  group: stable.example.com
  # versions to use for REST API: /apis/<group>/<version>
  versions:
  - name: v1beta1
    # Each version can be enabled/disabled by Served flag.
    served: true
    # One and only one version must be marked as the storage version.
    storage: true
  - name: v1
    served: true
    storage: false
  # either Namespaced or Cluster
  scope: Namespaced
  names:
    # plural name to be used in the URL: /apis/<group>/<version>/<plural>
    plural: crontabs
    # singular name to be used as an alias on the CLI and for display
    singular: crontab
    # kind is normally the CamelCased singular type. Your resource manifests use this.
    kind: CronTab
    # shortNames allow shorter string to match your resource on the CLI
    shortNames:
    - ct
```

API 創建好後，就可以創建具體的 CronTab 對象了

```sh
$ cat my-cronjob.yaml
apiVersion: "stable.example.com/v1"
kind: CronTab
metadata:
  name: my-new-cron-object
spec:
  cronSpec: "* * * * /5"
  image: my-awesome-cron-image

$ kubectl create -f my-crontab.yaml
crontab "my-new-cron-object" created

$ kubectl get crontab
NAME                 KIND
my-new-cron-object   CronTab.v1.stable.example.com
$ kubectl get crontab my-new-cron-object -o yaml
apiVersion: stable.example.com/v1
kind: CronTab
metadata:
  creationTimestamp: 2017-07-03T19:00:56Z
  name: my-new-cron-object
  namespace: default
  resourceVersion: "20630"
  selfLink: /apis/stable.example.com/v1/namespaces/default/crontabs/my-new-cron-object
  uid: 5c82083e-5fbd-11e7-a204-42010a8c0002
spec:
  cronSpec: '* * * * /5'
  image: my-awesome-cron-image
```

## Finalizer

Finalizer 用於實現控制器的異步預刪除鉤子，可以通過 `metadata.finalizers` 來指定 Finalizer。

```yaml
apiVersion: "stable.example.com/v1"
kind: CronTab
metadata:
  finalizers:
  - finalizer.stable.example.com
```

Finalizer 指定後，客戶端刪除對象的操作只會設置 `metadata.deletionTimestamp` 而不是直接刪除。這會觸發正在監聽 CRD 的控制器，控制器執行一些刪除前的清理操作，從列表中刪除自己的 finalizer，然後再重新發起一個刪除操作。此時，被刪除的對象才會真正刪除。

## Validation

v1.8 開始新增了實驗性的基於 [OpenAPI v3 schema](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md#schemaObject) 的驗證（Validation）機制，可以用來提前驗證用戶提交的資源是否符合規範。使用該功能需要配置 kube-apiserver 的 `--feature-gates=CustomResourceValidation=true`。

比如下面的 CRD 要求

- `spec.cronSpec` 必須是匹配正則表達式的字符串
- `spec.replicas` 必須是從 1 到 10 的整數

```yaml
apiVersion: apiextensions.k8s.io/v1beta1
kind: CustomResourceDefinition
metadata:
  name: crontabs.stable.example.com
spec:
  group: stable.example.com
  version: v1
  scope: Namespaced
  names:
    plural: crontabs
    singular: crontab
    kind: CronTab
    shortNames:
    - ct
  validation:
   # openAPIV3Schema is the schema for validating custom objects.
    openAPIV3Schema:
      properties:
        spec:
          properties:
            cronSpec:
              type: string
              pattern: '^(\d+|\*)(/\d+)?(\s+(\d+|\*)(/\d+)?){4}$'
            replicas:
              type: integer
              minimum: 1
              maximum: 10
```

這樣，在創建下面的 CronTab 時

```yaml
apiVersion: "stable.example.com/v1"
kind: CronTab
metadata:
  name: my-new-cron-object
spec:
  cronSpec: "* * * *"
  image: my-awesome-cron-image
  replicas: 15
```

會報驗證失敗的錯誤：

```sh
The CronTab "my-new-cron-object" is invalid: []: Invalid value: map[string]interface {}{"apiVersion":"stable.example.com/v1", "kind":"CronTab", "metadata":map[string]interface {}{"name":"my-new-cron-object", "namespace":"default", "deletionTimestamp":interface {}(nil), "deletionGracePeriodSeconds":(*int64)(nil), "creationTimestamp":"2017-09-05T05:20:07Z", "uid":"e14d79e7-91f9-11e7-a598-f0761cb232d1", "selfLink":"","clusterName":""}, "spec":map[string]interface {}{"cronSpec":"* * * *", "image":"my-awesome-cron-image", "replicas":15}}:
validation failure list:
spec.cronSpec in body should match '^(\d+|\*)(/\d+)?(\s+(\d+|\*)(/\d+)?){4}$'
spec.replicas in body should be less than or equal to 10
```

## Subresources

v1.10 開始 CRD 還支持 `/status` 和 `/scale` 等兩個子資源（Beta），並且從 v1.11 開始默認開啟。

> v1.10 版本使用前需要在 `kube-apiserver` 開啟 `--feature-gates=CustomResourceSubresources=true`。

```yaml
# resourcedefinition.yaml
apiVersion: apiextensions.k8s.io/v1beta1
kind: CustomResourceDefinition
metadata:
  name: crontabs.stable.example.com
spec:
  group: stable.example.com
  version: v1
  scope: Namespaced
  names:
    plural: crontabs
    singular: crontab
    kind: CronTab
    shortNames:
    - ct
  # subresources describes the subresources for custom resources.
  subresources:
    # status enables the status subresource.
    status: {}
    # scale enables the scale subresource.
    scale:
      # specReplicasPath defines the JSONPath inside of a custom resource that corresponds to Scale.Spec.Replicas.
      specReplicasPath: .spec.replicas
      # statusReplicasPath defines the JSONPath inside of a custom resource that corresponds to Scale.Status.Replicas.
      statusReplicasPath: .status.replicas
      # labelSelectorPath defines the JSONPath inside of a custom resource that corresponds to Scale.Status.Selector.
      labelSelectorPath: .status.labelSelector
```

```sh
$ kubectl create -f resourcedefinition.yaml
$ kubectl create -f- <<EOF
apiVersion: "stable.example.com/v1"
kind: CronTab
metadata:
  name: my-new-cron-object
spec:
  cronSpec: "* * * * */5"
  image: my-awesome-cron-image
  replicas: 3
EOF

$ kubectl scale --replicas=5 crontabs/my-new-cron-object
crontabs "my-new-cron-object" scaled

$ kubectl get crontabs my-new-cron-object -o jsonpath='{.spec.replicas}'
5
```

## Categories

Categories 用來將 CRD 對象分組，這樣就可以使用 `kubectl get <category-name>` 來查詢屬於該組的所有對象。

```yaml
# resourcedefinition.yaml
apiVersion: apiextensions.k8s.io/v1beta1
kind: CustomResourceDefinition
metadata:
  name: crontabs.stable.example.com
spec:
  group: stable.example.com
  version: v1
  scope: Namespaced
  names:
    plural: crontabs
    singular: crontab
    kind: CronTab
    shortNames:
    - ct
    # categories is a list of grouped resources the custom resource belongs to.
    categories:
    - all
```

```yaml
# my-crontab.yaml
apiVersion: "stable.example.com/v1"
kind: CronTab
metadata:
  name: my-new-cron-object
spec:
  cronSpec: "* * * * */5"
  image: my-awesome-cron-image
```

```sh
$ kubectl create -f resourcedefinition.yaml
$ kubectl create -f my-crontab.yaml
$ kubectl get all
NAME                          AGE
crontabs/my-new-cron-object   3s
```

## CRD 控制器

在使用 CRD 擴展 Kubernetes API 時，通常還需要實現一個新建資源的控制器，監聽新資源的變化情況，並作進一步的處理。

<https://github.com/kubernetes/sample-controller> 提供了一個 CRD 控制器的示例，包括

- 如何註冊資源 `Foo`
- 如何創建、刪除和查詢 `Foo` 對象
- 如何監聽 `Foo` 資源對象的變化情況

## Kubebuilder

從上面的實例中可以看到從頭構建一個 CRD 控制器並不容易，需要對 Kubernetes 的 API 有深入瞭解，並且RBAC 集成、鏡像構建、持續集成和部署等都需要很大工作量。

[kubebuilder](https://github.com/kubernetes-sigs/kubebuilder) 正是為解決這個問題而生，為 CRD 控制器提供了一個簡單易用的框架，並可直接生成鏡像構建、持續集成、持續部署等所需的資源文件。

### 安裝

```sh
# Install kubebuilder
VERSION=1.0.1
wget https://github.com/kubernetes-sigs/kubebuilder/releases/download/v${VERSION}/kubebuilder_${VERSION}_linux_amd64.tar.gz
tar zxvf kubebuilder_${VERSION}_linux_amd64.tar.gz
sudo mv kubebuilder_${VERSION}_linux_amd64 /usr/local/kubebuilder
export PATH=$PATH:/usr/local/kubebuilder/bin

# Install dep kustomize
go get -u github.com/golang/dep/cmd/dep
go get github.com/kubernetes-sigs/kustomize
```

### 使用方法

#### 初始化項目

```sh
mkdir -p $GOPATH/src/demo
cd $GOPATH/src/demo
kubebuilder init --domain k8s.io --license apache2 --owner "The Kubernetes Authors"
```

#### 創建 API

```sh
kubebuilder create api --group ships --version v1beta1 --kind Sloop
```

然後按照實際需要修改 `pkg/apis/ship/v1beta1/sloop_types.go` 和 `pkg/controller/sloop/sloop_controller.go` 增加業務邏輯。

#### 本地運行測試

```sh
make install
make run
```

> 如果碰到錯誤 ` ValidationError(CustomResourceDefinition.status): missing required field "storedVersions" in io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1beta1.CustomResourceDefinitionStatus]`，可以手動修改 `config/crds/ships_v1beta1_sloop.yaml`:
> ```yaml
> status:
>   acceptedNames:
>     kind: ""
>     plural: ""
>   conditions: []
>   storedVersions: []
>
> 然後運行 `kubectl apply -f config/crds` 創建 CRD。

然後就可以用 `ships.k8s.io/v1beta1` 來創建 Kind 為 `Sloop` 的資源了，比如

```sh
kubectl apply -f config/samples/ships_v1beta1_sloop.yaml
```

#### 構建鏡像並部署控制器

```sh
# 替換 IMG 為你自己的
export IMG=feisky/demo-crd:v1
make docker-build
make docker-push
make deploy
```

> kustomize 已經不再支持通配符，因而上述 `make deploy` 可能會碰到 `Load from path ../rbac/*.yaml failed` 錯誤，解決方法是手動修改 `config/default/kustomization.yaml`:
>
> resources:
> - ../rbac/rbac_role.yaml
> - ../rbac/rbac_role_binding.yaml
> - ../manager/manager.yaml
>
> 然後執行 `kustomize build config/default | kubectl apply -f -` 部署，默認部署到 `demo-system` namespace 中。

#### 文檔和測試

```sh
# run unit tests
make test

# generate docs
kubebuilder docs
```

## 參考文檔

- [Extend the Kubernetes API with CustomResourceDefinitions](https://kubernetes.io/docs/tasks/access-kubernetes-api/extend-api-custom-resource-definitions/#validation)
- [CustomResourceDefinition API](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.15/#customresourcedefinition-v1beta1-apiextensions-k8s-io)
