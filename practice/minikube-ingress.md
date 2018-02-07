# minikube Ingress

虽然 minikube 支持 LoadBalancer 类型的服务，但它并不会创建外部的负载均衡器，而是为这些服务开放一个 NodePort。这在使用 Ingress 时需要注意。

本节展示如何在 minikube 上开启 Ingress Controller 并创建和管理 Ingress 资源。

## 启动 Ingress Controller

minikube 已经内置了 ingress addon，只需要开启一下即可

```sh
$ minikube addons enable ingress
```

稍等一会，nginx-ingress-controller 和 default-http-backend 就会起来

```sh
$ kubectl get pods -n kube-system
NAME                             READY     STATUS    RESTARTS   AGE
default-http-backend-5374j       1/1       Running   0          1m
kube-addon-manager-minikube      1/1       Running   0          2m
kube-dns-268032401-rhrx6         3/3       Running   0          1m
kubernetes-dashboard-xh74p       1/1       Running   0          2m
nginx-ingress-controller-78mk6   1/1       Running   0          1m
```

## 创建 Ingress

首先启用一个 echo server 服务

```sh
$ kubectl run echoserver --image=gcr.io/google_containers/echoserver:1.4 --port=8080
$ kubectl expose deployment echoserver --type=NodePort
$ minikube service echoserver --url
http://192.168.64.36:31957
```

然后创建一个 Ingress，将 `http://mini-echo.io` 和 `http://mini-web.io/echo` 转发到刚才创建的 echoserver 服务上

```sh
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

为了访问 `mini-echo.io` 和 `mini-web.io` 这两个域名，手动在 hosts 中增加一个映射

```sh
$ echo "$(minikube ip) mini-echo.io mini-web.io" | sudo tee -a /etc/hosts
```

然后，就可以通过 `http://mini-echo.io` 和 `http://mini-web.io/echo` 来访问服务了。

## 使用 xip.io

前面的方法需要每次在使用不同域名时手动配置 hosts，借助 `xip.io` 可以省掉这个步骤。

跟前面类似，先启动一个 nginx 服务

```sh
$ kubectl run nginx --image=nginx --port=80
$ kubectl expose deployment nginx --type=NodePort
```

然后创建 Ingress，与前面不同的是 host 使用 `nginx.$(minikube ip).xip.io`：

```sh
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

然后就可以直接访问该域名了

```sh
$ curl nginx.$(minikube ip).xip.io
```
