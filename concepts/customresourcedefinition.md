# CustomResourceDefinition

CustomResourceDefinition（CRD）是 v1.7 新增的无需改变代码就可以扩展 Kubernetes API 的机制，用来管理自定义对象。它实际上是 ThirdPartyResources（TPR）的升级版本，而 TPR 已经在 v1.8 中弃用。

## API 版本对照表

| Kubernetes 版本 | CRD API 版本                 |
| --------------- | ---------------------------- |
| v1.8+           | apiextensions.k8s.io/v1beta1 |

## CRD 示例

下面的例子会创建一个 `/apis/stable.example.com/v1/namespaces/<namespace>/crontabs/…` 的自定义 API：

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

API 创建好后，就可以创建具体的 CronTab 对象了

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

Finalizer 用于实现控制器的异步预删除钩子，可以通过 `metadata.finalizers` 来指定 Finalizer。

```yaml
apiVersion: "stable.example.com/v1"
kind: CronTab
metadata:
  finalizers:
  - finalizer.stable.example.com
```

Finalizer 指定后，客户端删除对象的操作只会设置 `metadata.deletionTimestamp` 而不是直接删除。这会触发正在监听 CRD 的控制器，控制器执行一些删除前的清理操作，从列表中删除自己的 finalizer，然后再重新发起一个删除操作。此时，被删除的对象才会真正删除。

## Validation

v1.8 开始新增了实验性的基于 [OpenAPI v3 schema](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md#schemaObject) 的验证（Validation）机制，可以用来提前验证用户提交的资源是否符合规范。使用该功能需要配置 kube-apiserver 的 `--feature-gates=CustomResourceValidation=true`。

比如下面的 CRD 要求

- `spec.cronSpec` 必须是匹配正则表达式的字符串
- `spec.replicas` 必须是从 1 到 10 的整数

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

这样，在创建下面的 CronTab 时

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

会报验证失败的错误：

```sh
The CronTab "my-new-cron-object" is invalid: []: Invalid value: map[string]interface {}{"apiVersion":"stable.example.com/v1", "kind":"CronTab", "metadata":map[string]interface {}{"name":"my-new-cron-object", "namespace":"default", "deletionTimestamp":interface {}(nil), "deletionGracePeriodSeconds":(*int64)(nil), "creationTimestamp":"2017-09-05T05:20:07Z", "uid":"e14d79e7-91f9-11e7-a598-f0761cb232d1", "selfLink":"","clusterName":""}, "spec":map[string]interface {}{"cronSpec":"* * * *", "image":"my-awesome-cron-image", "replicas":15}}:
validation failure list:
spec.cronSpec in body should match '^(\d+|\*)(/\d+)?(\s+(\d+|\*)(/\d+)?){4}$'
spec.replicas in body should be less than or equal to 10
```

## Subresources

v1.10 开始 CRD 还支持 `/status` 和 `/scale` 等两个子资源（Beta），并且从 v1.11 开始默认开启。

> v1.10 版本使用前需要在 `kube-apiserver` 开启 `--feature-gates=CustomResourceSubresources=true`。

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

Categories 用来将 CRD 对象分组，这样就可以使用 `kubectl get <category-name>` 来查询属于该组的所有对象。

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

在使用 CRD 扩展 Kubernetes API 时，通常还需要实现一个新建资源的控制器，监听新资源的变化情况，并作进一步的处理。

<https://github.com/kubernetes/sample-controller> 提供了一个 CRD 控制器的示例，包括

- 如何注册资源 `Foo`
- 如何创建、删除和查询 `Foo` 对象
- 如何监听 `Foo` 资源对象的变化情况

## Kubebuilder

从上面的实例中可以看到从头构建一个 CRD 控制器并不容易，需要对 Kubernetes 的 API 有深入了解，并且RBAC 集成、镜像构建、持续集成和部署等都需要很大工作量。

[kubebuilder](https://github.com/kubernetes-sigs/kubebuilder) 正是为解决这个问题而生，为 CRD 控制器提供了一个简单易用的框架，并可直接生成镜像构建、持续集成、持续部署等所需的资源文件。

### 安装

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

#### 初始化项目

```sh
mkdir -p $GOPATH/src/demo
cd $GOPATH/src/demo
kubebuilder init --domain k8s.io --license apache2 --owner "The Kubernetes Authors"
```

#### 创建 API

```sh
kubebuilder create api --group ships --version v1beta1 --kind Sloop
```

然后按照实际需要修改 `pkg/apis/ship/v1beta1/sloop_types.go` 和 `pkg/controller/sloop/sloop_controller.go` 增加业务逻辑。

#### 本地运行测试

```sh
make install
make run
```

> 如果碰到错误 ` ValidationError(CustomResourceDefinition.status): missing required field "storedVersions" in io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1beta1.CustomResourceDefinitionStatus]`，可以手动修改 `config/crds/ships_v1beta1_sloop.yaml`:
> ```yaml
> status:
>   acceptedNames:
>     kind: ""
>     plural: ""
>   conditions: []
>   storedVersions: []
>
> 然后运行 `kubectl apply -f config/crds` 创建 CRD。

然后就可以用 `ships.k8s.io/v1beta1` 来创建 Kind 为 `Sloop` 的资源了，比如

```sh
kubectl apply -f config/samples/ships_v1beta1_sloop.yaml
```

#### 构建镜像并部署控制器

```sh
# 替换 IMG 为你自己的
export IMG=feisky/demo-crd:v1
make docker-build
make docker-push
make deploy
```

> kustomize 已经不再支持通配符，因而上述 `make deploy` 可能会碰到 `Load from path ../rbac/*.yaml failed` 错误，解决方法是手动修改 `config/default/kustomization.yaml`:
>
> resources:
> - ../rbac/rbac_role.yaml
> - ../rbac/rbac_role_binding.yaml
> - ../manager/manager.yaml
>
> 然后执行 `kustomize build config/default | kubectl apply -f -` 部署，默认部署到 `demo-system` namespace 中。

#### 文档和测试

```sh
# run unit tests
make test

# generate docs
kubebuilder docs
```

## 参考文档

- [Extend the Kubernetes API with CustomResourceDefinitions](https://kubernetes.io/docs/tasks/access-kubernetes-api/extend-api-custom-resource-definitions/#validation)
- [CustomResourceDefinition API](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.15/#customresourcedefinition-v1beta1-apiextensions-k8s-io)
