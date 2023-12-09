# Service

From the outset, Kubernetes incorporated mechanisms for container service discovery and load balancing, establishing the Service resource and, in conjunction with kube-proxy and cloud provider, adapted it to different application scenarios. With the explosive growth of Kubernetes users and increasingly diverse user scenarios, some new load balancing mechanisms have emerged. Currently, the load balancing mechanisms in Kubernetes can be roughly classified into the following categories, each with its specific application scenario:

* Service: Directly uses Service to provide internal cluster load balancing, and leverages the LB provided by the cloud provider for external access.
* Ingress Controller: Still uses Service for internal cluster load balancing, but external access is enabled via customized Ingress Controller.
* Service Load Balancer: Runs the load balancer directly in the container, implementing Bare Metal's Service Load Balancer.
* Custom Load Balancer: Customized load balancing replaces kube-proxy and is usually used when deploying Kubernetes physically, facilitating the connection to existing external services in the company.

## Service

![](../../.gitbook/assets/14735737093456%20%284%29.jpg)

A Service is an abstraction of a group of Pods providing the same functionality, providing them with a unified access point. With Service, applications can easily implement service discovery and load balancing, as well as zero-downtime upgrades. Service selects service backends through labels, usually working with Replication Controller or Deployment to ensure the normal operation of backend containers. The Pod IPs and port lists matching these labels form endpoints, with kube-proxy responsible for load balancing the service IP to these endpoints.

There are four types of Service:

* ClusterIP: Default type, automatically assigns a virtual IP that can only be accessed internally by the cluster.
* NodePort: Based on ClusterIP, binds a port for the Service on each machine, allowing access to the service through `<NodeIP>:NodePort`. If kube-proxy has set `--nodeport-addresses=10.240.0.0/16` (supported by v1.10), then this NodePort is only valid for IPs set within this range.
* LoadBalancer: Based on NodePort, creates an external load balancer with the help of the cloud provider, redirecting requests to `<NodeIP>:NodePort`.
* ExternalName: Redirects the service to a specified domain (set through `spec.externlName`) via DNS CNAME record. Requires kube-dns version 1.7 or later.

Additionally, existing services can be added to the Kubernetes cluster in Service format. When creating a Service, do not specify a Label selector. Instead, manually add an endpoint after the Service is created.

### Service Definition

A Service is defined through yaml or json, such as the below example that defines a service called nginx, which forwards the service's port 80 to port 80 of the Pod labeled `run=nginx` in the default namespace.

```yaml
apiVersion: v1
kind: Service
metadata:
  labels:
    run: nginx
  name: nginx
  namespace: default
spec:
  ports:
  - port: 80
    protocol: TCP
    targetPort: 80
  selector:
    run: nginx
  sessionAffinity: None
  type: ClusterIP
```

```bash
# service automatically allocated Cluster IP 10.0.0.108
$ kubectl get service nginx
NAME      CLUSTER-IP   EXTERNAL-IP   PORT(S)   AGE
nginx     10.0.0.108   <none>        80/TCP    18m
# automatically created endpoint
$ kubectl get endpoints nginx
NAME      ENDPOINTS       AGE
nginx     172.17.0.5:80   18m
# Service automatically associates endpoint
$ kubectl describe service nginx
Name:            nginx
Namespace:        default
Labels:            run=nginx
Annotations:        <none>
Selector:        run=nginx
Type:            ClusterIP
IP:            10.0.0.108
Port:            <unset>    80/TCP
Endpoints:        172.17.0.5:80
Session Affinity:    None
Events:            <none>
```

When the service requires multiple ports, each port must be given a name.

```yaml
kind: Service
apiVersion: v1
metadata:
  name: my-service
spec:
  selector:
    app: MyApp
  ports:
  - name: http
    protocol: TCP
    port: 80
    targetPort: 9376
  - name: https
    protocol: TCP
    port: 443
    targetPort: 9377
```

### Protocol

Service, Endpoints, and Pod support three types of protocols:

* TCP (Transmission Control Protocol) is a connection-oriented, reliable, byte-stream transport layer communication protocol.
* UDP (User Datagram Protocol) is a connectionless transport layer protocol used for unreliable information delivery services.
* SCTP (Stream Control Transmission Protocol) is used to transmit SCN (Signaling Communication Network) narrow band signaling messages over IP networks.

### API Version Comparison Table

| Kubernetes Version | Core API Version |
| :--- | :--- |
| v1.5+ | core/v1 |

### Services Without Specified Selectors

