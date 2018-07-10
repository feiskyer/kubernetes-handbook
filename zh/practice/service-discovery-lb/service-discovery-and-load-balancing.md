# Traefik ingress

[Traefik](https://traefik.io/) 是一款开源的反向代理与负载均衡工具，它监听后端的变化并自动更新服务配置。Traefik 最大的优点是能够与常见的微服务系统直接整合，可以实现自动化动态配置。目前支持 Docker、Swarm,、Mesos/Marathon、Mesos、Kubernetes、Consul、Etcd、Zookeeper、BoltDB 和 Rest API 等后端模型。

![](https://docs.traefik.io/img/architecture.png)

主要功能包括

- Golang编写，部署容易
- 快（nginx的85%)
- 支持众多的后端（Docker, Swarm, Kubernetes, Marathon, Mesos, Consul, Etcd等）
- 内置Web UI、Metrics和Let’s Encrypt支持，管理方便
- 自动动态配置
- 集群模式高可用
- 支持 [Proxy Protocol](https://www.haproxy.org/download/1.8/doc/proxy-protocol.txt)

## Ingress简介

简单的说，ingress就是从kubernetes集群外访问集群的入口，将用户的URL请求转发到不同的service上。Ingress相当于nginx、apache等负载均衡反向代理服务器，其中还包括规则定义，即URL的路由信息，路由信息的刷新由 [Ingress controller](https://kubernetes.io/docs/concepts/services-networking/ingress/#ingress-controllers) 来提供。

Ingress Controller 实质上可以理解为是个监视器，Ingress Controller 通过不断地跟 kubernetes API 打交道，实时的感知后端 service、pod 等变化，比如新增和减少 pod，service 增加与减少等；当得到这些变化信息后，Ingress Controller 再结合下文的 Ingress 生成配置，然后更新反向代理负载均衡器，并刷新其配置，达到服务发现的作用。

## 部署Traefik

以下配置文件可以在Traefik GitHub仓库中的[examples/k8s/traefik-rbac.yaml](https://github.com/containous/traefik/tree/master/examples/k8s/traefik-rbac.yaml)找到。

**创建 ingress-rbac.yaml** 用于 service account 认证：

```yaml
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

执行下面的命令创建 Traefik 角色绑定

```sh
kubectl apply -f https://raw.githubusercontent.com/containous/traefik/master/examples/k8s/traefik-rbac.yaml
```

**创建 Traefik Depeloyment**

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
  namespace: kube-system
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

执行下面的命令创建 Traefik Deployment：

```sh
kubectl apply -f https://raw.githubusercontent.com/containous/traefik/master/examples/k8s/traefik-deployment.yaml
```

Traefik 也支持以 DaemonSet 的方式部署（注意如果已经创建了 Traefik Deployment，则不需要再创建 DaemonSet）

```sh
kubectl apply -f https://raw.githubusercontent.com/containous/traefik/master/examples/k8s/traefik-ds.yaml
```

稍等一会，`traefik-ingress-controller` Pod 就会运行起来：

```sh
$ kubectl -n kube-system get pod -l k8s-app=traefik-ingress-lb
NAME                                          READY     STATUS    RESTARTS   AGE
traefik-ingress-controller-7fbcc689f5-4bxgg   1/1       Running   0          3m

$ kubectl -n kube-system get svc traefik-ingress-service
NAME                      TYPE       CLUSTER-IP    EXTERNAL-IP   PORT(S)                       AGE
traefik-ingress-service   NodePort   10.0.73.148   <none>        80:32563/TCP,8080:30206/TCP   3m
```

可以看到 Traefik Ingress 服务监听在 32563 （Ingress 入口） 和 30206 （UI）两个 NodePort上面，可以通过 `<master-ip>:<nodePort>` 来访问它们。

## Helm 部署

除了直接创建 Deployment 方法，还可以使用 Helm 便捷部署 Traefik：

```sh
$ helm install stable/traefik --name my-release --namespace kube-system

# Watch the service status
$ kubectl get svc my-release-traefik --namespace kube-system -w

# Once EXTERNAL-IP is no longer <pending>, get external IP
$ kubectl describe service my-release-traefik -n kube-system | grep Ingress | awk '{print $3}'
```

## UI Ingress

最简单的 Ingress 就是创建一个 Traefik UI 的访问入口：

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
  - host: traefik-ui.minikube
    http:
      paths:
      - backend:
          serviceName: traefik-web-ui
          servicePort: 80
```

配置完成后就可以创建 UI ingress：

```
kubectl apply -f https://raw.githubusercontent.com/containous/traefik/master/examples/k8s/ui.yaml
```

前面看到 Ingress Controller 服务监听在 32563 端口，可以通过下面的方式访问

```sh
$ curl -H Host:traefik-ui.minikube <master-ip>:32563
<a href="/dashboard/">Found</a>.
```

通过配置 DNS 解析（CNAME 记录域名到 Ingress Controller 服务的外网IP）、修改 `/etc/hosts` 添加域名映射（见下述测试部分）或者使用 `xip.io` （参考 [minikube ingress 使用方法](../minikube-ingress.md)）等方法，就可以通过配置的域名直接访问所需服务了。比如上述的 UI 服务可以通过域名 `traefik-ui.minikube` 来访问（当然也可以通过 NodePort访问  `<master-ip:>30206`）：

![kubernetes-dashboard](images/traefik-dashboard.jpg)

上图中，左侧黄色部分部分列出的是所有的rule，右侧绿色部分是所有的backend。

## Ingree 示例

下面来看一个更复杂的示例。**创建名为`traefik-ingress`的 ingress**，文件名traefik.yaml

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

其中，

- `backend`中要配置 default namespace 中启动的 service 名字
- `path`就是URL地址后的路径，如`traefik.frontend.io/path`
- host 最好使用 `service-name.filed1.filed2.domain-name` 这种类似主机名称的命名方式，方便区分服务

根据你自己环境中部署的 service 名称和端口自行修改，有新 service 增加时，修改该文件后可以使用`kubectl replace -f traefik.yaml`来更新。

## 测试

在集群的任意一个节点上执行。假如现在我要访问nginx的"/"路径。

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

如果你需要在kubernetes集群以外访问就需要设置DNS，或者修改本机的hosts文件。

在其中加入：

```
172.20.0.115 traefik.nginx.io
172.20.0.115 traefik.frontend.io
```

所有访问这些地址的流量都会发送给172.20.0.115这台主机，就是我们启动traefik的主机。

Traefik会解析http请求header里的Host参数将流量转发给Ingress配置里的相应service。

修改hosts后就就可以在kubernetes集群外访问以上两个service，如下图：

![traefik-nginx](images/traefik-nginx.jpg)



![traefik-guestbook](images/traefik-guestbook.jpg)

## 参考文档

- [Traefik-kubernetes 初试](http://www.colabug.com/thread-1703745-1-1.html)
- [Traefik简介](http://www.tuicool.com/articles/ZnuEfay)
- [Guestbook example](https://github.com/kubernetes/examples/tree/master/guestbook)
