# NetworkPolicy for Microservices

With the rise of microservices, an increasing number of cloud service platforms are becoming dependent on network communication between numerous modules. Introduced in Kubernetes 1.3, Network Policy provides policy-based network control to isolate applications and reduce attack surfaces. It employs label selectors to simulate traditional segmented networks, controlling traffic between them and managing incoming traffic from external sources.

When working with Network Policy, keep in mind:

* Version 1.6 and earlier require `extensions/v1beta1/networkpolicies` to be enabled in kube-apiserver. 
* As of version 1.7, Network Policy has reached General Availability (GA) with the API version `networking.k8s.io/v1`. 
* Version 1.8 introduced support for **Egress** and **IPBlock**. 
* Version 1.21 adds **endPort** support for setting the port range (requires configuration `--feature-gates=NetworkPolicyEndPort=true`).
* Network plugins such as Calico, Romana, Weave Net, and trireme that support Network Policy are needed. Refer [here](../../extension/network-policy.md) for more details.

## API Version Chart

| Kubernetes Version | Networking API Version |
| :----------------: | :----------------------: |
|  v1.5 - v1.6  | extensions/v1beta1 |
|  v1.7+  | networking.k8s.io/v1 |

## Network Policies

### Namespace Isolation

By default, all Pods can freely communicate with each other. Each Namespace can configure an independent network policy to isolate traffic between Pods. 

On v1.7+ versions, creating a Network Policy that matches all Pods serves as the default network policy, such as the default rejection of all Ingress communication between Pods.

On the flip side, v1.6 uses Annotations to isolate traffic between all the Pods in a namespace from all Pods' external traffic to the namespace and traffic between Pods within the namespace.

### Pod Isolation

It is possible to manage traffic between Pods using label selectors, including namespaceSelector and podSelector. For instance, the following Network Policy does the following:

* Allows Pods with the `role=frontend` label in the default namespace to access TCP port 6379 of Pods with the `role=db` label in the default namespace.
* Allows all Pods in namespaces with the `project=myprojects` label to access TCP port 6379 of Pods with the `role=db` label in the default namespace.

## Quick Example

To see Network Policy in action, let's utilize calico as an instance.

First, configure kubelet to use the CNI network plugin. 

Install the calico network plugin. 

Then, deploy an nginx service. At this point, nginx can be accessed by other Pods.

When we enable the DefaultDeny Network Policy for the default namespace, other Pods (including those outside of the namespace) can't reach nginx anymore:

At last, by implementing a network policy that allows access from Pods labelled with `access=true`, only authorized Pods are able to communicate with the nginx service.

# Use Cases

### Blocking Access to Certain Services
 
The network policy denies every other Pod from sending traffic to the appointed service.

### Allowing Only Certain Pods to Access Services

The network policy allows only specified Pods to send traffic to the appointed service.

### Prohibit Intercommunication Among Pods in the Same Namespace

Disables the ability for Pods within the same namespace to communicate with each other.

### Preventing Other Namespaces From Accessing Services

The network policy restricts all Pods outside the namespace from reaching an assigned service.

### Allowing Only Specific Namespace to Access Services 

The network policy allows only certain namespaces to send traffic to the designated service.

### Enabling External Access to Service

The applied network policy allows traffic from the external network to reach a specific service within the Kubernetes cluster.

# Unsupported Use Cases

While Network Policy covers a wide spectrum of applications, there are certain scenarios it does not support, including:

- Forcing intra-cluster traffic to pass through a common gateway.
- Situations related to Transport Layer Security (TLS).
- Policies specific to nodes.
- Policies that identify targets based on names.
- Generating network security event logs.
- Blocking localhost access or access requests from the hosting node.
  
## Further Reading

Here are some resources that provide more information on Network Policies in Kubernetes:

* [Kubernetes network policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
* [Declare Network Policy](https://kubernetes.io/docs/tasks/administer-cluster/declare-network-policy/)
* [Securing Kubernetes Cluster Networking](https://ahmet.im/blog/kubernetes-network-policy/)
* [Kubernetes Network Policy Recipes](https://github.com/ahmetb/kubernetes-networkpolicy-tutorial)