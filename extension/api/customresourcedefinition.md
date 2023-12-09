# Delving into CustomResourceDefinition

CustomResourceDefinition (CRD) is an ingenious mechanism introduced in v1.7 that allows you to extend the Kubernetes API without tinkering with code to manage custom objects. Practically speaking, it's an upgraded version of ThirdPartyResources (TPR), which was deprecated in v1.8.

## API Version Comparison Table

| Kubernetes Version | CRD API Version |
| :--- | :--- |
| v1.8+ | apiextensions.k8s.io/v1beta1 |

## CRD Example

The example below crafts a custom API: `/apis/stable.example.com/v1/namespaces/<namespace>/crontabs/…`.

```bash
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
    # Each version can be enabled/disabled by the Served flag.
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
    # shortNames allow a shorter string to match your resource on the CLI
    shortNames:
    - ct
```

Once the API is set up, you can proceed to create specific CronTab objects.

```bash
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

Finalizers are used to implement asynchronous pre-deletion hooks for controllers, which can be specified via `metadata.finalizers`.

```yaml
apiVersion: "stable.example.com/v1"
kind: CronTab
metadata:
  finalizers:
  - finalizer.stable.example.com
```

Once the finalizer is indicated, the operation to delete an object by a client will merely set `metadata.deletionTimestamp` instead of performing a direct deletion. This triggers controllers that are listening to the CRD to perform cleanup operations before deletion, remove its own finalizer from the list, and then initiate a new deletion operation. Only then is the object to be deleted truly eliminated.

## Validation

Starting from v1.8, an experimental validation mechanism based on [OpenAPI v3 schema](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md#schemaObject) was added to validate the conformity of resources submitted by users in advance. To use this function, you need to configure the kube-apiserver's `--feature-gates=CustomResourceValidation=true`.

For instance, the CRD below necessitates:

* `spec.cronSpec` to be a string that matches a regular expression
* `spec.replicas` to be an integer between 1 and 10

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

For example, when creating the following CronTab:

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

You'll encounter a validation failure error:

```bash
The CronTab "my-new-cron-object" is invalid: []: Invalid value: map[string]interface {}{"apiVersion":"stable.example.com/v1", "kind":"CronTab", "metadata":map[string]interface {}{"name":"my-new-cron-object", "namespace":"default", "deletionTimestamp":interface {}(nil), "deletionGracePeriodSeconds":(*int64)(nil), "creationTimestamp":"2017-09-05T05:20:07Z", "uid":"e14d79e7-91f9-11e7-a598-f0761cb232d1", "selfLink":"","clusterName":""}, "spec":map[string]interface {}{"cronSpec":"* * * *", "image":"my-awesome-cron-image", "replicas":15}}:
validation failure list:
spec.cronSpec in body should match '^(\d+|\*)(/\d+)?(\s+(\d+|\*)(/\d+)?){4}$'
spec.replicas in body should be less than or equal to 10
```

## Subresources

From v1.10 onwards, CRD also supports two subresources `/status` and `/scale` in the beta version, and they are enabled by default from v1.11.

> To use in v1.10, you need to enable `--feature-gates=CustomResourceSubresources=true` on the `kube-apiserver`.

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

```bash
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

Categories are used to group CRD objects, making it possible to query all objects belonging to that group with `kubectl get <category-name>`.

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

```bash
$ kubectl create -f resourcedefinition.yaml
$ kubectl create -f my-crontab.yaml
$ kubectl get all
NAME                          AGE
crontabs/my-new-cron-object   3s
```

## CRD Controllers

When extending the Kubernetes API using CRD, it's generally also necessary to implement a controller for the new resources to monitor their changes and make further processing.

[https://github.com/kubernetes/sample-controller](https://github.com/kubernetes/sample-controller) provides an example of a CRD controller, including

* How to register `Foo` resources
* How to create, delete, and query `Foo` objects
* How to monitor changes of `Foo` resources

## Kubebuilder

As demonstrated above, building a CRD controller from scratch is quite challenging considering the level of understanding required for Kubernetes's API. Integrating RBAC, constructing images, and continuous integration and deployment all demand a large amount of work.

[kubebuilder](https://github.com/kubernetes-sigs/kubebuilder) exists to solve this issue, providing an easy-to-use framework for creating CRD controllers and directly generating the resource files needed for image building, continuous integration, and deployment.

### Installation

```bash
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

### How to Use

#### Initialize the Project

```bash
mkdir -p $GOPATH/src/demo
cd $GOPATH/src/demo
kubebuilder init --domain k8s.io --license apache2 --owner "The Kubernetes Authors"
```

#### Create API

```bash
kubebuilder create api --group ships --version v1beta1 --kind Sloop
```

Then, depending on your actual needs, modify `pkg/apis/ship/v1beta1/sloop_types.go` and `pkg/controller/sloop/sloop_controller.go` to add business logic.

#### Run Local Test

```bash
make install
make run
```

> If you run into the error `ValidationError(CustomResourceDefinition.status): missing required field "storedVersions" in io.k8s.apiextensions-apiserver.pkg.apis.apiextensions.v1beta1.CustomResourceDefinitionStatus]`, manually modify `config/crds/ships_v1beta1_sloop.yaml`:
>
> \`\`\`yaml status: acceptedNames: kind: "" plural: "" conditions: \[\] storedVersions: \[\]
>
> Then run `kubectl apply -f config/crds` to create the CRD.

You can then create resources with Kind as `Sloop` using `ships.k8s.io/v1beta1`, such as 

```bash
kubectl apply -f config/samples/ships_v1beta1_sloop.yaml
```

#### Build Image and Deploy Controller

```bash
# Replace IMG with your own
export IMG=feisky/demo-crd:v1
make docker-build
make docker-push
make deploy
```

> kustomize no longer supports wildcards, so the above `make deploy` may encounter a `Load from path ../rbac/*.yaml failed` error. The solution is to manually modify `config/default/kustomization.yaml`:
>
> resources:
>
> * ../rbac/rbac\_role.yaml
> * ../rbac/rbac\_role\_binding.yaml
> * ../manager/manager.yaml
>
> Then execute `kustomize build config/default | kubectl apply -f -` to deploy. By default, it's deployed to the `demo-system` namespace.

#### Documentation and Testing

```bash
# run unit tests
make test

# generate docs
kubebuilder docs
```

## References

* [Extend the Kubernetes API with CustomResourceDefinitions](https://kubernetes.io/docs/tasks/access-kubernetes-api/extend-api-custom-resource-definitions/#validation)
* [CustomResourceDefinition API](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.15/#customresourcedefinition-v1beta1-apiextensions-k8s-io)