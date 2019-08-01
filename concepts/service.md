# 服務發現與負載均衡

Kubernetes 在設計之初就充分考慮了針對容器的服務發現與負載均衡機制，提供了 Service 資源，並通過 kube-proxy 配合 cloud provider 來適應不同的應用場景。隨著 kubernetes 用戶的激增，用戶場景的不斷豐富，又產生了一些新的負載均衡機制。目前，kubernetes 中的負載均衡大致可以分為以下幾種機制，每種機制都有其特定的應用場景：

- Service：直接用 Service 提供 cluster 內部的負載均衡，並藉助 cloud provider 提供的 LB 提供外部訪問
- Ingress Controller：還是用 Service 提供 cluster 內部的負載均衡，但是通過自定義 Ingress Controller 提供外部訪問
- Service Load Balancer：把 load balancer 直接跑在容器中，實現 Bare Metal 的 Service Load Balancer
- Custom Load Balancer：自定義負載均衡，並替代 kube-proxy，一般在物理部署 Kubernetes 時使用，方便接入公司已有的外部服務

## Service

![](images/14735737093456.jpg)

Service 是對一組提供相同功能的 Pods 的抽象，併為它們提供一個統一的入口。藉助 Service，應用可以方便的實現服務發現與負載均衡，並實現應用的零宕機升級。Service 通過標籤來選取服務後端，一般配合 Replication Controller 或者 Deployment 來保證後端容器的正常運行。這些匹配標籤的 Pod IP 和端口列表組成 endpoints，由 kube-proxy 負責將服務 IP 負載均衡到這些 endpoints 上。

Service 有四種類型：

- ClusterIP：默認類型，自動分配一個僅 cluster 內部可以訪問的虛擬 IP
- NodePort：在 ClusterIP 基礎上為 Service 在每臺機器上綁定一個端口，這樣就可以通過 `<NodeIP>:NodePort` 來訪問該服務。如果 kube-proxy 設置了 `--nodeport-addresses=10.240.0.0/16`（v1.10 支持），那麼僅該 NodePort 僅對設置在範圍內的 IP 有效。
- LoadBalancer：在 NodePort 的基礎上，藉助 cloud provider 創建一個外部的負載均衡器，並將請求轉發到 `<NodeIP>:NodePort`
- ExternalName：將服務通過 DNS CNAME 記錄方式轉發到指定的域名（通過 `spec.externlName` 設定）。需要 kube-dns 版本在 1.7 以上。

另外，也可以將已有的服務以 Service 的形式加入到 Kubernetes 集群中來，只需要在創建 Service 的時候不指定 Label selector，而是在 Service 創建好後手動為其添加 endpoint。

### Service 定義

Service 的定義也是通過 yaml 或 json，比如下面定義了一個名為 nginx 的服務，將服務的 80 端口轉發到 default namespace 中帶有標籤 `run=nginx` 的 Pod 的 80 端口

```yaml
apiVersion: v1
kind: Service
metadata:
  labels:
    run: nginx
  name: nginx
  namespace: default
spec:
  ports:
  - port: 80
    protocol: TCP
    targetPort: 80
  selector:
    run: nginx
  sessionAffinity: None
  type: ClusterIP
```

```sh
# service 自動分配了 Cluster IP 10.0.0.108
$ kubectl get service nginx
NAME      CLUSTER-IP   EXTERNAL-IP   PORT(S)   AGE
nginx     10.0.0.108   <none>        80/TCP    18m
# 自動創建的 endpoint
$ kubectl get endpoints nginx
NAME      ENDPOINTS       AGE
nginx     172.17.0.5:80   18m
# Service 自動關聯 endpoint
$ kubectl describe service nginx
Name:			nginx
Namespace:		default
Labels:			run=nginx
Annotations:		<none>
Selector:		run=nginx
Type:			ClusterIP
IP:			10.0.0.108
Port:			<unset>	80/TCP
Endpoints:		172.17.0.5:80
Session Affinity:	None
Events:			<none>
```

當服務需要多個端口時，每個端口都必須設置一個名字

```yaml
kind: Service
apiVersion: v1
metadata:
  name: my-service
spec:
  selector:
    app: MyApp
  ports:
  - name: http
    protocol: TCP
    port: 80
    targetPort: 9376
  - name: https
    protocol: TCP
    port: 443
    targetPort: 9377
```

### 協議

Service、Endpoints 和 Pod 支持三種類型的協議：

- TCP（Transmission Control Protocol，傳輸控制協議）是一種面向連接的、可靠的、基於字節流的傳輸層通信協議。
- UDP（User Datagram Protocol，用戶數據報協議）是一種無連接的傳輸層協議，用於不可靠信息傳送服務。
- SCTP（Stream Control Transmission Protocol，流控制傳輸協議），用於通過IP網傳輸SCN（Signaling Communication Network，信令通信網）窄帶信令消息。

