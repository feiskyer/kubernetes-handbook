# kube-apiserver: The Core of Kubernetes in Plain Terms

Kube-apiserver might seem like a tongue-twisting piece of jargon. But it is actually central to the operation of Kubernetes, a popular open-source platform used to automate the deployment, scaling, and management of applications. Here's a deep-dive into knowing what it does.

Kube-apiserver plays two key roles. First, it provides the REST API interface for cluster management tasks - including authentication, authorization, data validation, and cluster state changes. Second, it acts as a hub for data exchange and communication between other Kubernetes modules. These modules can use APIs to query or modify data, with only the API Server having direct access to the etcd, the distributed database storing all Kubernetes configuration data.

## The Two Roads to the API

Kube-apiserver offers both https and non-secure http API access. The former, https, is, by default, linked to port number 6443. The http API is generally accessed via '127.0.0.1' at port 8080. It's crucial to note here that the http API isn't recommended for use in production environments as it lacks any authentication protocols. A user can access these interfaces and their identical REST API formats by referring to the [Kubernetes API Reference](https://kubernetes.io/docs/reference/kubernetes-api/). 

Usage commonly occurs through the [kubectl](https://kubernetes.io/docs/user-guide/kubectl-overview/) command-line tool or clients developed in various programming languages available for Kubernetes. Helpful inscriptions, such as the format of each API call, become visible when activating debug log during kubectl usage, like so:

```bash
$ kubectl --v=8 get pods
```

One can use `kubectl api-versions` and `kubectl api-resources` to find out about the API versions and resource objects that Kubernetes API supports, as demonstrated below:

```bash
$ kubectl api-versions
admissionregistration.k8s.io/v1beta1
...

$ kubectl api-resources --api-group=storage.k8s.io
NAME                SHORTNAMES   APIGROUP         NAMESPACED   KIND
storageclasses      sc           storage.k8s.io   false        StorageClass
...
```

## Integration with OpenAPI and Swagger

OpenAPI and Swagger API can be viewed at `/swaggerapi` and `/openapi/v2`, respectively. Once the `--enable-swagger-ui=true` command activates the Swagger UI, it becomes accessible via `/swagger-ui`. Fun fact - OpenAPI actually allows for the development of clients in various languages. For instance, the following command generates one for the Go language:

```bash
git clone https://github.com/kubernetes-client/gen /tmp/gen
cat >go.settings <<EOF
export KUBERNETES_BRANCH="release-1.11"
export CLIENT_VERSION="1.0"
export PACKAGE_NAME="client-go"
EOF
/tmp/gen/openapi/go.sh ./client-go ./go.settings
```

## Access Control & Security You Can Trust

Access to every Kubernetes API request only happens after several tiers of access control - these include authentication, authorization, and admission control. During authentication, requests have to pass checks from several authentication mechanisms supported by Kubernetes. Once authenticated, a user's `username` progresses to the authorization stage. Unsuccessful authentication attempts receive an HTTP 401 response. 

It's noteworthy that even though Kubernetes uses a username for authentication and authorization, it doesn't directly manage users or store their details.

Post-authentication, the request reaches the authorization stage. Like authentication, Kubernetes supports multiple authorization mechanisms and can simultaneously run several authorization plug-ins (success in one is sufficient). After a request successfully passes this stage, it gets sent to the admission control phase for further verification. Unsuccessful attempts at authorization receive an HTTP 403 response. 

Admission control, the last stage of access control, validates requests and adds default parameters. This stage attends to the contents of requests and is only valid for create, update, delete, or connect operations, but not the read operations. Several plug-ins can operate simultaneously at this stage, with a request only allowed to enter the system after all activated plug-ins approve it.

All-in-all, Kubernetes provides a secure environment for applications to function.

## Winding Down

In short, the kube-apiserver provides the REST API for Kubernetes and manages key security checks like authentication, authorization, and admission control. Apart from this, it handles the operational status of the cluster (using etcd).

Fun fact - there are several ways to access the Kubernetes REST API. The [kubectl](kubectl.md) command-line tool, or SDKs supporting multiple languages like [Go](https://github.com/kubernetes/client-go), [Python](https://github.com/kubernetes-incubator/client-python), [Javascript](https://github.com/kubernetes-client/javascript), [Java](https://github.com/kubernetes-client/java), [CSharp](https://github.com/kubernetes-client/csharp), and others supporting [OpenAPI](https://www.openapis.org/), achievable through the [gen](https://github.com/kubernetes-client/gen) tool to generate their respective clients.

There's a lot more to learn about the kube-apiserver, and Kubernetes overall. Do check out the API reference documents for versions [v1.21 API Reference](https://kubernetes.io/docs/reference/kubernetes-api/), [v1.20 API Reference](https://v1-20.docs.kubernetes.io/docs/reference/kubernetes-api/), and [v1.19 API Reference](https://v1-19.docs.kubernetes.io/docs/reference/generated/kubernetes-api/v1.19/) to dig deeper.