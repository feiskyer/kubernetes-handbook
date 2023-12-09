# Unraveling the Service Mesh

A Service Mesh is a squadron of network proxies designed to ensure secure, fast, and reliable communication between services. This layer of infrastructure came to the fore with the rise of microservices and cloud-native applications. Often deployed alongside applications in a lightweight network proxy (for instance, using the sidecar method as diagrammed below), the Service Mesh could be envisioned as a networking model superior to TCP/IP that abstracts the mechanisms for reliable inter-service communication. However, unlike TCP, it is oriented towards the applications themselves, offering unified visualization and control over them.

![](../../.gitbook/assets/pattern-service-mesh%20%281%29.png)

To ensure reliable communication between services, a Service Mesh needs to back several functions such as circuit-breaker mechanisms, latency-aware load balancing, service discovery, retries, and more. Take Linkerd, for instance; when processing a request, their workflow includes:

* Determining the service for the request via dynamic route lookups
* Locating instances of that service
* Choosing the most optimal instance based on factors like response latency
* Forwarding the request to the optimal instance, and noting latency and responses
* On failure of the request or the instance becoming ineffective, forwarding to another instance for retry (provided the request is idempotent)
* Failing directly if the request exceeds its time limit, thereby not increasing the load on the backend 
* Recording details of the request's metrics and distributed tracing

So, why exactly is a Service Mesh necessary?

* It decouples service governance from the actual services, preventing intrusion into applications during the process of micro-services.
* It accelerates the transformation of traditional applications into microservices or cloud-native applications.

Far from being a completely new feature, the Service Mesh merely separates functions that already existed in many applications, bringing them under the control of a unified component. Especially in the realm of microservice applications, where the number of services may be astronomical, and possibly built on various frameworks and languages, a separate Service Mesh component simplifies management and coordination.

Some popular Service Mesh frameworks include:

* [Istio](../istio/)
* [Conduit](https://github.com/feiskyer/kubernetes-handbook/tree/549e0e3c9ba0175e64b2d4719b5a46e9016d532b/apps/conduit.md)
* [Linkerd](linkerd.md)