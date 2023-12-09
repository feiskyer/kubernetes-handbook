# Ingress Terms Demystified 

This article will help you make sense of terms common to Kubernetes that you may often encounter used interchangeably elsewhere, in order to prevent confusion. 

* Node: a server in a Kubernetes cluster;
* Cluster: a group of servers managed by Kubernetes;
* Edge router: a router that routes data packets between a local area network and the internet, with the additional function as a firewall protecting the local network;
* Cluster network: a specific implementation of networking that adheres to Kubernetes' [networking model](https://kubernetes.io/docs/admin/networking/), for example, [flannel](https://github.com/coreos/flannel#flannel) and [OVS](https://github.com/openvswitch/ovn-kubernetes); 
* Service: A Kubernetes service is a group of pods identified by label selectors [Service](https://kubernetes.io/docs/user-guide/services/). Unless stated otherwise, the virtual IP of a service is only accessible within the cluster.

## What is Ingress?

Typically, service and pod IP addresses are only accessible within the cluster. External requests must be routed via a load balancer that directs them to a NodePort exposed on a node, which is then handled by the kube-proxy via an edge router. This process either forwards the requests to the relevant pod or discards them, like the illustration below.

```text
   internet
        |
  ------------
  [Services]
```

Ingress is simply a set of rules that help route requests entering the cluster, as shown in the following figure. 

![image-20190316184154726](../../.gitbook/assets/image-20190316184154726%20%281%29.png)

Ingress offers load balancing, public URLs, SSL termination, and HTTP routing for services outside the cluster. To set these Ingress rules, a cluster administrator needs to deploy an [Ingress controller](../../extension/ingress/). The controller listens for changes in Ingress and services, and based on the rules, it configures load balancing and makes the necessary access provisions.

## Ingress Format

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: test-ingress
spec:
  rules:
  - http:
      paths:
      - path: /testpath
        backend:
          serviceName: test
          servicePort: 80
```

Each Ingress rule needs to be configured. At present, Kubernetes only supports HTTP rules. The above example shows that when a request is made to '/testpath', it gets routed to the service 'test' on port 80.

## API Version Table

| Kubernetes Version | Extension Version |
| :--- | :--- |
| v1.5-v1.17 | extensions/v1beta1 |
| v1.8-v1.18 | networking.k8s.io/v1beta1 |
| v1.19+     | networking.k8s.io/v1 |

## Types of Ingress

Based on the configuration of the Ingress Spec, Ingress can be divided into the following types:

### Single-service Ingress

Single-service Ingress refers to an Ingress that only points to one backend service without any rules.

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: test-ingress
spec:
  backend:
    serviceName: testsvc
    servicePort: 80
```

> Note: A single service can be exposed externally by setting `Service.Type=NodePort` or `Service.Type=LoadBalancer`.

### Multi-service Ingress

Routing-to-multi-service Ingress refers to different backend services being routed according to the request path.

```text
foo.bar.com -> 178.91.123.132 -> / foo    s1:80
                                 / bar    s2:80
```

The following Ingress defines the above:

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: test
spec:
  rules:
  - host: foo.bar.com
    http:
      paths:
      - path: /foo
        backend:
          serviceName: s1
          servicePort: 80
      - path: /bar
        backend:
          serviceName: s2
          servicePort: 80
```

After creating the ingress with `kubectl create -f`:

```bash
$ kubectl get ing
NAME      RULE          BACKEND   ADDRESS
test      -
          foo.bar.com
          /foo          s1:80
          /bar          s2:80
```

### Virtual Host Ingress

Virtual host Ingress refers to different backend services being routed based on different names but sharing the same IP address.

```text
foo.bar.com --|                 |-> foo.bar.com s1:80
              | 178.91.123.132  |
bar.foo.com --|                 |-> bar.foo.com s2:80
```

The following Ingress routes a request based on the [Host Header](https://tools.ietf.org/html/rfc7230#section-5.4) :

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: test
spec:
  rules:
  - host: foo.bar.com
    http:
      paths:
      - backend:
          serviceName: s1
          servicePort: 80
  - host: bar.foo.com
    http:
      paths:
      - backend:
          serviceName: s2
          servicePort: 80
```

> Note: A backend service that has no default rule definition is called the default backend service, which can easily handle 404 pages.

### TLS Ingress

TLS Ingress obtains TLS private keys and certificates (named 'tls.crt' and 'tls.key') via Secret to perform TLS termination. If the TLS configuration part of Ingress specifies different hosts, these hosts will be reused on multiple same ports based on the host name specified by the SNI TLS extension—if the Ingress controller supports SNI.

Define a secret containing 'tls.crt' and 'tls.key':

```yaml
apiVersion: v1
data:
  tls.crt: base64 encoded cert
  tls.key: base64 encoded key
kind: Secret
metadata:
  name: testsecret
  namespace: default
type: Opaque
```

The secret is referenced in Ingress:

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: no-rules-map
spec:
  tls:
    - secretName: testsecret
  backend:
    serviceName: s1
    servicePort: 80
```

Take note, different Ingress controllers support different TLS functionalities. Please refer to the documentation on [nginx](https://kubernetes.github.io/ingress-nginx/), [GCE](https://github.com/kubernetes/ingress-gce) or any other Ingress controller to learn about their TLS support.

## Updating Ingress

You can update Ingress with the `kubectl edit ing name` command:

```bash
$ kubectl get ing
NAME      RULE          BACKEND   ADDRESS
test      -                       178.91.123.132
          foo.bar.com
          /foo          s1:80
$ kubectl edit ing test
```

This opens an editor containing the existing IngressSpec yaml file. After editing and saving, it updates the Kubernetes API server, triggering the Ingress Controller to reconfigure load balancing:

```yaml
spec:
  rules:
  - host: foo.bar.com
    http:
      paths:
      - backend:
          serviceName: s1
          servicePort: 80
        path: /foo
  - host: bar.baz.com
    http:
      paths:
      - backend:
          serviceName: s2
          servicePort: 80
        path: /foo
..
```

After the update:

```bash
$ kubectl get ing
NAME      RULE          BACKEND   ADDRESS
test      -                       178.91.123.132
          foo.bar.com
          /foo          s1:80
          bar.baz.com
          /foo          s2:80
```

Of course, you can also update it with the `kubectl replace -f new-ingress.yaml` command, where new-ingress.yaml is the modified Ingress yaml.

## Ingress Controller

The normal operation of Ingress requires the running of an Ingress Controller in the cluster. The Ingress Controller is different from other controllers that automatically start when the cluster is created as part of kube-controller-manager—it requires users to choose an Ingress Controller that suits their cluster, or implement one themselves.

Ingress Controller is deployed as a Kubernetes Pod and runs as a daemon, constantly watching the /ingress interface of Apiserver to update Ingress resources to meet Ingress requests. For example, you can use the [Nginx Ingress Controller](https://github.com/kubernetes/ingress-nginx):

```bash
helm install stable/nginx-ingress --name nginx-ingress --set rbac.create=true
```

Other Ingress Controllers available:

* [traefik ingress](../../extension/ingress/service-discovery-and-load-balancing.md) gives a practical example of a Traefik Ingress Controller
* [kubernetes/ingress-nginx](https://github.com/kubernetes/ingress-nginx) provides a detailed example of an Nginx Ingress Controller
* [kubernetes/ingress-gce](https://github.com/kubernetes/ingress-gce) provides an example of an Ingress Controller for GCE

## Ingress Class

Before Ingress Class, to choose a specific Controller for Ingress required adding a special annotation (like kubernetes.io/ingress.class: nginx). But with IngressClass, cluster administrators can pre-create supported Ingress types, which can then be referenced directly in Ingress.

```yaml
apiVersion: networking.k8s.io/v1
kind: IngressClass
metadata:
  name: external-lb
spec:
  controller: example.com/ingress-controller
  parameters:
    apiGroup: k8s.example.com
    kind: IngressParameters
    name: external-lb
```

## References

* [Kubernetes Ingress Resource](https://kubernetes.io/docs/concepts/services-networking/ingress/)
* [Kubernetes Ingress Controller](https://github.com/kubernetes/ingress/tree/master)
* [Using NGINX Plus to Load Balance Kubernetes Services](http://dockone.io/article/957)
* [Load Balancing Kubernetes with Ingress Controller using NGINX and NGINX Plus](http://www.cnblogs.com/276815076/p/6407101.html)
* [Kubernetes Ingress Controller-Træfɪk](https://doc.traefik.io/traefik/providers/kubernetes-ingress/)
* [Kubernetes 1.2 and simplifying advanced networking with Ingress](https://kubernetes.io/blog/2016/03/kubernetes-1-2-and-simplifying-advanced-networking-with-ingress/)