# minikube Ingress

雖然 minikube 支持 LoadBalancer 類型的服務，但它並不會創建外部的負載均衡器，而是為這些服務開放一個 NodePort。這在使用 Ingress 時需要注意。

本節展示如何在 minikube 上開啟 Ingress Controller 並創建和管理 Ingress 資源。

## 啟動 Ingress Controller

minikube 已經內置了 ingress addon，只需要開啟一下即可

```sh
$ minikube addons enable ingress
```

稍等一會，nginx-ingress-controller 和 default-http-backend 就會起來

```sh
$ kubectl get pods -n kube-system
NAME                             READY     STATUS    RESTARTS   AGE
default-http-backend-5374j       1/1       Running   0          1m
kube-addon-manager-minikube      1/1       Running   0          2m
kube-dns-268032401-rhrx6         3/3       Running   0          1m
kubernetes-dashboard-xh74p       1/1       Running   0          2m
nginx-ingress-controller-78mk6   1/1       Running   0          1m
```

## 創建 Ingress

首先啟用一個 echo server 服務

```sh
$ kubectl run echoserver --image=gcr.io/google_containers/echoserver:1.4 --port=8080
$ kubectl expose deployment echoserver --type=NodePort
$ minikube service echoserver --url
http://192.168.64.36:31957
```

然後創建一個 Ingress，將 `http://mini-echo.io` 和 `http://mini-web.io/echo` 轉發到剛才創建的 echoserver 服務上

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

為了訪問 `mini-echo.io` 和 `mini-web.io` 這兩個域名，手動在 hosts 中增加一個映射

```sh
$ echo "$(minikube ip) mini-echo.io mini-web.io" | sudo tee -a /etc/hosts
```

然後，就可以通過 `http://mini-echo.io` 和 `http://mini-web.io/echo` 來訪問服務了。

## 使用 xip.io

前面的方法需要每次在使用不同域名時手動配置 hosts，藉助 `xip.io` 可以省掉這個步驟。

跟前面類似，先啟動一個 nginx 服務

```sh
$ kubectl run nginx --image=nginx --port=80
$ kubectl expose deployment nginx --type=NodePort
```

然後創建 Ingress，與前面不同的是 host 使用 `nginx.$(minikube ip).xip.io`：

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

然後就可以直接訪問該域名了

```sh
$ curl nginx.$(minikube ip).xip.io
```
