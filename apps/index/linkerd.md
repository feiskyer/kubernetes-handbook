# Linkerd

Linkerd is an exceptional service mesh component designed for cloud-native applications and is amongst the CNCF (Cloud Native Computing Foundation) projects. It offers a uniform management and control plane for inter-service communication, decoupling the application logic from communication mechanisms. Remarkably, this enables you to gain visual control over service communication without altering your application. Additionally, Linkerd instances are stateless, and you can swiftly deploy them in two ways: one instance per application (sidecar) or one instance per Node.

![](../../.gitbook/assets/linkerd%20%282%29.png)

The laudable features that Linkerd brings to the table include:

* Service Discovery
* Dynamic request routing
* Integration with HTTP proxy, with support for protocols like HTTP, TLS, gRPC, HTTP/2, etc. 
* Latency-aware load balancing that supports numerous load-balancing algorithms, such as Power of Two Choices (P2C) Least Loaded, Power of Two Choices (P2C) peak ewma, Aperture: least loaded, Heap: least loaded, Round robin, and more.
* A robust circuit breaker mechanism, which automatically eliminates unhealthy backend instances, including fail-fast (instance removal upon connection failure) and failure accrual (marks as failed and reserves recovery time when more than 5 request handling fails)
* Distributed tracing and metrics

![](../../.gitbook/assets/linkerd-features%20%281%29.png)

## Under the Hood of Linkerd (Linkerd Principle)

Linkerd breaks down request handling into multiple steps – 

* \(1\) IDENTIFICATION: Assigning a logical name (i.e., the target service of the request) to the actual request, such as assigning the name '/svc/example' to the HTTP request 'GET http://example/hello' by default.
* \(2\) BINDING: dtabs are responsible for binding the logical name with the client name, with client names always beginning with '/#' or '/$', like:

```bash
# Assuming dtab is
/env => /#/io.l5d.serversets/discovery
/svc => /env/prod

# Then the service name /svc/users will be bound as
/svc/users
/env/prod/users
/#/io.l5d.serversets/discovery/prod/users
```

* \(3\) RESOLUTION: namer resolves the client name, eventually unearthing the actual service address (IP + port)
* \(4\) LOAD BALANCING: Deciding on how to send requests according to the load-balancing algorithm.

![](../../.gitbook/assets/linkerd-routing%20%283%29.png)

## Deploying Linkerd

Linkerd is deployed as a DaemonSet on every Node node:

```bash
# For CNI, deploy linkerd-cni.yml instead.
# kubectl apply -f https://github.com/linkerd/linkerd-examples/raw/master/k8s-daemonset/k8s/linkerd-cni.yml
kubectl create ns linkerd
kubectl apply -f https://raw.githubusercontent.com/linkerd/linkerd-examples/master/k8s-daemonset/k8s/servicemesh.yml

$ kubectl -n linkerd get pod
NAME        READY     STATUS    RESTARTS   AGE
l5d-6v67t   2/2       Running   0          2m
l5d-rn6v4   2/2       Running   0          2m
$ kubectl -n linkerd get svc
NAME      TYPE           CLUSTER-IP   EXTERNAL-IP     POR    AGE
l5d       LoadBalancer   10.0.71.9    <pending>       4140:32728/TCP,4141:31804/TCP,4240:31418/TCP,4241:30611/TCP,4340:31768/TCP,4341:30845/TCP,80:31144/TCP,8080:31115/TCP   3m
```

By default, Linkerd's Dashboard listens at port 9990 of each container instance (note that it is not exposed in l5d service), and can be accessed through the corresponding port of the service.

```bash
kubectl -n linkerd port-forward $(kubectl -n linkerd get pod -l app=l5d -o jsonpath='{.items[0].metadata.name}') 9990 &
echo "open http://localhost:9990 in browser"
```

### Tools: Grafana and Prometheus

```bash
$ kubectl -n linkerd apply -f https://github.com/linkerd/linkerd-viz/raw/master/k8s/linkerd-viz.yml
$ kubectl -n linkerd get svc linkerd-viz
NAME          TYPE           CLUSTER-IP    EXTERNAL-IP   PORT(S)                       AGE
linkerd-viz   LoadBalancer   10.0.235.21   <pending>     80:30895/TCP,9191:31145/TCP   24s
```

### TLS

```bash
kubectl -n linkerd apply -f https://github.com/linkerd/linkerd-examples/raw/master/k8s-daemonset/k8s/certificates.yml
kubectl -n linkerd delete ds/l5d configmap/l5d-config
kubectl -n linkerd apply -f https://github.com/linkerd/linkerd-examples/raw/master/k8s-daemonset/k8s/linkerd-tls.yml
```

