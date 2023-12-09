# Making Sense of Ingress Controller

[Ingress](../../concepts/objects/ingress.md) is a power being used by Kubernetes cluster for providing an external access point and routing for services. Meanwhile, Ingress Controller is standing guard, watching changes of Ingress and Service resources. After detecting the changes, it begins configuring load balancing, routing rules, and DNS according to predetermined rules, setting up an accessible entrance.

## Crafting Your Own Ingress Controller Extension

The [NGINX Ingress Controller](https://github.com/kubernetes/ingress-nginx) and the [GLBC](https://github.com/kubernetes/ingress-gce) provide two fully-fledged examples of Ingress Controllers. These examples are great starting points for you to conveniently develop a new kind of Ingress Controller.

## The Usual Suspects: Common Ingress Controllers 

* [Nginx Ingress](https://github.com/kubernetes/ingress-nginx)

```bash
helm install stable/nginx-ingress --name nginx-ingress --set rbac.create=true
```

* [HAProxy Ingress controller](https://github.com/jcmoraisjr/haproxy-ingress)
* [Linkerd](https://linkerd.io/config/0.9.1/linkerd/index.html#ingress-identifier)
* [traefik](https://doc.traefik.io/traefik/providers/kubernetes-ingress/)
* [AWS Application Load Balancer Ingress Controller](https://github.com/coreos/alb-ingress-controller)
* [kube-ingress-aws-controller](https://github.com/zalando-incubator/kube-ingress-aws-controller)
* [Voyager: HAProxy Ingress Controller](https://github.com/appscode/voyager)

## Your How-to Guide for Ingress

The 'how-to' specifics of using Ingress can be found [right here](../../concepts/objects/ingress.md).