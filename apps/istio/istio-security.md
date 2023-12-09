# Secure Management

Istio equips you with the power of RBAC access control, two-way TLS authentication, and key management for superior security management.

## RBAC

Istio's Role-Based Access Control (RBAC) provides you with a grasp on access control at the levels of namespace, service, and method. Here are some of its unique features:

- Simplicity and ease of use: Empowers you with role-based semantics.
- Authentication support: Facilitates both service-to-service, and user-to-service authentication.
- Flexibility: Allows customization of roles and role bindings.

![image-20180423202459184](../../.gitbook/assets/istio-auth%20%282%29.png)

### How to Enable RBAC

RBAC can be enabled via `RbacConfig`, where the 'mode' supports the following options:

- **OFF**: Disable RBAC
- **ON**: Enable RBAC for all services in the mesh.
- **ON\_WITH\_INCLUSION**: Enable RBAC only for namespaces and services included in the `inclusion` field.
- **ON\_WITH\_EXCLUSION**: Enable RBAC for all services in the mesh, except for those included in the `exclusion` field.

Below is an example of enabling RBAC for the `default` namespace:

```yaml
apiVersion: "config.istio.io/v1alpha2"
kind: RbacConfig
metadata:
  name: default
  namespace: istio-system
spec:
  mode: ON_WITH_INCLUSION
  inclusion:
    namespaces: ["default"]
```

### Access Control

Istio RBAC gives you two resource objects, ServiceRole and ServiceRoleBinding, on top of its management via CustomResourceDefinition (CRD).

- ServiceRole: Defines a service role which can access particular resources (within a namespace), supporting a group of services matched with prefix and suffix wildcards.
- ServiceRoleBinding: Provides a binding to give specified roles, i.e., you can specify roles and actions to access a service.

```yaml
apiVersion: "rbac.istio.io/v1alpha1"
kind: ServiceRole
metadata:
  name: products-viewer
  namespace: default
spec:
  rules:
  - services: ["products.default.svc.cluster.local"]
    methods: ["GET", "HEAD"]

---
apiVersion: "rbac.istio.io/v1alpha1"
kind: ServiceRoleBinding
metadata:
  name: test-binding-products
  namespace: default
spec:
  subjects:
  - user: "service-account-a"
  - user: "istio-ingress-service-account"
    properties:
    - request.auth.claims[email]: "a@foo.com"
    roleRef:
    kind: ServiceRole
    name: "products-viewer"
```

## Mutual TLS

Mutual TLS provides TLS authentication for inter-service communication, along with system features to automatically handle key and certificate generation, distribution, replacement, and revocation.

![](../../.gitbook/assets/istio-tls%20%283%29.png)

### How It Works

Istio Auth comprises three elements:

- Identity: Istio uses the Kubernetes service account to recognize a service's identity, formatted as `spiffe://<*domain*>/ns/<*namespace*>/sa/<*serviceaccount*>`
- Secure Communication: End-to-end TLS communication is carried out by server-side and client-side Envoy containers.
- Certificate Management: Istio CA (Certificate Authority) is responsible for generating, distributing (to Pod, via Secret Volume Mount), periodically updating and revoking (if necessary) SPIFEE keys and certificates for each service account. For services not within Kubernetes, CA works collaboratively with Istio node agent for this entire process.

Subsequently, a container uses a certificate in the following way:

- Firstly, Istio CA monitors the Kubernetes API, generates SPIFFE keys and certificates for the service account, and stores them as secrets in Kubernetes.
- Secondly, when creating a Pod, the Kubernetes API Server mounts the secret onto the container.
- Lastly, Pilot generates an access control configuration defining which service account can access the service and distributes it to Envoy.
- So, when communication happens between containers, both sides of the Pod Envoy act upon the access control configuration for authentication.

### Best Practices

- Create different namespaces to manage different teams separately.
- Run the Istio CA in a separate namespace and grant administrator privileges only.

## References

* [Istio Security Documentation](https://istio.io/docs/concepts/security/)
* [Istio Role-Based Access Control \(RBAC\)](https://istio.io/docs/concepts/security/)
* [Istio Mutual TLS Documentation](https://istio.io/docs/concepts/security/#mutual-tls-authentication)