### Zipkin

```bash
# Deploy zipkin.
kubectl -n linkerd apply -f https://github.com/linkerd/linkerd-examples/raw/master/k8s-daemonset/k8s/zipkin.yml

# Deploy linkerd for zipkin.
kubectl -n linkerd apply -f https://github.com/linkerd/linkerd-examples/raw/master/k8s-daemonset/k8s/linkerd-zipkin.yml

# Get zipkin endpoint.
ZIPKIN_LB=$(kubectl get svc zipkin -o jsonpath="{.status.loadBalancer.ingress[0].*}")
echo "open http://$ZIPKIN_LB in browser"
```

### NAMERD

```bash
$ kubectl apply -f https://raw.githubusercontent.com/linkerd/linkerd-examples/master/k8s-daemonset/k8s/namerd.yml
$ kubectl apply -f https://raw.githubusercontent.com/linkerd/linkerd-examples/master/k8s-daemonset/k8s/linkerd-namerd.yml

$ go get -u github.com/linkerd/namerctl
$ go install github.com/linkerd/namerctl
$ NAMERD_INGRESS_LB=$(kubectl get svc namerd -o jsonpath="{.status.loadBalancer.ingress[0].*}")
$ export NAMERCTL_BASE_URL=http://$NAMERD_INGRESS_LB:4180
$ $ namerctl dtab get internal
# version MjgzNjk5NzI=
/srv         => /#/io.l5d.k8s/default/http ;
/host        => /srv ;
/tmp         => /srv ;
/svc         => /host ;
/host/world  => /srv/world-v1 ;
```

### Ingress Controller

Linkerd can also be used as a Kubernetes Ingress Controller. Be aware that the following steps deploy Linkerd to the l5d-system namespace.

```bash
$ kubectl create ns l5d-system
$ kubectl apply -f https://raw.githubusercontent.com/linkerd/linkerd-examples/master/k8s-daemonset/k8s/linkerd-ingress-controller.yml -n l5d-system

# If load balancer is supported in the Kubernetes cluster
$ L5D_SVC_IP=$(kubectl get svc l5d -n l5d-system -o jsonpath="{.status.loadBalancer.ingress[0].*}")
$ echo open http://$L5D_SVC_IP:9990

# Or else
$ HOST_IP=$(kubectl get po -l app=l5d -n l5d-system -o jsonpath="{.items[0].status.hostIP}")
$ echo open http://$HOST_IP:$(kubectl get svc l5d -n l5d-system -o 'jsonpath={.spec.ports[1].nodePort}')
```

Then, through the `kubernetes.io/ingress.class: "linkerd"` annotation, you can facilitate the linkerd ingress controller:

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: hello-world
  annotations:
    kubernetes.io/ingress.class: "linkerd"
spec:
  backend:
    serviceName: world-v1
    servicePort: http
  rules:
  - host: world.v2
    http:
      paths:
      - backend:
          serviceName: world-v2
          servicePort: http
```

For further usage details, check [here](https://buoyant.io/2017/04/06/a-service-mesh-for-kubernetes-part-viii-linkerd-as-an-ingress-controller/).

## Application Examples

You can use Linkerd in two ways: HTTP proxy and linkerd-inject.

### HTTP Proxy

When using Linkerd, set HTTP proxy for the application as:

* HTTP uses `$(NODE_NAME):4140`
* HTTP/2 uses `$(NODE_NAME):4240`
* gRPC uses `$(NODE_NAME):4340`

In Kubernetes, to get `NODE_NAME`, you can use the Downward API. For instance,

```yaml
[Code snippet Omitted for Length - See original reference.]
```

### linkerd-inject

```bash
# install linkerd-inject
$ go get github.com/linkerd/linkerd-inject

# inject init container and deploy this config
$ kubectl apply -f <(linkerd-inject -f <your k8s config>.yml -linkerdPort 4140)
```

## Further Reading

* [WHAT’S A SERVICE MESH? AND WHY DO I NEED ONE?](https://buoyant.io/2017/04/25/whats-a-service-mesh-and-why-do-i-need-one/)
* [Linkerd Official Documentation](https://linkerd.io/documentation/)
* [A SERVICE MESH FOR KUBERNETES](https://buoyant.io/2016/10/04/a-service-mesh-for-kubernetes-part-i-top-line-service-metrics/)
* [Linkerd examples](https://github.com/linkerd/linkerd-examples)
* [Service Mesh Pattern](http://philcalcado.com/2017/08/03/pattern_service_mesh.html)