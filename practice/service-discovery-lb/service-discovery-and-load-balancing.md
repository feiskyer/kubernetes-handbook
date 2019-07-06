# Traefik ingress

[Traefik](https://traefik.io/) 是一款开源的反向代理与负载均衡工具，它监听后端的变化并自动更新服务配置。Traefik 最大的优点是能够与常见的微服务系统直接整合，可以实现自动化动态配置。目前支持 Docker、Swarm,Marathon、Mesos、Kubernetes、Consul、Etcd、Zookeeper、BoltDB 和 Rest API 等后端模型。

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

## Helm 部署 Traefik

```sh
# Setup domain, user and password first.
$ export USER=user
$ export DOMAIN=ingress.feisky.xyz
$ htpasswd -c auth $USER
New password:
Re-type new password:
Adding password for user user
$ PASSWORD=$(cat auth| awk -F: '{print $2}')

# Deploy with helm.
helm install stable/traefik --name --namespace kube-system --set rbac.enabled=true,acme.enabled=true,dashboard.enabled=true,acme.staging=false,acme.email=admin@$DOMAIN,dashboard.domain=ui.$DOMAIN,ssl.enabled=true,acme.challengeType=http-01,dashboard.auth.basic.$USER=$PASSWORD
```

稍等一会，traefik Pod 就会运行起来：

```sh
$ kubectl -n kube-system get pod -l app=traefik
NAME                       READY     STATUS    RESTARTS   AGE
traefik-65d8dc4489-k97cg   1/1       Running   0          5m

$ kubectl -n kube-system get ingress
NAME                HOSTS                   ADDRESS   PORTS     AGE
traefik-dashboard   ui.ingress.feisky.xyz             80        25m

$ kubectl -n kube-system get svc traefik
NAME      TYPE           CLUSTER-IP    EXTERNAL-IP     PORT(S)                      AGE
traefik   LoadBalancer   10.0.206.26   172.20.0.115    80:31662/TCP,443:32618/TCP   24m
```

通过配置 DNS 解析（CNAME 记录域名到 Ingress Controller 服务的外网IP）、修改 `/etc/hosts` 添加域名映射（见下述测试部分）或者使用 `xip.io` （参考 [minikube ingress 使用方法](../minikube-ingress.md)）等方法，就可以通过配置的域名直接访问所需服务了。比如上述的 Dashboard 服务可以通过域名 `ui.ingress.feisky.xyz` 来访问：

![kubernetes-dashboard](images/traefik-dashboard.jpg)

上图中，左侧黄色部分部分列出的是所有的rule，右侧绿色部分是所有的backend。

## Ingress 示例

下面来看一个更复杂的示例。**创建名为`traefik-ingress`的 ingress**，文件名traefik.yaml

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: traefik-ingress
  annotations:
    kubernetes.io/ingress.class: traefik
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

如果你需要在 kubernetes 集群以外访问就需要设置 DNS，或者修改本机的hosts文件在其中加入：

```sh
172.20.0.115 traefik.nginx.io
172.20.0.115 traefik.frontend.io
```

所有访问这些地址的流量都会发送给 `172.20.0.115` 这台主机，就是我们启动traefik的主机。Traefik会解析http请求header里的Host参数将流量转发给Ingress配置里的相应service。

![traefik-nginx](images/traefik-nginx.jpg)

![traefik-guestbook](images/traefik-guestbook.jpg)

## 参考文档

- [Traefik简介](http://www.tuicool.com/articles/ZnuEfay)
- [Guestbook example](https://github.com/kubernetes/examples/tree/master/guestbook)
