# Linkerd

Linkerd是一个面向云原生应用的Service Mesh组件，也是CNCF项目之一。它为服务间通信提供了一个统一的管理和控制平面，并且解耦了应用程序代码和通信机制，从而无需更改应用程序就可以可视化控制服务间的通信。linkerd实例是无状态的，可以以每个应用一个实例(sidecar)或者每台Node一个实例的方式部署。

![](images/linkerd.png)

Linkerd的主要特性包括

- 服务发现
- 动态请求路由
- HTTP代理集成，支持HTTP、TLS、gRPC、HTTP/2等
- 感知时延的负载均衡，支持多种负载均衡算法，如Power of Two Choices (P2C) Least Loaded、Power of Two Choices (P2C) peak ewma、Aperture: least loaded、Heap: least loaded、Round robin等
- 熔断机制，自动移除不健康的后端实例，包括fail fast（只要连接失败就移除实例）和failure accrual（超过5个请求处理失败时才将其标记为失效，并保留一定的恢复时间 ）两种
- 分布式跟踪和度量

## Service Mesh

Service Mesh是一个用于保证服务间安全、快速、可靠通信的基础组件，特别适用于云原生应用中。它通常以轻量级网络代理的方式同应用部署在一起。Serivce Mesh可以看作是一个位于TCP/IP之上的网络模型，抽象了服务间可靠通信的机制。但与TCP不同，它是面向应用的，为应用提供了统一的可视化和控制。

为了保证服务间通信的可靠性，Service Mesh需要支持熔断机制、延迟感知的负载均衡、服务发现、重试等一些列的特性。比如Linkerd处理一个请求的流程包括

- 查找动态路由确定请求的服务
- 查找该服务的实例
- Linkerd跟响应延迟等因素选择最优的实例
- 将请求转发给最优实例，记录延迟和响应情况
- 如果请求失败或实例实效，则转发给其他实例重试（需要是幂等请求）
- 如果请求超时，则直接失败，避免给后端增加更多的负载
- 记录请求的度量和分布式跟踪情况

Service Mesh并非一个全新的功能，而是将已存在于众多应用之中的相关功能分离出来，放到统一的组件来管理。特别是在微服务应用中，服务数量庞大，并且可能是基于不同的框架和语言构建，分离出来的Service Mesh组件更容易管理和协调它们。

## Linkerd原理

Linkerd路由将请求处理分解为多个步骤

- (1) IDENTIFICATION：为实际请求设置逻辑名字（即请求的目的服务），如默认将HTTP请求`GET http://example/hello`赋值名字`/svc/example`
- (2) BINDING：dtabs负责将逻辑名与客户端名字绑定起来，客户端名字总是以`/#`或`/$`开头，比如
```sh
# 假设dtab为
/env => /#/io.l5d.serversets/discovery
/svc => /env/prod

# 那么服务名/svc/users将会绑定为
/svc/users
/env/prod/users
/#/io.l5d.serversets/discovery/prod/users
```
- (3) RESOLUTION：namer负责解析客户端名，并得到真实的服务地址（IP+端口）
- (4) LOAD BALANCING：根据负载均衡算法选择如何发送请求

![](images/linkerd-routing.png)

## Linkerd部署

Linkerd以DaemonSet的方式部署在每个Node节点上：

```sh
# Deploy linkerd.
# For CNI, deploy linkerd-cni.yml instead.
# kubectl apply -f https://github.com/linkerd/linkerd-examples/raw/master/k8s-daemonset/k8s/linkerd-cni.yml
kubectl apply -f https://raw.githubusercontent.com/linkerd/linkerd-examples/master/k8s-daemonset/k8s/linkerd.yml

# Deploy linked-viz.
kubectl apply -f https://raw.githubusercontent.com/linkerd/linkerd-viz/master/k8s/linkerd-viz.yml
```

默认情况下，Linkerd的Dashboard监听在每个容器实例的9990端口，可以通过服务的相应端口来访问。

```sh
INGRESS_LB=$(kubectl get svc l5d -o jsonpath="{.status.loadBalancer.ingress[0].*}")
echo "open http://$INGRESS_LB:9990 in browser"

VIZ_INGRESS_LB=$(kubectl get svc linkerd-viz -o jsonpath="{.status.loadBalancer.ingress[0].*}")
echo "open http://$VIZ_INGRESS_LB in browser"
```

