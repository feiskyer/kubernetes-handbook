# Linkerd

Linkerd 是一個面向雲原生應用的 Service Mesh 組件，也是 CNCF 項目之一。它為服務間通信提供了一個統一的管理和控制平面，並且解耦了應用程序代碼和通信機制，從而無需更改應用程序就可以可視化控制服務間的通信。linkerd 實例是無狀態的，可以以每個應用一個實例 (sidecar) 或者每臺 Node 一個實例的方式部署。

![](images/linkerd.png)

Linkerd 的主要特性包括

- 服務發現
- 動態請求路由
- HTTP 代理集成，支持 HTTP、TLS、gRPC、HTTP/2 等
- 感知時延的負載均衡，支持多種負載均衡算法，如 Power of Two Choices (P2C) Least Loaded、Power of Two Choices (P2C) peak ewma、Aperture: least loaded、Heap: least loaded、Round robin 等
- 熔斷機制，自動移除不健康的後端實例，包括 fail fast（只要連接失敗就移除實例）和 failure accrual（超過 5 個請求處理失敗時才將其標記為失效，並保留一定的恢復時間 ）兩種
- 分佈式跟蹤和度量

![](images/linkerd-features.png)

## Linkerd 原理

Linkerd 路由將請求處理分解為多個步驟

- (1) IDENTIFICATION：為實際請求設置邏輯名字（即請求的目的服務），如默認將 HTTP 請求 `GET http://example/hello` 賦值名字 `/svc/example`
- (2) BINDING：dtabs 負責將邏輯名與客戶端名字綁定起來，客戶端名字總是以 `/#` 或 `/$` 開頭，比如

```sh
# 假設 dtab 為
/env => /#/io.l5d.serversets/discovery
/svc => /env/prod

# 那麼服務名 / svc/users 將會綁定為
/svc/users
/env/prod/users
/#/io.l5d.serversets/discovery/prod/users
```

- (3) RESOLUTION：namer 負責解析客戶端名，並得到真實的服務地址（IP + 端口）
- (4) LOAD BALANCING：根據負載均衡算法選擇如何發送請求

![](images/linkerd-routing.png)

## Linkerd 部署

Linkerd 以 DaemonSet 的方式部署在每個 Node 節點上：

```sh
# Deploy linkerd.
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

默認情況下，Linkerd 的 Dashboard 監聽在每個容器實例的 9990 端口（注意未在 l5d 服務中對外暴露），可以通過服務的相應端口來訪問。

```sh
kubectl -n linkerd port-forward $(kubectl -n linkerd get pod -l app=l5d -o jsonpath='{.items[0].metadata.name}') 9990 &
echo "open http://localhost:9990 in browser"
```

### Grafana 和 Prometheus

```sh
$ kubectl -n linkerd apply -f https://github.com/linkerd/linkerd-viz/raw/master/k8s/linkerd-viz.yml
$ kubectl -n linkerd get svc linkerd-viz
NAME          TYPE           CLUSTER-IP    EXTERNAL-IP   PORT(S)                       AGE
linkerd-viz   LoadBalancer   10.0.235.21   <pending>     80:30895/TCP,9191:31145/TCP   24s
```

### TLS

```sh
kubectl -n linkerd apply -f https://github.com/linkerd/linkerd-examples/raw/master/k8s-daemonset/k8s/certificates.yml
kubectl -n linkerd delete ds/l5d configmap/l5d-config
kubectl -n linkerd apply -f https://github.com/linkerd/linkerd-examples/raw/master/k8s-daemonset/k8s/linkerd-tls.yml
```

### Zipkin

```sh
# Deploy zipkin.
kubectl -n linkerd apply -f https://github.com/linkerd/linkerd-examples/raw/master/k8s-daemonset/k8s/zipkin.yml

# Deploy linkerd for zipkin.
kubectl -n linkerd apply -f https://github.com/linkerd/linkerd-examples/raw/master/k8s-daemonset/k8s/linkerd-zipkin.yml

# Get zipkin endpoint.
ZIPKIN_LB=$(kubectl get svc zipkin -o jsonpath="{.status.loadBalancer.ingress[0].*}")
echo "open http://$ZIPKIN_LB in browser"
```

### NAMERD

```sh
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

Linkerd 也可以作為 Kubernetes Ingress Controller 使用，注意下面的步驟將 Linkerd 部署到了 l5d-system namespace。

