# Mastering Access Control

Kubernetes holds the fort on API access by employing three principal security control measures: authentication, authorization and admission control. Authentication solves the identity puzzle, answering 'who's there?', while authorization clears up the 'what can they do?' conundrum. The role of admission control, on the other hand, is all about resource management. A balanced permission management framework is key to maintaining system security and reliability.

Kubernetes clusters run practically all operations through the cornerstone component, kube-apiserver, which unfurls an HTTP RESTful API for internal and external client utilization. It's important to note that authentication and authorization processes only occur within the confines of HTTPS APIs. In other words, if a client connects to the kube-apiserver over an HTTP link, authentication and authorization will be conspicuous by their absence. Therefore, it could be deemed wise to use HTTP for communication between internal cluster components and HTTPS for external interactions, effectively striking a harmony between security enhancement and complexity reduction.

The diagram below illustrates the three-step journey of API access, where authentication and authorization precede admission control.

![](../../.gitbook/assets/authentication%20%282%29.png)

## Authentication

When TLS is activated, authentication is the obligatory first checkpoint for all requests. Kubernetes offers a variety of authentication mechanisms, and it's designed to simultaneously support multiple authentication plugins (across which, a single successful authentication suffices). If the authentication is successful, the user’s `username` is forwarded to the authorization module for further validation. Conversely, an authentication failure promptly returns HTTP 401.

> **Kubernetes doesn't play custodian to users**
>
> Even though Kubernetes uses users and groups for authentication and authorization, it doesn't directly manage users nor does it have the capacity to create `user` objects or store user data.

At present, Kubernetes supports the following authentication plugins:

* X509 certificates
* Static Token file
* Bootstrap Token
* Static password file
* Service Account
* OpenID
* Webhook
* Authentication proxy
* OpenStack Keystone password

For a detailed usage guide, please refer to[this link](authentication.md).

## Authorization

Authorization lays the groundwork for controlling access to cluster resources. By contrasting the properties of requests against corresponding access policies, API requests must fulfill certain policy requirements to get processed. Mirroring the authentication setup, Kubernetes espouses several authorization mechanisms and endorses the operation of multiple authorization plugins at once (a lone successful validation suffices here as well). If the authorization proves successful, the user's request advances to the admission control module for additional request verification. On the other hand, failed authorizations beget HTTP 403.

Kubernetes only handles authorization for the following request properties:

* User, group, extra
* API, request methods (such as get, post, update, patch and delete) and request paths (such as `/api`)
* Requested resources and sub-resources
* Namespace
* API Group

Currently, Kubernetes endorses these authorization plugins:

* ABAC
* RBAC
* Webhook
* Node

> **AlwaysDeny and AlwaysAllow**
>
> Kubernetes also supports AlwaysDeny and AlwaysAllow modes, where AlwaysDeny is purely a testing tool, while AlwaysAllow gives all requests a green light (and overrules other modes).

### ABAC Authorization

Implementing ABAC authorization commands the API Server to configure `--authorization-policy-file=SOME_FILENAME`, with the file format constituting one JSON object per line, like so:

```javascript
{
    "apiVersion": "abac.authorization.kubernetes.io/v1beta1",
    "kind": "Policy",
    "spec": {
        "group": "system:authenticated",
        "nonResourcePath": "*",
        "readonly": true
    }
}
{
    "apiVersion": "abac.authorization.kubernetes.io/v1beta1",
    "kind": "Policy",
    "spec": {
        "group": "system:unauthenticated",
        "nonResourcePath": "*",
        "readonly": true
    }
}
{
    "apiVersion": "abac.authorization.kubernetes.io/v1beta1",
    "kind": "Policy",
    "spec": {
        "user": "admin",
        "namespace": "*",
        "resource": "*",
        "apiGroup": "*"
    }
}
```

### RBAC Authorization

See [RBAC Authorization](rbac.md).

### WebHook Authorization

To leverage WebHook authorization, the API Server needs to configure `--authorization-webhook-config-file=SOME_FILENAME and --runtime-config=authorization.k8s.io/v1beta1=true`. The configuration file format is akin to kubeconfig:

```yaml
# clusters refers to the remote service.
clusters:
  - name: name-of-remote-authz-service
    cluster:
      # CA for verifying the remote service.
      certificate-authority: /path/to/ca.pem
      # URL of remote service to query. Must use 'https'.
      server: https://authz.example.com/authorize

# users refers to the API Server's webhook configuration.
users:
  - name: name-of-api-server
    user:
      # cert for the webhook plugin to use 
      client-certificate: /path/to/cert.pem
       # key matching the cert
      client-key: /path/to/key.pem

# kubeconfig files require a context. Provide one for the API Server.
current-context: webhook
contexts:
- context:
    cluster: name-of-remote-authz-service
    user: name-of-api-server
  name: webhook
```

The API Server's request format to the Webhook server should look like this:

```javascript
{
  "apiVersion": "authorization.k8s.io/v1beta1",
  "kind": "SubjectAccessReview",
  "spec": {
    "resourceAttributes": {
      "namespace": "kittensandponies",
      "verb": "get",
      "group": "unicorn.example.org",
      "resource": "pods"
    },
    "user": "jane",
    "group": [
      "group1",
      "group2"
    ]
  }
}
```

The Webhook server must return an authorization response, either approving (allowed=true) or denying (allowed=false):

```javascript
{
  "apiVersion": "authorization.k8s.io/v1beta1",
  "kind": "SubjectAccessReview",
  "status": {
    "allowed": true
  }
}
```

### Node Authorization

Version 1.7 and onwards support Node authorization, with the `NodeRestriction` admission control limiting kubelet to accessing node-related resources, endpoint, pod, service, as well as secret, configmap, PV and PVC, etc. Configuration requires:

`--authorization-mode=Node,RBAC --admission-control=...,NodeRestriction,...`

Do note, kubelet authentication necessitates the use of the `system:nodes` group and the username must be `system:node:<nodeName>`.

## Reference Documents

* [Authenticating](https://kubernetes.io/docs/admin/authentication/)
* [Authorization](https://kubernetes.io/docs/admin/authorization/)
* [Bootstrap Tokens](https://kubernetes.io/docs/admin/bootstrap-tokens/)
* [Managing Service Accounts](https://kubernetes.io/docs/admin/service-accounts-admin/)
* [ABAC Mode](https://kubernetes.io/docs/admin/authorization/abac/)
* [Webhook Mode](https://kubernetes.io/docs/admin/authorization/webhook/)
* [Node Authorization](https://kubernetes.io/docs/admin/authorization/node/)