When creating a Service, you can also choose not to specify Selectors, used to forward the service to services outside the Kubernetes cluster (instead of to Pods). At present, two methods are supported:

(1) Custom endpoints, that is, create a service and endpoint of the same name and set the IP and port of the external service in the endpoint.

```yaml
kind: Service
apiVersion: v1
metadata:
  name: my-service
spec:
  ports:
    - protocol: TCP
      port: 80
      targetPort: 9376
---
kind: Endpoints
apiVersion: v1
metadata:
  name: my-service
subsets:
  - addresses:
      - ip: 1.2.3.4
    ports:
      - port: 9376
```

(2) Forwarding via DNS, specifying externalName in the service definition. In this case, the DNS service will create a CNAME record for `<service-name>.<namespace>.svc.cluster.local`, with its value set to `my.database.example.com`. Moreover, the service will not be automatically assigned a Cluster IP and needs to be accessed through the service's DNS.

```yaml
kind: Service
apiVersion: v1
metadata:
  name: my-service
  namespace: default
spec:
  type: ExternalName
  externalName: my.database.example.com
```

Note: The IP address of the Endpoints cannot be 127.0.0.0/8, 169.254.0.0/16 or 224.0.0.0/24, nor can it be the clusterIP of other services in Kubernetes.

### Headless Service

A Headless Service is one that does not require a Cluster IP. This is specified when creating a service by setting `spec.clusterIP=None`. This includes two types:

* No Selectors specified but an externalName is set (See above 2), handled by the CNAME record.
* Selectors specified, with a DNS A record setting the backend endpoint list.

```yaml
apiVersion: v1
kind: Service
metadata:
  labels:
    app: nginx
  name: nginx
spec:
  clusterIP: None
  ports:
  - name: tcp-80-80-3b6tl
    port: 80
    protocol: TCP
    targetPort: 80
  selector:
    app: nginx
  sessionAffinity: None
  type: ClusterIP
---
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  labels:
    app: nginx
  name: nginx
  namespace: default
spec:
  replicas: 2
  revisionHistoryLimit: 5
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - image: nginx:latest
        imagePullPolicy: Always
        name: nginx
        resources:
          limits:
            memory: 128Mi
          requests:
            cpu: 200m
            memory: 128Mi
      dnsPolicy: ClusterFirst
      restartPolicy: Always
```

```bash
# Query the created nginx service
$ kubectl get service --all-namespaces=true
NAMESPACE     NAME         CLUSTER-IP      EXTERNAL-IP      PORT(S)         AGE
default       nginx        None            <none>           80/TCP          5m
kube-system   kube-dns     172.26.255.70   <none>           53/UDP,53/TCP   1d
$ kubectl get pod
NAME                       READY     STATUS    RESTARTS   AGE       IP           NODE
nginx-2204978904-6o5dg     1/1       Running   0          14s       172.26.2.5   10.0.0.2
nginx-2204978904-qyilx     1/1       Running   0          14s       172.26.1.5   10.0.0.8
$ dig @172.26.255.70  nginx.default.svc.cluster.local
;; ANSWER SECTION:
nginx.default.svc.cluster.local. 30 IN    A    172.26.1.5
nginx.default.svc.cluster.local. 30 IN    A    172.26.2.5
```

Note: Some of the information queried in the dig command is omitted.

## Preserving Source IP

Different types of Service handle the source IP differently:

* ClusterIP Service: Using iptables mode, the source IP within the cluster is retained (no SNAT). If the client and server pod are on the same Node, the source IP is the IP address of the client pod; if on different Nodes, the source IP depends on how the network plugin handles it. For instance, when using flannel, the source IP is the node flannel IP address.
* NodePort Service: By default, the source IP would undergo SNAT, and the server pod would see the source IP as Node IP. To avoid this, the service can be set to `spec.ExternalTrafficPolicy=Local` (for versions 1.6-1.7, set Annotation `service.beta.kubernetes.io/external-traffic=OnlyLocal`), allowing the service to proxy requests for local endpoints only (if there are no local endpoints, the packets are directly dropped), thus retaining the source IP.
* LoadBalancer Service: By default, the source IP would undergo SNAT, and the server pod sees the source IP as Node IP. After setting `service.spec.ExternalTrafficPolicy=Local`, the Node without local endpoints will be automatically removed from the cloud platform load balancer, thus retaining the source IP.

## Internal Network Policy

