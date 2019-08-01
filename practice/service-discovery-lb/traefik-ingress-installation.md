# 安裝traefik ingress

## Ingress簡介

簡單的說，ingress就是從kubernetes集群外訪問集群的入口，將用戶的URL請求轉發到不同的service上。Ingress相當於nginx、apache等負載均衡方向代理服務器，其中還包括規則定義，即URL的路由信息，路由信息得的刷新由[Ingress controller](https://kubernetes.io/docs/concepts/services-networking/ingress/#ingress-controllers)來提供。

Ingress Controller 實質上可以理解為是個監視器，Ingress Controller 通過不斷地跟 kubernetes API 打交道，實時的感知後端 service、pod 等變化，比如新增和減少 pod，service 增加與減少等；當得到這些變化信息後，Ingress Controller 再結合下文的 Ingress 生成配置，然後更新反向代理負載均衡器，並刷新其配置，達到服務發現的作用。

## 部署Traefik

**介紹traefik**

[Traefik](https://traefik.io/)是一款開源的反向代理與負載均衡工具。它最大的優點是能夠與常見的微服務系統直接整合，可以實現自動化動態配置。目前支持Docker, Swarm, Mesos/Marathon, Mesos, Kubernetes, Consul, Etcd, Zookeeper, BoltDB, Rest API等等後端模型。

以下配置文件可以在Traefik GitHub倉庫中的[examples/k8s/traefik-rbac.yaml](https://github.com/containous/traefik/tree/master/examples/k8s/traefik-rbac.yaml)找到。

**創建ingress-rbac.yaml**

將用於service account驗證。

```Yaml
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

```sh
kubectl apply -f https://raw.githubusercontent.com/containous/traefik/master/examples/k8s/traefik-rbac.yaml
```

**創建Depeloyment**

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

```sh
# 使用deployment部署
kubectl apply -f https://raw.githubusercontent.com/containous/traefik/master/examples/k8s/traefik-deployment.yaml
# 也可以使用daemonset來部署
# kubectl apply -f https://raw.githubusercontent.com/containous/traefik/master/examples/k8s/traefik-ds.yaml
```

注意我們這裡用的是Deploy類型，沒有限定該pod運行在哪個主機上。Traefik的端口是8580。

**創建名為`traefik-ingress`的ingress**，文件名traefik.yaml

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

這其中的`backend`中要配置default namespace中啟動的service名字。`path`就是URL地址後的路徑，如traefik.frontend.io/path，service將會接受path這個路徑，host最好使用service-name.filed1.filed2.domain-name這種類似主機名稱的命名方式，方便區分服務。

根據你自己環境中部署的service的名字和端口自行修改，有新service增加時，修改該文件後可以使用`kubectl replace -f traefik.yaml`來更新。

**Traefik UI**

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
  - host: traefik-ui.nginx.io
    http:
      paths:
      - backend:
          serviceName: traefik-web-ui
          servicePort: 80
```

配置完成後就可以啟動treafik ingress了。

```
kubectl create -f .
```

我查看到traefik的pod在`172.20.0.115`這臺節點上啟動了。

訪問該地址`http://172.20.0.115:8580/`將可以看到dashboard。

![kubernetes-dashboard](images/traefik-dashboard.jpg)

左側黃色部分部分列出的是所有的rule，右側綠色部分是所有的backend。

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

如果你需要在kubernetes集群以外訪問就需要設置DNS，或者修改本機的hosts文件。

在其中加入：

```
172.20.0.115 traefik.nginx.io
172.20.0.115 traefik.frontend.io
```

所有訪問這些地址的流量都會發送給172.20.0.115這臺主機，就是我們啟動traefik的主機。

Traefik會解析http請求header裡的Host參數將流量轉發給Ingress配置裡的相應service。

修改hosts後就就可以在kubernetes集群外訪問以上兩個service，如下圖：

![traefik-nginx](images/traefik-nginx.jpg)

![traefik-guestbook](images/traefik-guestbook.jpg)

## 參考文檔

- [Traefik簡介](http://www.tuicool.com/articles/ZnuEfay)
- [Guestbook example](https://github.com/kubernetes/kubernetes/tree/master/examples/guestbook)