```sh
$ kubectl create ns l5d-system
$ kubectl apply -f https://raw.githubusercontent.com/linkerd/linkerd-examples/master/k8s-daemonset/k8s/linkerd-ingress-controller.yml -n l5d-system

# If load balancer is supported in kubernetes cluster
$ L5D_SVC_IP=$(kubectl get svc l5d -n l5d-system -o jsonpath="{.status.loadBalancer.ingress[0].*}")
$ echo open http://$L5D_SVC_IP:9990

# Or else
$ HOST_IP=$(kubectl get po -l app=l5d -n l5d-system -o jsonpath="{.items[0].status.hostIP}")
$ L5D_SVC_IP=$HOST_IP:$(kubectl get svc l5d -n l5d-system -o 'jsonpath={.spec.ports[0].nodePort}')
$ echo open http://$HOST_IP:$(kubectl get svc l5d -n l5d-system -o 'jsonpath={.spec.ports[1].nodePort}')
```

然後通過 `kubernetes.io/ingress.class: "linkerd"` annotation 使用 linkerd ingress 控制器：

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

更多使用方法見[這裡](https://buoyant.io/2017/04/06/a-service-mesh-for-kubernetes-part-viii-linkerd-as-an-ingress-controller/)。

## 應用示例

可以通過 HTTP 代理和 linkerd-inject 等兩種方式來使用 Linkerd。

### HTTP 代理

應用程序在使用 Linkerd 時需要為應用設置 HTTP 代理，其中

- HTTP 使用 `$(NODE_NAME):4140`
- HTTP/2 使用 `$(NODE_NAME):4240`
- gRPC 使用 `$(NODE_NAME):4340`

在 Kubernetes 中，可以使用 Downward API 來獲取 `NODE_NAME`，比如

```yaml
---
apiVersion: v1
kind: ReplicationController
metadata:
  name: hello
spec:
  replicas: 3
  selector:
    app: hello
  template:
    metadata:
      labels:
        app: hello
    spec:
      dnsPolicy: ClusterFirst
      containers:
      - name: service
        image: buoyantio/helloworld:0.1.6
        env:
        - name: NODE_NAME
          valueFrom:
            fieldRef:
              fieldPath: spec.nodeName
        - name: POD_IP
          valueFrom:
            fieldRef:
              fieldPath: status.podIP
        - name: http_proxy
          value: $(NODE_NAME):4140
        args:
        - "-addr=:7777"
        - "-text=Hello"
        - "-target=world"
        ports:
        - name: service
          containerPort: 7777
---
apiVersion: v1
kind: Service
metadata:
  name: hello
spec:
  selector:
    app: hello
  clusterIP: None
  ports:
  - name: http
    port: 7777
---
apiVersion: v1
kind: ReplicationController
metadata:
  name: world-v1
spec:
  replicas: 3
  selector:
    app: world-v1
  template:
    metadata:
      labels:
        app: world-v1
    spec:
      dnsPolicy: ClusterFirst
      containers:
      - name: service
        image: buoyantio/helloworld:0.1.6
        env:
        - name: POD_IP
          valueFrom:
            fieldRef:
              fieldPath: status.podIP
        - name: TARGET_WORLD
          value: world
        args:
        - "-addr=:7778"
        ports:
        - name: service
          containerPort: 7778
---
apiVersion: v1
kind: Service
metadata:
  name: world-v1
spec:
  selector:
    app: world-v1
  clusterIP: None
  ports:
  - name: http
    port: 7778
```

### linkerd-inject

```sh
# install linkerd-inject
$ go get github.com/linkerd/linkerd-inject

# inject init container and deploy this config
$ kubectl apply -f <(linkerd-inject -f <your k8s config>.yml -linkerdPort 4140)
```

## 參考文檔

- [WHAT’S A SERVICE MESH? AND WHY DO I NEED ONE?](https://buoyant.io/2017/04/25/whats-a-service-mesh-and-why-do-i-need-one/)
- [Linkerd 官方文檔](https://linkerd.io/documentation/)
- [A SERVICE MESH FOR KUBERNETES](https://buoyant.io/2016/10/04/a-service-mesh-for-kubernetes-part-i-top-line-service-metrics/)
- [Linkerd examples](https://github.com/linkerd/linkerd-examples)
- [Service Mesh Pattern](http://philcalcado.com/2017/08/03/pattern_service_mesh.html)
- <https://conduit.io>
