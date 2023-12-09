# Istio

Istio is the brainchild of tech giants Google, IBM, and Lyft. It's an open-source service mesh framework designed to take the complexity out of managing the discoverability, connectivity, administration, surveillance, and security of a multitude of microservices. The magic of Istio is that it's invisible to applications and performs its myriad of services without requiring any modifications to the service code.

Here are some of the superpowers Istio possesses:

* Automatic load balancing for HTTP, gRPC, WebSocket, and TCP networking traffic
* Fine-tuned control over networking traffic behaviors like sophisticated routing rules, retries, fault transfers, and fault injections
* Optional policy layers and configuration APIs for access control, rate limiting, and quota management
* Auto metrics, logging, and tracking for all inbound and outbound traffic
* Robust authentication and authorization system that lets services talk to each other in a safe and secure manner

## How Istio Works Its Magic

Logically, Istio divides and conquers by splitting itself into data and control planes:

* The **data plane** is made up of a slew of smart proxies—defaulting to Envoy—that handle network communications among the microservices
* The **control plane** manages and configures these proxies for traffic routing and configures a Mixer for policy enforcement and telemetry data gathering

Istio's architecture looks something like this:

![](../../.gitbook/assets/istio-arch%20%284%29.png)

It consists mainly of the following elements:

* [Envoy](https://www.envoyproxy.io//): An efficient, open-source proxy created by Lyft, Envoy mediates inbound and outbound traffic for all services within the service mesh. It comes with a rich toolbox filled with features like dynamic service discovery, load balancing, TLS termination, HTTP/2 and gRPC proxy, circuit breaker, health check, fault injection, and performance metrics. Built as a sidecar, it gets deployed alongside the related service's Pod, eliminating the need for code rewrites or redesigns.
* Mixer: Enforces access control and policies while also collecting telemetry data from Envoy proxies. It comes with a flexible plugin model for expandability, which accommodates various backends including GCP, AWS, Prometheus, Heapster, and more.
* Pilot: Responsible for managing the lifecycle of Envoy instances dynamically, providing service discovery, smart routing, and managing traffic resilience such as timeouts and retries. It translates traffic management strategies into configurations for the Envoy data plane and distributes them to the sidecars.
* [Pilot](https://istio.io/zh/docs/concepts/traffic-management/#pilot-%E5%92%8C-envoy) also provides service discovery for Envoy sidecars, offering traffic management functions for smart routing (e.g., A/B testing, canary releases) and resilience (timeouts, retries, circuit breakers). It hyperbolizes complex routing rules for traffic control into Envoy-specific configurations and propagates them to the sidecars during runtime. Pilot also abstracts service discovery mechanisms into a format compatible with the [Envoy data plane API](https://github.com/envoyproxy/data-plane-api), permitting operation in various environments while maintaining the same operational interfaces for traffic management.
* Citadel: Strengthens inter-service and end-user authentication via built-in identity and credential management. Supports role-based access control and policy execution based on service identity.

![](../../.gitbook/assets/istio-service%20%283%29.png)

In the data plane, besides [Envoy](https://www.envoyproxy.io), there are other options such as [nginxmesh](https://github.com/nginmesh/nginmesh) and [linkerd](https://linkerd.io/getting-started) as network proxies. When utilizing nginxmesh, the control plane of Istio (Pilot, Mixer, Auth) remains intact, only the Nginx Sidecar replaces Envoy:

![](../../.gitbook/assets/nginx_sidecar%20%281%29.png)

## Installation

For step-by-step installation instructions of Istio, please refer to [this page](istio-deploy.md).

## Requirements for Pods Before Sidecar Container Injection

Pods must meet certain criteria before getting injected with a Sidecar container and, in turn, becoming part of the service mesh. Istio requires Pods to:

* Be associated with and uniquely belong to a single service—multi-service Pods aren't supported
* Have named ports, conforming to the `<protocol>[-<suffix>]` format, where the protocol can be `http`, `http2`, `grpc`, `mongo`, or `redis`. Unnamed ports are treated as TCP traffic
* It's recommended to include an `app` label in all Deployments to add context information to distributed traces

## Sample Application

> The following steps assume that the terminal is in the `istio-${ISTIO_VERSION}` directory, which was downloaded during the [installation deployment](istio-deploy.md).

### Manual Injection of Sidecar Container

During application deployment, the `istioctl kube-inject` can be used to manually insert an Envoy sidecar container into the Pod:

```bash
$  kubectl apply -f <(istioctl kube-inject --debug -f samples/bookinfo/platform/kube/bookinfo.yaml)
```

The initial app appears as follows:

![](../../.gitbook/assets/bookinfo%20%283%29.png)

`istioctl kube-inject` inserts an Envoy container into each Pod of the original application:

![](../../.gitbook/assets/bookinfo2%20%284%29.png)

Once the service is running, you can access the BookInfo app via the Gateway address `http://<gateway-address>/productpage`:

```bash
$ kubectl get svc istio-ingressgateway -n istio-system
kubectl get svc istio-ingressgateway -n istio-system
```

![](../../.gitbook/assets/productpage%20%281%29.png)

By default, the three versions of reviews services go through rounds in a load-balanced way.

### Automatic Injection of Sidecar Container

First, verify that the `admissionregistration` API has been turned on:

```bash
$ kubectl api-versions | grep admissionregistration
```

Then, make sure the istio-sidecar-injector is properly running:

```bash
$ kubectl -n istio-system get deploy istio-sidecar-injector
```

Next, add the label `istio-injection=enabled` to the namespace that needs automatic sidecar injection:

```bash
$ kubectl label namespace default istio-injection=enabled
```

After doing so, any newly created Pods in the default namespace will automatically have the istio sidecar container attached.

## References

* [https://istio.io/](https://istio.io/)
* [Istio - A modern service mesh](https://istio.io/talks/istio_talk_gluecon_2017.pdf)
* [https://www.envoyproxy.io/](https://www.envoyproxy.io/)
* [https://github.com/nginmesh/nginmesh](https://github.com/nginmesh/nginmesh)
* [WHAT’S A SERVICE MESH? AND WHY DO I NEED ONE?](https://buoyant.io/2017/04/25/whats-a-service-mesh-and-why-do-i-need-one/)
* [A SERVICE MESH FOR KUBERNETES](https://buoyant.io/2016/10/04/a-service-mesh-for-kubernetes-part-i-top-line-service-metrics/)
* [Service Mesh Pattern](http://philcalcado.com/2017/08/03/pattern_service_mesh.html)
* [Request Routing and Policy Management with the Istio Service Mesh](http://blog.kubernetes.io/2017/10/request-routing-and-policy-management.html)