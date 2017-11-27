# Istio和Service Mesh

Istio是Google、IBM和Lyft联合开源的微服务 Service Mesh 框架，旨在解决大量微服务的发现、连接、管理、监控以及安全等问题。Istio对应用是透明的，不需要改动任何服务代码就可以实现透明的服务治理。

Istio的主要特性包括：

- HTTP、gRPC和TCP网络流量的自动负载均衡
- 丰富的路由规则，细粒度的网络流量行为控制
- 流量加密、服务间认证，以及强身份声明
- 全范围（Fleet-wide）策略执行
- 深度遥测和报告

## Service Mesh

Service Mesh（服务网格）是一个用于保证服务间安全、快速、可靠通信的网络代理组件，是随着微服务和云原生应用兴起而诞生的基础设施层。它通常以轻量级网络代理的方式同应用部署在一起（比如sidecar方式，如下图所示）。Serivce Mesh可以看作是一个位于TCP/IP之上的网络模型，抽象了服务间可靠通信的机制。但与TCP不同，它是面向应用的，为应用提供了统一的可视化和控制。

![](images/pattern-service-mesh.png)

为了保证服务间通信的可靠性，Service Mesh需要支持熔断机制、延迟感知的负载均衡、服务发现、重试等一些列的特性。比如Linkerd处理一个请求的流程包括

- 查找动态路由确定请求的服务
- 查找该服务的实例
- Linkerd跟响应延迟等因素选择最优的实例
- 将请求转发给最优实例，记录延迟和响应情况
- 如果请求失败或实例实效，则转发给其他实例重试（需要是幂等请求）
- 如果请求超时，则直接失败，避免给后端增加更多的负载
- 记录请求的度量和分布式跟踪情况

为什么Service Mesh是必要的

- 将服务治理与实际服务解耦，避免微服务化过程中对应用的侵入
- 加速传统应用转型微服务或云原生应用

Service Mesh并非一个全新的功能，而是将已存在于众多应用之中的相关功能分离出来，放到统一的组件来管理。特别是在微服务应用中，服务数量庞大，并且可能是基于不同的框架和语言构建，分离出来的Service Mesh组件更容易管理和协调它们。

## Istio原理

Istio从逻辑上可以分为数据平面和控制平面：

- 数据平面主要由一系列的智能代理（Envoy）组成，管理微服务之间的网络通信
- 控制平面负责管理和配置这些智能代理，并动态执行策略

Istio架构可以如下图所示

![](images/istio.png)

主要由以下组件构成

