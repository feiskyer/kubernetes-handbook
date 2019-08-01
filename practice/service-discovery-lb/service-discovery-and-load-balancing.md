# Traefik ingress

[Traefik](https://traefik.io/) 是一款開源的反向代理與負載均衡工具，它監聽後端的變化並自動更新服務配置。Traefik 最大的優點是能夠與常見的微服務系統直接整合，可以實現自動化動態配置。目前支持 Docker、Swarm,Marathon、Mesos、Kubernetes、Consul、Etcd、Zookeeper、BoltDB 和 Rest API 等後端模型。

![](https://docs.traefik.io/img/architecture.png)

主要功能包括

- Golang編寫，部署容易
- 快（nginx的85%)
- 支持眾多的後端（Docker, Swarm, Kubernetes, Marathon, Mesos, Consul, Etcd等）
- 內置Web UI、Metrics和Let’s Encrypt支持，管理方便
- 自動動態配置
- 集群模式高可用
- 支持 [Proxy Protocol](https://www.haproxy.org/download/1.8/doc/proxy-protocol.txt)

## Ingress簡介

簡單的說，ingress就是從kubernetes集群外訪問集群的入口，將用戶的URL請求轉發到不同的service上。Ingress相當於nginx、apache等負載均衡反向代理服務器，其中還包括規則定義，即URL的路由信息，路由信息的刷新由 [Ingress controller](https://kubernetes.io/docs/concepts/services-networking/ingress/#ingress-controllers) 來提供。

Ingress Controller 實質上可以理解為是個監視器，Ingress Controller 通過不斷地跟 kubernetes API 打交道，實時的感知後端 service、pod 等變化，比如新增和減少 pod，service 增加與減少等；當得到這些變化信息後，Ingress Controller 再結合下文的 Ingress 生成配置，然後更新反向代理負載均衡器，並刷新其配置，達到服務發現的作用。

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

稍等一會，traefik Pod 就會運行起來：

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

通過配置 DNS 解析（CNAME 記錄域名到 Ingress Controller 服務的外網IP）、修改 `/etc/hosts` 添加域名映射（見下述測試部分）或者使用 `xip.io` （參考 [minikube ingress 使用方法](../minikube-ingress.md)）等方法，就可以通過配置的域名直接訪問所需服務了。比如上述的 Dashboard 服務可以通過域名 `ui.ingress.feisky.xyz` 來訪問：

![kubernetes-dashboard](images/traefik-dashboard.jpg)

上圖中，左側黃色部分部分列出的是所有的rule，右側綠色部分是所有的backend。

## Ingress 示例

下面來看一個更復雜的示例。**創建名為`traefik-ingress`的 ingress**，文件名traefik.yaml

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

- `backend`中要配置 default namespace 中啟動的 service 名字
- `path`就是URL地址後的路徑，如`traefik.frontend.io/path`
- host 最好使用 `service-name.filed1.filed2.domain-name` 這種類似主機名稱的命名方式，方便區分服務

根據你自己環境中部署的 service 名稱和端口自行修改，有新 service 增加時，修改該文件後可以使用`kubectl replace -f traefik.yaml`來更新。

## 測試

在集群的任意一個節點上執行。假如現在我要訪問nginx的"/"路徑。

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

如果你需要在 kubernetes 集群以外訪問就需要設置 DNS，或者修改本機的hosts文件在其中加入：

```sh
172.20.0.115 traefik.nginx.io
172.20.0.115 traefik.frontend.io
```

所有訪問這些地址的流量都會發送給 `172.20.0.115` 這臺主機，就是我們啟動traefik的主機。Traefik會解析http請求header裡的Host參數將流量轉發給Ingress配置裡的相應service。

![traefik-nginx](images/traefik-nginx.jpg)

![traefik-guestbook](images/traefik-guestbook.jpg)

## 參考文檔

- [Traefik簡介](http://www.tuicool.com/articles/ZnuEfay)
- [Guestbook example](https://github.com/kubernetes/examples/tree/master/guestbook)
