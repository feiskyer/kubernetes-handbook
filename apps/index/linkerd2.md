# Linkerd2

Previously known as [Conduit](https://conduit.io), Linkerd2 is the subsequent release to its predecessor, Linkerd, by the company Buoyant. This next-generation service mesh framework, lighter than Linkerd, is specifically designed for Kubernetes cluster environments. It's open-source, available at [https://github.com/linkerd/linkerd2](https://github.com/linkerd/linkerd2). 

What sets it apart is its ability to integrate proxy services directly with actual service pods in a Kubernetes cluster. This is achieved using a mechanism known as 'sidecars', a method also similarly adopted by Istio. Linkerd2 comes without the bulky JVM overhead, thanks to being implemented using Rust and Go programming languages.

Some significant features of Linkerd2 include:

* Its fast and lightweight design, with each proxy container consuming only 10mb RSS and introducing latency at the sub-millisecond level.
* Out-of-the-box security with Rust and default TLS support.
* End-to-end visualization capabilities.
* Contribution towards enhancing Kubernetes' reliability, visibility, and security.

## Deployment

```bash
$ linkerd install | kubectl apply -f -

// followed by service and pod status checks using the commands below

$ kubectl -n linkerd get svc  
$ kubectl -n linkerd get pod  
```

## Dashboard

```bash
$ linkerd dashboard
```

![Linkerd2 Dashboard](../../.gitbook/assets/linkerd2%20%283%29.png)

## Sample Application

A sample application can be deployed using:

```bash
curl https://run.linkerd.io/emojivoto.yml \
  | linkerd inject - \
  | kubectl apply -f -
```
You can then check the network traffic statistics of the services as seen below:

```bash
linkerd -n emojivoto stat deployment
```

For tracking network traffic of services, use:

```bash
$ linkerd -n emojivoto tap deploy voting
```

## References

* [A SERVICE MESH FOR KUBERNETES](https://buoyant.io/2016/10/04/a-service-mesh-for-kubernetes-part-i-top-line-service-metrics/)
* [Service Mesh Pattern](http://philcalcado.com/2017/08/03/pattern_service_mesh.html)
* [https://linkerd.io/2/overview/](https://linkerd.io/2/overview/)