- [Envoy](https://lyft.github.io/envoy/)：Lyft开源的高性能代理总线，支持动态服务发现、负载均衡、TLS终止、HTTP/2和gPRC代理、健康检查、性能测量等功能。Envoy以sidecar的方式部署在相关的服务的Pod中。
- Mixer：负责访问控制、执行策略并从Envoy代理中收集遥测数据。Mixer支持灵活的插件模型，方便扩展（支持GCP、AWS、Prometheus、Heapster等多种后端）
- Istio-Auth：提供服务间和终端用户的认证机制
- Pilot：动态管理Envoy示例的生命周期，提供服务发现、流量管理、智能路由以及超时、熔断等弹性控制的功能。其与Envoy的关系如下图所示

![](images/istio-service.png)

在数据平面上，除了[Envoy](https://lyft.github.io/envoy/)，还可以选择使用 [nginxmesh](https://github.com/nginmesh/nginmesh) 和 [linkerd](https://linkerd.io/getting-started/istio/) 作为网络代理。比如，使用nginxmesh时，Istio的控制平面（Pilot、Mixer、Auth）保持不变，但用Nginx Sidecar取代Envoy：

![](images/nginx_sidecar.png)

## 安装

> Istio目前仅支持Kubernetes，在部署Istio之前需要先部署好Kubernetes集群并配置好kubectl客户端。

### 下载Istio

```sh
curl -L https://git.io/getLatestIstio | sh -
cd istio-0.2.12/
cp bin/istioctl /usr/local/bin
```

### 部署Istio服务

两种方式（选择其一执行）

- 禁止Auth：`kubectl apply -f install/kubernetes/istio.yaml`
- 启用Auth：`kubectl apply -f install/kubernetes/istio-auth.yaml`

部署完成后，可以检查 isotio-system namespace 中的服务是否正常运行：

```sh
$ kubectl -n istio-system get pod
NAME                             READY     STATUS    RESTARTS   AGE
istio-ca-5cd46b967c-q5th6        1/1       Running   0          3m
istio-egress-56c4d999bc-82js4    1/1       Running   0          3m
istio-ingress-5747bb855f-tv98x   1/1       Running   0          3m
istio-mixer-77487797f6-cwtqt     2/2       Running   0          3m
istio-pilot-86ddcb7ff5-t2zpk     1/1       Running   0          3m
```

### 部署Prometheus、Grafana和Zipkin插件

```sh
kubectl apply -f install/kubernetes/addons/grafana.yaml
kubectl apply -f install/kubernetes/addons/servicegraph.yaml
kubectl apply -f install/kubernetes/addons/zipkin.yaml
kubectl apply -f install/kubernetes/addons/prometheus.yaml
# kubectl apply -f install/kubernetes/addons/zipkin-to-stackdriver.yaml
```

等一会所有Pod启动后，可以通过NodePort或负载均衡服务的外网IP来访问这些服务。比如通过NodePort方式，先查询服务的NodePort

```sh
$ kubectl -n istio-system get svc grafana -o jsonpath='{.spec.ports[0].nodePort}'
32070
$ kubectl -n istio-system get svc servicegraph -o jsonpath='{.spec.ports[0].nodePort}'
31072
$ kubectl -n istio-system get svc zipkin -o jsonpath='{.spec.ports[0].nodePort}'
30032
$ kubectl -n istio-system get svc prometheus -o jsonpath='{.spec.ports[0].nodePort}'
30890
```

通过`http://<kubernetes-ip>:32070/dashboard/db/istio-dashboard`访问Grafana服务

![](images/grafana.png)

通过`http://<kubernetes-ip>:31072/dotviz`访问ServiceGraph服务，展示服务之间调用关系图

![](images/servicegraph.png)

通过`http://<kubernetes-ip>:30032`访问Zipkin跟踪页面

![](images/zipkin.png)

通过`http://<kubernetes-ip>:30890`访问Prometheus页面

![](images/prometheus.png)

## 部署示例应用

在部署应用时，需要通过`istioctl kube-inject`给Pod自动插入Envoy容器，即

```sh
wget https://raw.githubusercontent.com/istio/istio/master/blog/bookinfo-v1.yaml
# inject with istioctl
kubectl apply -f <(istioctl kube-inject -f bookinfo-v1.yaml)

# create ingress
cat <<EOF | kubectl create -f -
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
 name: bookinfo
 annotations:
   kubernetes.io/ingress.class: "istio"
spec:
 rules:
 - http:
     paths:
     - path: /productpage
       backend:
         serviceName: productpage
         servicePort: 9080
     - path: /login
       backend:
         serviceName: productpage
         servicePort: 9080
     - path: /logout
       backend:
         serviceName: productpage
         servicePort: 9080
EOF
```

原始应用如下图所示

![](images/bookinfo.png)

`istioctl kube-inject`在原始应用的每个Pod中插入了一个Envoy容器

![](images/bookinfo2.png)

服务启动后，可以通过Ingress地址`http://<ingress-address>/productpage`来访问BookInfo应用

```sh
$ kubectl describe ingress
Name:			gateway
Namespace:		default
Address:		192.168.0.77
Default backend:	default-http-backend:80 (10.8.0.4:8080)
Rules:
  Host	Path	Backends
  ----	----	--------
  *
    	/productpage 	productpage:9080 (<none>)
    	/login 		productpage:9080 (<none>)
    	/logout 	productpage:9080 (<none>)
Annotations:
Events:	<none>
```

![](images/productpage.png)

## 金丝雀部署

首先部署v2版本的应用，并配置默认路由到v1版本：

```sh
wget https://raw.githubusercontent.com/istio/istio/master/blog/bookinfo-ratings.yaml
kubectl apply -f <(istioctl kube-inject -f bookinfo-ratings.yaml)

wget https://raw.githubusercontent.com/istio/istio/master/blog/bookinfo-reviews-v2.yaml
kubectl apply -f <(istioctl kube-inject -f bookinfo-reviews-v2.yaml)

# create default route
cat <<EOF | istioctl create -f -
apiVersion: config.istio.io/v1alpha2
kind: RouteRule
metadata:
  name: reviews-default
spec:
  destination:
    name: reviews
  route:
  - labels:
      version: v1
    weight: 100
EOF
```

示例一：将 10% 请求发送到 v2 版本而其余 90% 发送到 v1 版本

```sh
cat <<EOF | istioctl create -f -
apiVersion: config.istio.io/v1alpha2
kind: RouteRule
metadata:
  name: reviews-default
spec:
  destination:
    name: reviews
  route:
  - labels:
      version: v2
    weight: 10
  - labels:
      version: v1
    weight: 90
EOF
```

示例二：将特定用户的请求全部发到 v2 版本

```sh

cat <<EOF | istioctl create -f -
apiVersion: config.istio.io/v1alpha2
kind: RouteRule
metadata:
 name: reviews-test-v2
spec:
 destination:
   name: reviews
 precedence: 2
 match:
   request:
     headers:
       cookie:
         regex: "^(.*?;)?(user=jason)(;.*)?$"
 route:
 - labels:
     version: v2
   weight: 100
EOF
```

示例三：全部切换到 v2 版本

```sh
cat <<EOF | istioctl replace -f -
apiVersion: config.istio.io/v1alpha2
kind: RouteRule
metadata:
  name: reviews-default
spec:
  destination:
    name: reviews
  route:
  - labels:
      version: v2
    weight: 100
EOF
```

示例四：限制并发访问

```sh
# configure a memquota handler with rate limits
cat <<EOF | istioctl create -f -
apiVersion: "config.istio.io/v1alpha2"
kind: memquota
metadata:
 name: handler
 namespace: default
spec:
 quotas:
 - name: requestcount.quota.default
   maxAmount: 5000
   validDuration: 1s
   overrides:
   - dimensions:
       destination: ratings
     maxAmount: 1
     validDuration: 1s
EOF

# create quota instance that maps incoming attributes to quota dimensions, and createrule that uses it with the memquota handler
cat <<EOF | istioctl create -f -
apiVersion: "config.istio.io/v1alpha2"
kind: quota
metadata:
 name: requestcount
 namespace: default
spec:
 dimensions:
   source: source.labels["app"] | source.service | "unknown"
   sourceVersion: source.labels["version"] | "unknown"
   destination: destination.labels["app"] | destination.service | "unknown"
   destinationVersion: destination.labels["version"] | "unknown"
---
apiVersion: "config.istio.io/v1alpha2"
kind: rule
metadata:
 name: quota
 namespace: default
spec:
 actions:
 - handler: handler.memquota
   instances:
   - requestcount.quota
EOF
```

为了查看访问次数限制的效果，可以使用 [wrk](https://github.com/wg/wrk) 给应用加一些压力：

```sh
export BOOKINFO_URL=$(kubectl get po -n istio-system -l istio=ingress -o jsonpath={.items[0].status.hostIP}):$(kubectl get svc -n istio-system istio-ingress -o jsonpath={.spec.ports[0].nodePort})
wrk -t1 -c1 -d20s http://$BOOKINFO_URL/productpage
```

## 参考文档

- <https://istio.io/>
- [Istio - A modern service mesh](https://istio.io/talks/istio_talk_gluecon_2017.pdf)
- <https://lyft.github.io/envoy/>
- <https://github.com/nginmesh/nginmesh>
- [WHAT’S A SERVICE MESH? AND WHY DO I NEED ONE?](https://buoyant.io/2017/04/25/whats-a-service-mesh-and-why-do-i-need-one/)
- [A SERVICE MESH FOR KUBERNETES](https://buoyant.io/2016/10/04/a-service-mesh-for-kubernetes-part-i-top-line-service-metrics/)
- [Service Mesh Pattern](http://philcalcado.com/2017/08/03/pattern_service_mesh.html)
- [Request Routing and Policy Management with the Istio Service Mesh](http://blog.kubernetes.io/2017/10/request-routing-and-policy-management.html)