对于不支持LoadBalancer的集群，可以通过NodePort来访问

```sh
HOST_IP=$(kubectl get po -l app=l5d -o jsonpath="{.items[0].status.hostIP}")
echo "open http://$HOST_IP:$(kubectl get svc l5d -o 'jsonpath={.spec.ports[2].nodePort}') in browser"
```

应用程序在使用Linkerd时需要为应用设置HTTP代理，其中

- HTTP使用`$(NODE_NAME):4140`
- HTTP/2使用`$(NODE_NAME):4240`
- gRPC使用`$(NODE_NAME):4340`

在Kubernetes中，可以使用Downward API来获取`NODE_NAME`，比如

```yaml
    env:
    - name: NODE_NAME
      valueFrom:
        fieldRef:
          fieldPath: spec.nodeName
    - name: http_proxy
      value: $(NODE_NAME):4140
```

### 开启TLS

```sh
kubectl apply -f https://raw.githubusercontent.com/linkerd/linkerd-examples/master/k8s-daemonset/k8s/certificates.yml
kubectl delete ds/l5d configmap/l5d-config
kubectl apply -f https://raw.githubusercontent.com/linkerd/linkerd-examples/master/k8s-daemonset/k8s/linkerd-tls.yml
```

### Zipkin

```sh
# Deploy zipkin.
kubectl apply -f https://raw.githubusercontent.com/linkerd/linkerd-examples/master/k8s-daemonset/k8s/zipkin.yml

# Deploy linkerd for zipkin.
kubectl apply -f https://raw.githubusercontent.com/linkerd/linkerd-examples/master/k8s-daemonset/k8s/linkerd-zipkin.yml

# Get zipkin endpoint.
ZIPKIN_LB=$(kubectl get svc zipkin -o jsonpath="{.status.loadBalancer.ingress[0].*}")
echo "open http://$ZIPKIN_LB in browser"
```

### Ingress Controller

Linkerd也可以作为Kubernetes Ingress Controller使用，注意下面的步骤将Linkerd部署到了l5d-system namespace。

```sh
kubectl create ns l5d-system
kubectl apply -f https://raw.githubusercontent.com/linkerd/linkerd-examples/master/k8s-daemonset/k8s/linkerd-ingress-controller.yml -n l5d-system

L5D_SVC_IP=$(kubectl get svc l5d -n l5d-system -o jsonpath="{.status.loadBalancer.ingress[0].*}")
echo "open http://$L5D_SVC_IP:9990 in browser"
```

## Linkerd使用示例

接下来部署两个测试服务。

首先验证Kubernetes集群是否支持nodeName，正常情况下`node-name-test`容器会输出一个nslookup解析后的IP地址：

```sh
kubectl apply -f https://raw.githubusercontent.com/linkerd/linkerd-examples/master/k8s-daemonset/k8s/node-name-test.yml
kubectl logs node-name-test
```

然后部署hello world示例：

```
kubectl apply -f https://raw.githubusercontent.com/linkerd/linkerd-examples/master/k8s-daemonset/k8s/hello-world.yml
kubectl apply -f https://raw.githubusercontent.com/linkerd/linkerd-examples/master/k8s-daemonset/k8s/world-v2.yml
```

通过Linkerd代理访问服务

```sh
$ http_proxy=$INGRESS_LB:4140 curl -s http://hello
Hello (10.12.2.5) world (10.12.0.6)!!
```

如果开启了Linkerd ingress controller，那么可以继续创建Ingress：

```sh
kubectl apply -f https://raw.githubusercontent.com/linkerd/linkerd-examples/master/k8s-daemonset/k8s/hello-world-ingress.yml

curl ${L5D_SVC_IP}
curl -H "Host: world.v2" $L5D_SVC_IP
```

## 参考文档

- [WHAT’S A SERVICE MESH? AND WHY DO I NEED ONE?](https://buoyant.io/2017/04/25/whats-a-service-mesh-and-why-do-i-need-one/)
- [Linkerd官方文档](https://linkerd.io/documentation/)
- [A SERVICE MESH FOR KUBERNETES](https://buoyant.io/2016/10/04/a-service-mesh-for-kubernetes-part-i-top-line-service-metrics/)
- [Linkerd examples](https://github.com/linkerd/linkerd-examples)

