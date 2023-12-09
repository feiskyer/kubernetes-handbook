# Aggregation Unplugged

API Aggregation enables the amplification of Kubernetes API without altering its core code. What this means is that third-party services can be registered into Kubernetes API, which consequently allows for the access of these external services right within Kubernetes API.

> Note: Another method for expanding the horizons of Kubernetes API is via [CustomResourceDefinition \(CRD\)]().

## Picking the Right Times for Aggregation

| Conditions suited for API Aggregation | Perfect conditions to utilize independent API |
| :--- | :--- |
| If your API is [Declarative](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/#declarative-apis). | If your API doesn't quite cut the [Declarative](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/#declarative-apis) model. |
| If you'd want your new types to be read and altered with `kubectl`. | `kubectl` support: Check `Not required` box |
| Want to view your brand new types in a Kubernetes UI like the dashboard along with other built-in types? | Spare the thought if Kubernetes UI support isn't required. |
| If you're building a new API from scratch. | If you're already equipped with a functioning program serving your API efficiently. |
| If you are open to embracing the format restriction imposed on REST resource paths by Kubernetes, such as API Groups and Namespaces. (Dive deeper into the [API Overview](https://kubernetes.io/docs/concepts/overview/kubernetes-api/).) | If you need specific REST paths to gel with an existing REST API. |
| If your resources seamlessly fit into a cluster or namespaces of a cluster. | If cluster or namespace scoped resources are bad fits; instead, you require control over resource path specifics. |
| If you wish to tap into [Kubernetes API support features](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/#common-features). | If those features aren't on your required list. |

## Jumpstarting API Aggregation

Augment kube-apiserver by tweaking the configuration:

```bash
--requestheader-client-ca-file=<path to aggregator CA cert>
--requestheader-allowed-names=aggregator
--requestheader-extra-headers-prefix=X-Remote-Extra-
--requestheader-group-headers=X-Remote-Group
--requestheader-username-headers=X-Remote-User
--proxy-client-cert-file=<path to aggregator proxy cert>
--proxy-client-key-file=<path to aggregator proxy key>
```

If `kube-proxy` is a no-show on the Master, then this configuration is mandatory:

```bash
--enable-aggregator-routing=true
```

## Building the Extended API

1. Ensure the APIService API is on-board (usually, it is! Verify with `kubectl get apiservice` command)
2. Set up RBAC rules
3. Create a namespace to host your extended API service
4. Generate CA and certificates, vital for https
5. Create a 'secret' safehouse for storing certificates
6. Launch a deployment to serve your extended API service and configure the certificates using the previously generated 'secret', enabling https services
7. Create a ClusterRole and ClusterRoleBinding
8. Create a non-namespace apiservice; remember to set `spec.caBundle`
9. Rollout `kubectl get <resource-name>`; if everything's ticking right, it should return `No resources found.`

Use the [apiserver-builder](https://github.com/kubernetes-incubator/apiserver-builder) tool for a smooth run through the above steps.

```bash
# Initiate project
$ cd GOPATH/src/github.com/my-org/my-project
$ apiserver-boot init repo --domain <your-domain>
$ apiserver-boot init glide

# Create resources
$ apiserver-boot create group version resource --group <group> --version <version> --kind <Kind>

# Compile
$ apiserver-boot build executables
$ apiserver-boot build docs

# Run locally
$ apiserver-boot run local

# Run clustered
$ apiserver-boot run in-cluster --name nameofservicetorun --namespace default --image gcr.io/myrepo/myimage:mytag
$ kubectl create -f sample/<type>.yaml
```

## Examples To Check Out

Visit [sample-apiserver](https://github.com/kubernetes/sample-apiserver) and [apiserver-builder/example](https://github.com/kubernetes-incubator/apiserver-builder/tree/master/example).