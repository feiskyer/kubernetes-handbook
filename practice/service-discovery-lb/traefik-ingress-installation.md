# Setting Up Traefik Ingress

## Introduction to Ingress

Simply put, an ingress is an entry point for accessing a Kubernetes cluster from outside, forwarding URL requests from users to different services. Ingress acts like a load-balancer and a reverse proxy server similar to nginx or apache, including rule definitions—i.e., routing information for URLs. The refreshing of route information is provided by [Ingress controllers](https://kubernetes.io/docs/concepts/services-networking/ingress/#ingress-controllers).

An Ingress Controller can essentially be understood as a monitor. It interacts with the Kubernetes API regularly, sensing real-time changes in backend services, pods, etc., such as the addition or removal of pods and services. When these changes are detected, the Ingress Controller updates the reverse proxy load balancer by generating configurations based on the below-mentioned Ingress, then refreshing its configuration, thus achieving service discovery.

## Deploying Traefik

**Introducing Traefik**

[Traefik](https://traefik.io/) is an open-source reverse proxy and load balancer tool that seamlessly integrates with common microservice architectures, automating dynamic configuration. It currently supports various backend models including Docker, Swarm, Mesos/Marathon, Kubernetes, Consul, Etcd, Zookeeper, BoltDB, Rest API, and more.

The following configuration file can be found in the Traefik GitHub repository under [examples/k8s/traefik-rbac.yaml](https://github.com/containous/traefik/tree/master/examples/k8s/traefik-rbac.yaml).

**Create ingress-rbac.yaml**

This will be used for service account authentication.

```Yaml
---
kind: ClusterRole
apiVersion: rbac.authorization.k8s.io/v1beta1
metadata:
  name: traefik-ingress-controller
rules:
  - apiGroups:
      - ""
    resources:
      - services
      - endpoints
      - secrets
    verbs:
      - get
      - list
      - watch
  - apiGroups:
      - extensions
    resources:
      - ingresses
    verbs:
      - get
      - list
      - watch
---
kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1beta1
metadata:
  name: traefik-ingress-controller
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: traefik-ingress-controller
subjects:
- kind: ServiceAccount
  name: traefik-ingress-controller
  namespace: kube-system
```

```sh
kubectl apply -f https://raw.githubusercontent.com/containous/traefik/master/examples/k8s/traefik-rbac.yaml
```

**Create a Deployment**

```yaml
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: traefik-ingress-controller
  namespace: kube-system
---
kind: Deployment
apiVersion: extensions/v1beta1
metadata:
  name: traefik-ingress-controller
  namespace: kube-system
  labels:
    k8s-app: traefik-ingress-lb
spec:
  replicas: 1
  selector:
    matchLabels:
      k8s-app: traefik-ingress-lb
  template:
    metadata:
      labels:
        k8s-app: traefik-ingress-lb
        name: traefik-ingress-lb
    spec:
      serviceAccountName: traefik-ingress-controller
      terminationGracePeriodSeconds: 60
      containers:
      - image: traefik
        name: traefik-ingress-lb
        args:
        - --web
        - --kubernetes
---
kind: Service
apiVersion: v1
metadata:
  name: traefik-ingress-service
spec:
  selector:
    k8s-app: traefik-ingress-lb
  ports:
    - protocol: TCP
      port: 80
      name: web
    - protocol: TCP
      port: 8080
      name: admin
  type: NodePort
```

```sh
# Deploy using a deployment
kubectl apply -f https://raw.githubusercontent.com/containous/traefik/master/examples/k8s/traefik-deployment.yaml
# You can also deploy using a daemonset
# kubectl apply -f https://raw.githubusercontent.com/containous/traefik/master/examples/k8s/traefik-ds.yaml
```

Note that we are using a Deployment type here, which does not specify on which host the pod runs. Traefik's port is 8580.

**Create an ingress named `traefik-ingress`, file name traefik.yaml**

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: traefik-ingress
spec:
  rules:
  - host: traefik.nginx.io
    http:
      paths:
      - path: /
        backend:
          serviceName: nginx
          servicePort: 80
  - host: traefik.frontend.io
    http:
      paths:
      - path: /
        backend:
          serviceName: frontend
          servicePort: 80
```

In the `backend` section, configure the name of the service started in the default namespace. `path` refers to the path after the URL address, such as traefik.frontend.io/path—the service will receive this path. It is best to use a hostname-like naming convention such as service-name.field1.field2.domain-name for `host` for easier service differentiation.

Modify this file based on the names and ports of the services deployed in your own environment. When new services are added, you can update by using `kubectl replace -f traefik.yaml`.

**Traefik UI**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: traefik-web-ui
  namespace: kube-system
spec:
  selector:
    k8s-app: traefik-ingress-lb
  ports:
  - port: 80
    targetPort: 8080
---
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: traefik-web-ui
  namespace: kube-system
  annotations:
    kubernetes.io/ingress.class: traefik
spec:
  rules:
  - host: traefik-ui.nginx.io
    http:
      paths:
      - backend:
          serviceName: traefik-web-ui
          servicePort: 80
```

Once configured, you can start the traefik ingress.

```
kubectl create -f .
```

I noticed that the traefik pod has started on the node `172.20.0.115`.

By visiting the address `http://172.20.0.115:8580/`, you will be able to see the dashboard.

![kubernetes-dashboard](images/traefik-dashboard.jpg)

The yellow section on the left lists all the rules, with all the backends in the green section on the right.

## Testing

Execute on any node in the cluster. Let's say I want to access the "/" path of nginx.

```bash
$ curl -H Host:traefik.nginx.io http://172.20.0.115/
<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
<style>
    body {
        width: 35em;
        margin: 0 auto;
        font-family: Tahoma, Verdana, Arial, sans-serif;
    }
</style>
</head>
<body>
<h1>Welcome to nginx!</h1>
<p>If you see this page, the nginx web server is successfully installed and
working. Further configuration is required.</p>

<p>For online documentation and support please refer to
<a href="http://nginx.org/">nginx.org</a>.<br/>
Commercial support is available at
<a href="http://nginx.com/">nginx.com</a>.</p>

<p><em>Thank you for using nginx.</em></p>
</body>
</html>
```

If you need to access it from outside the Kubernetes cluster, you will need to set up DNS, or modify the hosts file on your machine.

Add the following:

```
172.20.0.115 traefik.nginx.io
172.20.0.115 traefik.frontend.io
```

All traffic to these addresses will be sent to the host 172.20.0.115, which is where we launched traefik.

Traefik will parse the Host parameter in the HTTP request header and forward the traffic to the corresponding service specified in the Ingress configuration.

After modifying the hosts file, you can now access the above two services from outside the Kubernetes cluster, as shown below:

![traefik-nginx](images/traefik-nginx.jpg)

![traefik-guestbook](images/traefik-guestbook.jpg)

## Reference Documents

- [Introduction to Traefik](http://www.tuicool.com/articles/ZnuEfay)
- [Guestbook example](https://github.com/kubernetes/kubernetes/tree/master/examples/guestbook)