By default, Kubernetes considers all Endpoints IP in the cluster to be Service backends. By setting `.spec.internalTrafficPolicy=Local`, kube-proxy will only load balance for local Endpoints on the Node.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  selector:
    app: MyApp
  ports:
    - protocol: TCP
      port: 80
      targetPort: 9376
  internalTrafficPolicy: Local
```

Note, with the internal network policy enabled, even if other Nodes have functioning Endpoints, if there are no Pods running locally on the Node, the Service will be inaccessible.

## How it Works

kube-proxy is responsible for load balancing the service to the backend Pod, as shown in the diagram:

![service-flow](../../.gitbook/assets/service-flow%20%284%29.png)

## Ingress

Although Service solves the problems of service discovery and load balancing, it still has some limitations in use, for example:

- It only supports layer 4 load balancing and lacks layer 7 functionality.
- For external access, NodePort type requires additional load balancing at the external, whereas LoadBalancer requires Kubernetes to run on a supported cloud provider.

Ingress is a newly introduced resource designed to address these limitations, mainly used to expose services outside the cluster and allows customizing service access policies. For instance, if you want to access different services through different subdomains via a load balancer:

```text
foo.bar.com --|                 |-> foo.bar.com s1:80
              | 178.91.123.132  |
bar.foo.com --|                 |-> bar.foo.com s2:80
```

You can define Ingress like this:

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

Note the Ingress itself does not automatically create a load balancer, an ingress controller needs to be operating within the cluster managing the load balancer according to the Ingress definition. The community currently provides reference implementations for nginx and gce.

Traefik offers an easy-to-use Ingress Controller, the use of which is explained at [https://doc.traefik.io/traefik/providers/kubernetes-ingress/](https://doc.traefik.io/traefik/providers/kubernetes-ingress/).

For a more in-depth introduction to Ingress and Ingress Controller, see [ingress](ingress.md).

## Service Load Balancer

Before the introduction of Ingress, [Service Load Balancer](https://github.com/kubernetes/contrib/tree/master/service-loadbalancer) was the recommended method to address the limitations of Service. Service Load Balancer runs haproxy in containers and monitors changes in service and endpoints, providing layer 4 and layer 7 load balancing services through container IP.

The community provided Service Load Balancer supports four load balancing protocols: TCP, HTTP, HTTPS and SSL TERMINATION, and also supports ACL access control.

> Note: Service Load Balancer is no longer recommended for use. The use of [Ingress Controller](ingress.md) is recommended instead.

## Custom Load Balancer

Despite Kubernetes offering a variety of load balancing mechanisms, in practice, some complex scenarios are unsupported, such as:

* Connecting to existing load balancing equipment
* In multi-tenant network situations, the container network and host network are isolated, rendering `kube-proxy` dysfunctional.

At these times, components can be customized and used to replace kube-proxy for load balancing. The basic idea is to monitor changes in service and endpoints in Kubernetes and configure the load balancer according to these changes, seen in weave flux, nginx plus, kube2haproxy, and more.

## External Cluster Access to Service

A Service's ClusterIP is an internal virtual IP address in Kubernetes that cannot be accessed directly from outside. But what if it's necessary to access these services from the outside? There are several ways:

* Use NodePort service to bind a port on each machine, allowing access to the service through `<NodeIP>:NodePort`.
* Use LoadBalancer service to create an external load balancer with the help of Cloud Provider, redirecting requests to `<NodeIP>:NodePort`. This method is only applicable to Kubernetes clusters running on the cloud platform. For clusters deployed on physical machines, [MetalLB](https://github.com/google/metallb) can implement similar functionality.
* Create L7 load balancing atop Service through Ingress Controller and open it to the public.
* Use [ECMP](https://en.wikipedia.org/wiki/Equal-cost_multi-path_routing) to route the Service ClusterIP network segment to each Node, allowing direct access through ClusterIP and even direct use of kube-dns outside the cluster. This method is applied in situations of depolyment on physical machines.

## References

* [https://kubernetes.io/docs/concepts/services-networking/service/](https://kubernetes.io/docs/concepts/services-networking/service/)
* [https://kubernetes.io/docs/concepts/services-networking/ingress/](https://kubernetes.io/docs/concepts/services-networking/ingress/)
* [https://github.com/kubernetes/contrib/tree/master/service-loadbalancer](https://github.com/kubernetes/contrib/tree/master/service-loadbalancer)
* [https://www.nginx.com/blog/load-balancing-kubernetes-services-nginx-plus/](https://www.nginx.com/blog/load-balancing-kubernetes-services-nginx-plus/)
* [https://github