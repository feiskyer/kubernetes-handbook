# Minikube Ingress Unveiled

While minikube supports LoadBalancer type services, it doesn’t actually create an external load balancer. Rather, it opens a NodePort for these services - crucial information when it comes to using Ingress.

This article will demonstrate how to activate and manage the Ingress Controller and Ingress resources on minikube.

## Powering Up the Ingress Controller

Minikube conveniently comes with a built-in ingress addon that you can easily activate.

```bash
$ minikube addons enable ingress
```

Wait a while, and soon enough, the nginx-ingress-controller and default-http-backend will kick into action.

```bash
$ kubectl get pods -n kube-system
NAME                             READY     STATUS    RESTARTS   AGE
default-http-backend-5374j       1/1       Running   0          1m
kube-addon-manager-minikube      1/1       Running   0          2m
kube-dns-268032401-rhrx6         3/3       Running   0          1m
kubernetes-dashboard-xh74p       1/1       Running   0          2m
nginx-ingress-controller-78mk6   1/1       Running   0          1m
```

## Crafting an Ingress

First, let's enable an echo server service.

```bash
$ kubectl run echoserver --image=gcr.io/google_containers/echoserver:1.4 --port=8080
$ kubectl expose deployment echoserver --type=NodePort
$ minikube service echoserver --url
http://192.168.64.36:31957
```

Next, we'll craft an Ingress that can forward `http://mini-echo.io` and `http://mini-web.io/echo` to our newly created echoserver service.

```bash
$ cat <<EOF | kubectl create -f -
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: echo
  annotations:
    ingress.kubernetes.io/rewrite-target: /
spec:
  backend:
    serviceName: default-http-backend
    servicePort: 80
  rules:
  - host: mini-echo.io
    http:
      paths:
      - path: /
        backend:
          serviceName: echoserver
          servicePort: 8080
  - host: mini-web.io
    http:
      paths:
      - path: /echo
        backend:
          serviceName: echoserver
          servicePort: 8080
EOF
```

To access the `mini-echo.io` and `mini-web.io` domain names, manually add a mapping in hosts.

```bash
$ echo "$(minikube ip) mini-echo.io mini-web.io" | sudo tee -a /etc/hosts
```

After this, you can access the service via `http://mini-echo.io` and `http://mini-web.io/echo`.

## Using xip.io

The previous method requires manual configuration of hosts every time a different domain name is used. By making use of `xip.io`, we can bypass this step.

Just like before, we start by enabling a nginx service.

```bash
$ kubectl run nginx --image=nginx --port=80
$ kubectl expose deployment nginx --type=NodePort
```

Next, we'll create an Ingress. The difference here is that the host uses `nginx.$(minikube ip).xip.io`:

```bash
$ cat <<EOF | kubectl create -f -
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
 name: my-nginx-ingress
spec:
 rules:
  - host: nginx.$(minikube ip).xip.io
    http:
     paths:
      - path: /
        backend:
         serviceName: nginx
         servicePort: 80
EOF
```

Now, we can directly access the domain name:

```bash
$ curl nginx.$(minikube ip).xip.io
```