### API 版本對照表

| Kubernetes 版本 | Core API 版本 |
| --------------- | ------------- |
| v1.5+           | core/v1       |

### 不指定 Selectors 的服務

在創建 Service 的時候，也可以不指定 Selectors，用來將 service 轉發到 kubernetes 集群外部的服務（而不是 Pod）。目前支持兩種方法

（1）自定義 endpoint，即創建同名的 service 和 endpoint，在 endpoint 中設置外部服務的 IP 和端口

```yaml
kind: Service
apiVersion: v1
metadata:
  name: my-service
spec:
  ports:
    - protocol: TCP
      port: 80
      targetPort: 9376
---
kind: Endpoints
apiVersion: v1
metadata:
  name: my-service
subsets:
  - addresses:
      - ip: 1.2.3.4
    ports:
      - port: 9376
```

（2）通過 DNS 轉發，在 service 定義中指定 externalName。此時 DNS 服務會給 `<service-name>.<namespace>.svc.cluster.local` 創建一個 CNAME 記錄，其值為 `my.database.example.com`。並且，該服務不會自動分配 Cluster IP，需要通過 service 的 DNS 來訪問。

```yaml
kind: Service
apiVersion: v1
metadata:
  name: my-service
  namespace: default
spec:
  type: ExternalName
  externalName: my.database.example.com
```

注意：Endpoints 的 IP 地址不能是 127.0.0.0/8、169.254.0.0/16 和 224.0.0.0/24，也不能是 Kubernetes 中其他服務的 clusterIP。

### Headless 服務

Headless 服務即不需要 Cluster IP 的服務，即在創建服務的時候指定 `spec.clusterIP=None`。包括兩種類型

- 不指定 Selectors，但設置 externalName，即上面的（2），通過 CNAME 記錄處理
- 指定 Selectors，通過 DNS A 記錄設置後端 endpoint 列表

```yaml
apiVersion: v1
kind: Service
metadata:
  labels:
    app: nginx
  name: nginx
spec:
  clusterIP: None
  ports:
  - name: tcp-80-80-3b6tl
    port: 80
    protocol: TCP
    targetPort: 80
  selector:
    app: nginx
  sessionAffinity: None
  type: ClusterIP
---
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  labels:
    app: nginx
  name: nginx
  namespace: default
spec:
  replicas: 2
  revisionHistoryLimit: 5
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - image: nginx:latest
        imagePullPolicy: Always
        name: nginx
        resources:
          limits:
            memory: 128Mi
          requests:
            cpu: 200m
            memory: 128Mi
      dnsPolicy: ClusterFirst
      restartPolicy: Always

```

```sh
# 查詢創建的 nginx 服務
$ kubectl get service --all-namespaces=true
NAMESPACE     NAME         CLUSTER-IP      EXTERNAL-IP      PORT(S)         AGE
default       nginx        None            <none>           80/TCP          5m
kube-system   kube-dns     172.26.255.70   <none>           53/UDP,53/TCP   1d
$ kubectl get pod
NAME                       READY     STATUS    RESTARTS   AGE       IP           NODE
nginx-2204978904-6o5dg     1/1       Running   0          14s       172.26.2.5   10.0.0.2
nginx-2204978904-qyilx     1/1       Running   0          14s       172.26.1.5   10.0.0.8
$ dig @172.26.255.70  nginx.default.svc.cluster.local
;; ANSWER SECTION:
nginx.default.svc.cluster.local. 30 IN	A	172.26.1.5
nginx.default.svc.cluster.local. 30 IN	A	172.26.2.5
```

備註： 其中 dig 命令查詢的信息中，部分信息省略

## 保留源 IP

各種類型的 Service 對源 IP 的處理方法不同：

- ClusterIP Service：使用 iptables 模式，集群內部的源 IP 會保留（不做 SNAT）。如果 client 和 server pod 在同一個 Node 上，那源 IP 就是 client pod 的 IP 地址；如果在不同的 Node 上，源 IP 則取決於網絡插件是如何處理的，比如使用 flannel 時，源 IP 是 node flannel IP 地址。
- NodePort Service：默認情況下，源 IP 會做 SNAT，server pod 看到的源 IP 是 Node IP。為了避免這種情況，可以給 service 設置 `spec.ExternalTrafficPolicy=Local` （1.6-1.7 版本設置 Annotation `service.beta.kubernetes.io/external-traffic=OnlyLocal`），讓 service 只代理本地 endpoint 的請求（如果沒有本地 endpoint 則直接丟包），從而保留源 IP。
- LoadBalancer Service：默認情況下，源 IP 會做 SNAT，server pod 看到的源 IP 是 Node IP。設置 `service.spec.ExternalTrafficPolicy=Local` 後可以自動從雲平臺負載均衡器中刪除沒有本地 endpoint 的 Node，從而保留源 IP。

