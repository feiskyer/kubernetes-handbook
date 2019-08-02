# Ingress

在本篇文章中你将会看到一些在其他地方被交叉使用的术语，为了防止产生歧义，我们首先来澄清下。

- 节点：Kubernetes 集群中的服务器；
- 集群：Kubernetes 管理的一组服务器集合；
- 边界路由器：为局域网和 Internet 路由数据包的路由器，执行防火墙保护局域网络；
- 集群网络：遵循 Kubernetes[网络模型](https://kubernetes.io/docs/admin/networking/) 实现集群内的通信的具体实现，比如 [flannel](https://github.com/coreos/flannel#flannel) 和 [OVS](https://github.com/openvswitch/ovn-kubernetes)。
- 服务：Kubernetes 的服务 (Service) 是使用标签选择器标识的一组 pod [Service](https://kubernetes.io/docs/user-guide/services/)。 除非另有说明，否则服务的虚拟 IP 仅可在集群内部访问。

## 什么是 Ingress？

通常情况下，service 和 pod 的 IP 仅可在集群内部访问。集群外部的请求需要通过负载均衡转发到 service 在 Node 上暴露的 NodePort 上，然后再由 kube-proxy 通过边缘路由器 (edge router) 将其转发给相关的 Pod 或者丢弃。如下图所示
```
   internet
        |
  ------------
  [Services]
```

而 Ingress 就是为进入集群的请求提供路由规则的集合，如下图所示

![image-20190316184154726](assets/image-20190316184154726.png)

Ingress 可以给 service 提供集群外部访问的 URL、负载均衡、SSL 终止、HTTP 路由等。为了配置这些 Ingress 规则，集群管理员需要部署一个 [Ingress controller](../plugins/ingress.md)，它监听 Ingress 和 service 的变化，并根据规则配置负载均衡并提供访问入口。

## Ingress 格式

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: test-ingress
spec:
  rules:
  - http:
      paths:
      - path: /testpath
        backend:
          serviceName: test
          servicePort: 80
```

每个 Ingress 都需要配置 `rules`，目前 Kubernetes 仅支持 http 规则。上面的示例表示请求 `/testpath` 时转发到服务 `test` 的 80 端口。

## API 版本对照表

| Kubernetes 版本 | Extension 版本            |
| --------------- | ------------------------- |
| v1.5-v1.17      | extensions/v1beta1        |
| v1.8+           | networking.k8s.io/v1beta1 |

## Ingress 类型

根据 Ingress Spec 配置的不同，Ingress 可以分为以下几种类型：

### 单服务 Ingress

单服务 Ingress 即该 Ingress 仅指定一个没有任何规则的后端服务。

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: test-ingress
spec:
  backend:
    serviceName: testsvc
    servicePort: 80
```

> 注：单个服务还可以通过设置 `Service.Type=NodePort` 或者 `Service.Type=LoadBalancer` 来对外暴露。

### 多服务的 Ingress

路由到多服务的 Ingress 即根据请求路径的不同转发到不同的后端服务上，比如

```
foo.bar.com -> 178.91.123.132 -> / foo    s1:80
                                 / bar    s2:80
```

可以通过下面的 Ingress 来定义：

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
      - path: /foo
        backend:
          serviceName: s1
          servicePort: 80
      - path: /bar
        backend:
          serviceName: s2
          servicePort: 80
```

使用 `kubectl create -f` 创建完 ingress 后：

```bash
$ kubectl get ing
NAME      RULE          BACKEND   ADDRESS
test      -
          foo.bar.com
          /foo          s1:80
          /bar          s2:80
```

### 虚拟主机 Ingress

虚拟主机 Ingress 即根据名字的不同转发到不同的后端服务上，而他们共用同一个的 IP 地址，如下所示

```
foo.bar.com --|                 |-> foo.bar.com s1:80
              | 178.91.123.132  |
bar.foo.com --|                 |-> bar.foo.com s2:80
```

下面是一个基于 [Host header](https://tools.ietf.org/html/rfc7230#section-5.4) 路由请求的 Ingress：

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

> 注：没有定义规则的后端服务称为默认后端服务，可以用来方便的处理 404 页面。

### TLS Ingress

TLS Ingress 通过 Secret 获取 TLS 私钥和证书 (名为 `tls.crt` 和 `tls.key`)，来执行 TLS 终止。如果 Ingress 中的 TLS 配置部分指定了不同的主机，则它们将根据通过 SNI TLS 扩展指定的主机名（假如 Ingress controller 支持 SNI）在多个相同端口上进行复用。

定义一个包含 `tls.crt` 和 `tls.key` 的 secret：

```yaml
apiVersion: v1
data:
  tls.crt: base64 encoded cert
  tls.key: base64 encoded key
kind: Secret
metadata:
  name: testsecret
  namespace: default
type: Opaque
```

Ingress 中引用 secret：

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: no-rules-map
spec:
  tls:
    - secretName: testsecret
  backend:
    serviceName: s1
    servicePort: 80
```

注意，不同 Ingress controller 支持的 TLS 功能不尽相同。 请参阅有关 [nginx](https://kubernetes.github.io/ingress-nginx/)，[GCE](https://github.com/kubernetes/ingress-gce) 或任何其他 Ingress controller 的文档，以了解 TLS 的支持情况。

## 更新 Ingress

可以通过 `kubectl edit ing name` 的方法来更新 ingress：

```Bash
$ kubectl get ing
NAME      RULE          BACKEND   ADDRESS
test      -                       178.91.123.132
          foo.bar.com
          /foo          s1:80
$ kubectl edit ing test
```

这会弹出一个包含已有 IngressSpec yaml 文件的编辑器，修改并保存就会将其更新到 kubernetes API server，进而触发 Ingress Controller 重新配置负载均衡：

```yaml
spec:
  rules:
  - host: foo.bar.com
    http:
      paths:
      - backend:
          serviceName: s1
          servicePort: 80
        path: /foo
  - host: bar.baz.com
    http:
      paths:
      - backend:
          serviceName: s2
          servicePort: 80
        path: /foo
..
```

更新后：

```bash
$ kubectl get ing
NAME      RULE          BACKEND   ADDRESS
test      -                       178.91.123.132
          foo.bar.com
          /foo          s1:80
          bar.baz.com
          /foo          s2:80
```

当然，也可以通过 `kubectl replace -f new-ingress.yaml` 命令来更新，其中 new-ingress.yaml 是修改过的 Ingress yaml。

## Ingress Controller

Ingress 正常工作需要集群中运行 Ingress Controller。Ingress Controller 与其他作为 kube-controller-manager 中的在集群创建时自动启动的 controller 成员不同，需要用户选择最适合自己集群的 Ingress Controller，或者自己实现一个。

Ingress Controller 以 Kubernetes Pod 的方式部署，以 daemon 方式运行，保持 watch Apiserver 的 /ingress 接口以更新 Ingress 资源，以满足 Ingress 的请求。比如可以使用 [Nginx Ingress Controller](https://github.com/kubernetes/ingress-nginx)：

```sh
helm install stable/nginx-ingress --name nginx-ingress --set rbac.create=true
```

其他 Ingress Controller 还有：

- [traefik ingress](../practice/service-discovery-lb/service-discovery-and-load-balancing.md) 提供了一个 Traefik Ingress Controller 的实践案例
- [kubernetes/ingress-nginx](https://github.com/kubernetes/ingress-nginx) 提供了一个详细的 Nginx Ingress Controller 示例
- [kubernetes/ingress-gce](https://github.com/kubernetes/ingress-gce) 提供了一个用于 GCE 的 Ingress Controller 示例

## 参考文档

- [Kubernetes Ingress Resource](https://kubernetes.io/docs/concepts/services-networking/ingress/)
- [Kubernetes Ingress Controller](https://github.com/kubernetes/ingress/tree/master)
- [使用 NGINX Plus 负载均衡 Kubernetes 服务](http://dockone.io/article/957)
- [使用 NGINX 和 NGINX Plus 的 Ingress Controller 进行 Kubernetes 的负载均衡](http://www.cnblogs.com/276815076/p/6407101.html)
- [Kubernetes : Ingress Controller with Træfɪk and Let's Encrypt](https://blog.osones.com/en/kubernetes-ingress-controller-with-traefik-and-lets-encrypt.html)
- [Kubernetes : Træfɪk and Let's Encrypt at scale](https://blog.osones.com/en/kubernetes-traefik-and-lets-encrypt-at-scale.html)
- [Kubernetes Ingress Controller-Træfɪk](https://docs.traefik.io/user-guide/kubernetes/)
- [Kubernetes 1.2 and simplifying advanced networking with Ingress](http://blog.kubernetes.io/2016/03/Kubernetes-1.2-and-simplifying-advanced-networking-with-Ingress.html)
