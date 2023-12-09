# Making sense of CustomResourceDefinitions (CRDs)

The novel feature of the Kubernetes API, CustomResourceDefinition (CRD), offers a seamless way to extend the Kubernetes API without changing the existing code. Effectively, it is a replacement and upgrade for the older ThirdPartyResources (TPR), which was deprecated starting from version v1.8.

## A glance at the API version compatibility table

| Kubernetes Versions | Compatible CRD API Versions |
| :---                | :---                        |
| v1.8+               | apiextensions.k8s.io/v1beta1 |

## A dive into CRD through an example

Here’s an illustration of creating a CRD, thereby deploying a tailor-made API endpoint at `/apis/stable.example.com/v1/namespaces/<namespace>/crontabs/…`.

Let’s break down the sample code. It starts off by specifying the API version and type of resource (kind). The metadata section requires a unique name that aligns with the spec fields provided below. Following the metadata are the spec fields, which provide information about the group name to be used for REST API, versions of the REST API, and the scope.

It also includes the names of the custom resources, where 'plural' is used in the URL, 'singular' acts as an alias on the CLI and for display, 'kind' is the CamelCased singular type which is used in your resource manifests, and 'shortNames', which allow shorter strings to match the resource on the CLI.

With this API, we can now proceed to create specific CronTab objects.

## Finalizer: a life-jacket for controllers

Finalizer works as a life-preserver for controllers to implement asynchronous pre-deletion hooks. It can be specified in the metadata with `metadata.finalizers`.

Once specified, any attempt from the client side to delete the object only sets the `metadata.deletionTimestamp` instead of executing the deletion. This will trigger the ongoing CRD controllers, perform some pre-deletion housecleaning activities, remove their own finalizer from the list, and then launch a new delete operation. Only then, the targeted object will be officially deleted.

## Validation: Keeping Standards High

From v1.8, the schema-based validation based on [OpenAPI v3 schema](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md#schemaObject) was introduced, which allows us to verify user submissions for compliance. To use this feature, the `--feature-gates=CustomResourceValidation=true` needs to be configured in the kube-apiserver.

For instance, the CRD below expects:

* `spec.cronSpec` to be a string matching a regular expression
* `spec.replicas` to be an integer between 1 and 10

Any deviations from these rules will result in a validation failure error.

## Subresources

From v1.10, CRD started supporting the status and scale subresources (Beta), and from v1.11, those are enabled by default.

## Categorizing CRDs

Categories are used to group CRD objects, allowing an all-at-once query of all objects belonging to that category with `kubectl get <category-name>`.

## CRD Controllers

Usually, when extending Kubernetes API with CRD, there's also a need to implement a new resource controller to keep track of changes in the new resource and carry out further handling.

The [sample-controller](https://github.com/kubernetes/sample-controller) offers an example of a CRD controller, including details like how to register a resource `Foo`, how to create, delete, and query `Foo` objects, and how to track changes in `Foo` resource objects.

## Kubebuilder: The Friendly Neighborhood Framework

As we see from the examples above, building a CRD controller from scratch is no mean task. Getting in-depth knowledge of Kubernetes API aside, integrating RBAC, building images, and continuous integration and deployment demand substantial efforts. 

Here’s when [kubebuilder](https://github.com/kubernetes-sigs/kubebuilder) comes to the rescue. It provides an intuitive framework for CRD controllers and helps generate the resource files needed for image building, continuous integration, and continuous deployment directly.

### Installing Kubebuilder

### How to use

#### Starting a project

#### Creating an API

After this, you need to adjust the `pkg/apis/ship/v1beta1/sloop_types.go` and `pkg/controller/sloop/sloop_controller.go` as per your business requirements.

#### Running Test Locally

Subsequently, with the help of `ships.k8s.io/v1beta1`, a `Sloop` kind resource can be created.

#### Building Images and Deploying Controllers

#### Documentation and Testing

## References 

* [Extend the Kubernetes API with CustomResourceDefinitions](https://kubernetes.io/docs/tasks/access-kubernetes-api/extend-api-custom-resource-definitions/#validation)
* [CustomResourceDefinition API](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.15/#customresourcedefinition-v1beta1-apiextensions-k8s-io)