## 工作原理

kube-proxy 負責將 service 負載均衡到後端 Pod 中，如下圖所示

![](images/service-flow.png)

## Ingress

Service 雖然解決了服務發現和負載均衡的問題，但它在使用上還是有一些限制，比如

－ 只支持 4 層負載均衡，沒有 7 層功能
－ 對外訪問的時候，NodePort 類型需要在外部搭建額外的負載均衡，而 LoadBalancer 要求 kubernetes 必須跑在支持的 cloud provider 上面

Ingress 就是為了解決這些限制而引入的新資源，主要用來將服務暴露到 cluster 外面，並且可以自定義服務的訪問策略。比如想要通過負載均衡器實現不同子域名到不同服務的訪問：

```
foo.bar.com --|                 |-> foo.bar.com s1:80
              | 178.91.123.132  |
bar.foo.com --|                 |-> bar.foo.com s2:80
```

可以這樣來定義 Ingress：

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: test
spec:
  rules:
  - host: foo.bar.com
    http:
      paths:
      - backend:
          serviceName: s1
          servicePort: 80
  - host: bar.foo.com
    http:
      paths:
      - backend:
          serviceName: s2
          servicePort: 80
```

注意 Ingress 本身並不會自動創建負載均衡器，cluster 中需要運行一個 ingress controller 來根據 Ingress 的定義來管理負載均衡器。目前社區提供了 nginx 和 gce 的參考實現。

Traefik 提供了易用的 Ingress Controller，使用方法見 <https://docs.traefik.io/user-guide/kubernetes/>。

更多 Ingress 和 Ingress Controller 的介紹參見 [ingress](ingress.md)。

## Service Load Balancer

在 Ingress 出現以前，[Service Load Balancer](https://github.com/kubernetes/contrib/tree/master/service-loadbalancer) 是推薦的解決 Service 侷限性的方式。Service Load Balancer 將 haproxy 跑在容器中，並監控 service 和 endpoint 的變化，通過容器 IP 對外提供 4 層和 7 層負載均衡服務。

社區提供的 Service Load Balancer 支持四種負載均衡協議：TCP、HTTP、HTTPS 和 SSL TERMINATION，並支持 ACL 訪問控制。

> 注意：Service Load Balancer 已不再推薦使用，推薦使用 [Ingress Controller](ingress.md)。

## Custom Load Balancer

雖然 Kubernetes 提供了豐富的負載均衡機制，但在實際使用的時候，還是會碰到一些複雜的場景是它不能支持的，比如

- 接入已有的負載均衡設備
- 多租戶網絡情況下，容器網絡和主機網絡是隔離的，這樣 `kube-proxy` 就不能正常工作

這個時候就可以自定義組件，並代替 kube-proxy 來做負載均衡。基本的思路是監控 kubernetes 中 service 和 endpoints 的變化，並根據這些變化來配置負載均衡器。比如 weave flux、nginx plus、kube2haproxy 等。

## 集群外部訪問服務

Service 的 ClusterIP 是 Kubernetes 內部的虛擬 IP 地址，無法直接從外部直接訪問。但如果需要從外部訪問這些服務該怎麼辦呢，有多種方法

* 使用 NodePort 服務在每臺機器上綁定一個端口，這樣就可以通過 `<NodeIP>:NodePort` 來訪問該服務。
* 使用 LoadBalancer 服務藉助 Cloud Provider 創建一個外部的負載均衡器，並將請求轉發到 `<NodeIP>:NodePort`。該方法僅適用於運行在雲平臺之中的 Kubernetes 集群。對於物理機部署的集群，可以使用 [MetalLB](https://github.com/google/metallb) 實現類似的功能。
* 使用 Ingress Controller 在 Service 之上創建 L7 負載均衡並對外開放。
* 使用 [ECMP](https://en.wikipedia.org/wiki/Equal-cost_multi-path_routing) 將 Service ClusterIP 網段路由到每個 Node，這樣可以直接通過 ClusterIP 來訪問服務，甚至也可以直接在集群外部使用 kube-dns。這一版用在物理機部署的情況下。

## 參考資料

- https://kubernetes.io/docs/concepts/services-networking/service/
- https://kubernetes.io/docs/concepts/services-networking/ingress/
- https://github.com/kubernetes/contrib/tree/master/service-loadbalancer
- https://www.nginx.com/blog/load-balancing-kubernetes-services-nginx-plus/
- https://github.com/weaveworks/flux
- https://github.com/AdoHe/kube2haproxy
- [Accessing Kubernetes Services Without Ingress, NodePort, or LoadBalancer](https://medium.com/@kyralak/accessing-kubernetes-services-without-ingress-nodeport-or-loadbalancer-de6061b42d72)
