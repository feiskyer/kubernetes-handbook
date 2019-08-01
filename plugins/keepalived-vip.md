# keepalived-vip

Kubernetes 使用 [keepalived](http://www.keepalived.org) 來產生虛擬 IP address

我們將探討如何利用 [IPVS - The Linux Virtual Server Project](http://www.linuxvirtualserver.org/software/ipvs.html)" 來 kubernetes 配置 VIP


## 前言

kubernetes v1.6 版提供了三種方式去暴露 Service：

1. **L4 的 LoadBalacncer** : 只能在 [cloud providers](https://kubernetes.io/docs/tasks/access-application-cluster/create-external-load-balancer/) 上被使用 像是 GCE 或 AWS
2. **NodePort** : [NodePort](https://kubernetes.io/docs/concepts/services-networking/service/#type-nodeport) 允許在每個節點上開啟一個 port 口, 藉由這個 port 口會再將請求導向到隨機的 pod 上
3. **L7 Ingress** :[Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/) 為一個 LoadBalancer(例: nginx, HAProxy, traefik, vulcand) 會將 HTTP/HTTPS 的各個請求導向到相對應的 service endpoint

有了這些方式, 為何我們還需要 _keepalived_ ?

```
                                                  ___________________
                                                 |                   |
                                           |-----| Host IP: 10.4.0.3 |
                                           |     |___________________|
                                           |
                                           |      ___________________
                                           |     |                   |
Public ----(example.com = 10.4.0.3/4/5)----|-----| Host IP: 10.4.0.4 |
                                           |     |___________________|
                                           |
                                           |      ___________________
                                           |     |                   |
                                           |-----| Host IP: 10.4.0.5 |
                                                 |___________________|
```

我們假設 Ingress 運行在 3 個 kubernetes 節點上, 並對外暴露 `10.4.0.x` 的 IP 去做 loadbalance

DNS Round Robin (RR) 將對應到 `example.com` 的請求輪循給這 3 個節點, 如果 `10.4.0.3` 掛了, 仍有三分之一的流量會導向 `10.4.0.3`, 這樣就會有一段 downtime, 直到 DNS 發現 `10.4.0.3` 掛了並修正導向

嚴格來說, 這並沒有真正的做到 High Availability (HA)

這邊 IPVS 可以幫助我們解決這件事, 這個想法是虛擬 IP(VIP) 對應到每個 service 上, 並將 VIP 暴露到 kubernetes 群集之外

### 與 [service-loadbalancer](https://github.com/kubernetes/contrib/tree/master/service-loadbalancer) 或 [ingress-nginx](https://github.com/kubernetes/ingress-nginx) 的區別

我們看到以下的圖

```sh
                                               ___________________
                                              |                   |
                                              | VIP: 10.4.0.50    |
                                        |-----| Host IP: 10.4.0.3 |
                                        |     | Role: Master      |
                                        |     |___________________|
                                        |
                                        |      ___________________
                                        |     |                   |
                                        |     | VIP: Unassigned   |
Public ----(example.com = 10.4.0.50)----|-----| Host IP: 10.4.0.3 |
                                        |     | Role: Slave       |
                                        |     |___________________|
                                        |
                                        |      ___________________
                                        |     |                   |
                                        |     | VIP: Unassigned   |
                                        |-----| Host IP: 10.4.0.3 |
                                              | Role: Slave       |
                                              |___________________|
```

我們可以看到只有一個 node 被選為 Master(透過 VRRP 選擇的), 而我們的 VIP 是 `10.4.0.50`, 如果 `10.4.0.3` 掛掉了, 那會從剩餘的節點中選一個成為 Master 並接手 VIP, 這樣我們就可以確保落實真正的 HA

## 環境需求

只需要確認要運行 keepalived-vip 的 kubernetes 群集 [DaemonSets](../concepts/daemonset.md) 功能是正常的就行了

### RBAC

由於 kubernetes 在 1.6 後引進了 RBAC 的概念, 所以我們要先去設定 rule, 至於有關 RBAC 的詳情請至 [說明](../plugins/rbac.md)。

vip-rbac.yaml

```yaml
apiVersion: rbac.authorization.k8s.io/v1beta1
kind: ClusterRole
metadata:
  name: kube-keepalived-vip
rules:
- apiGroups: [""]
  resources:
  - pods
  - nodes
  - endpoints
  - services
  - configmaps
  verbs: ["get", "list", "watch"]
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: kube-keepalived-vip
  namespace: default
---
apiVersion: rbac.authorization.k8s.io/v1beta1
kind: ClusterRoleBinding
metadata:
  name: kube-keepalived-vip
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: kube-keepalived-vip
subjects:
- kind: ServiceAccount
  name: kube-keepalived-vip
  namespace: default
```

clusterrolebinding.yaml


```yaml
apiVersion: rbac.authorization.k8s.io/v1alpha1
kind: ClusterRoleBinding
metadata:
  name: kube-keepalived-vip
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: kube-keepalived-vip
subjects:
  - kind: ServiceAccount
    name: kube-keepalived-vip
    namespace: default
```

```sh
$ kubectl create -f vip-rbac.yaml
$ kubectl create -f clusterrolebinding.yaml
```

## 示例



先建立一個簡單的 service


nginx-deployment.yaml
```yaml
apiVersion: apps/v1beta1
kind: Deployment
metadata:
  name: nginx-deployment
spec:
  replicas: 3
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.7.9
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: nginx
  labels:
    app: nginx
spec:
  type: NodePort
  ports:
  - port: 80
    nodePort: 30302
    targetPort: 80
    protocol: TCP
    name: http
  selector:
    app: nginx
```

主要功能就是 pod 去監聽聽 80 port, 再開啟 service NodePort 監聽 30320


```sh
$ kubecrl create -f nginx-deployment.yaml
```
接下來我們要做的是 config map


```sh
$ echo "apiVersion: v1
kind: ConfigMap
metadata:
  name: vip-configmap
data:
  10.87.2.50: default/nginx" | kubectl create -f -
```


注意, 這邊的 ```10.87.2.50``` 必須換成你自己同網段下無使用的 IP e.g. 10.87.2.X
後面 ```nginx``` 為 service 的 name, 這邊可以自行更換

接著確認一下
```sh
$kubectl get configmap
NAME            DATA      AGE
vip-configmap   1         23h

```

再來就是設置 keepalived-vip

```yaml

apiVersion: extensions/v1beta1
kind: DaemonSet
metadata:
  name: kube-keepalived-vip
spec:
  template:
    metadata:
      labels:
        name: kube-keepalived-vip
    spec:
      hostNetwork: true
      containers:
        - image: gcr.io/google_containers/kube-keepalived-vip:0.9
          name: kube-keepalived-vip
          imagePullPolicy: Always
          securityContext:
            privileged: true
          volumeMounts:
            - mountPath: /lib/modules
              name: modules
              readOnly: true
            - mountPath: /dev
              name: dev
          # use downward API
          env:
            - name: POD_NAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
            - name: POD_NAMESPACE
              valueFrom:
                fieldRef:
                  fieldPath: metadata.namespace
          # to use unicast
          args:
          - --services-configmap=default/vip-configmap
          # unicast uses the ip of the nodes instead of multicast
          # this is useful if running in cloud providers (like AWS)
          #- --use-unicast=true
      volumes:
        - name: modules
          hostPath:
            path: /lib/modules
        - name: dev
          hostPath:
            path: /dev
```


建立 daemonset

```sh
$ kubectl get daemonset kube-keepalived-vip
NAME                  DESIRED   CURRENT   READY     UP-TO-DATE   AVAILABLE   NODE-SELECTOR   AGE
kube-keepalived-vip   5         5         5         5            5
```

檢查一下配置狀態

```sh
kubectl get pod -o wide |grep keepalive
kube-keepalived-vip-c4sxw         1/1       Running            0          23h       10.87.2.6    10.87.2.6
kube-keepalived-vip-c9p7n         1/1       Running            0          23h       10.87.2.8    10.87.2.8
kube-keepalived-vip-psdp9         1/1       Running            0          23h       10.87.2.10   10.87.2.10
kube-keepalived-vip-xfmxg         1/1       Running            0          23h       10.87.2.12   10.87.2.12
kube-keepalived-vip-zjts7         1/1       Running            3          23h       10.87.2.4    10.87.2.4
```
可以隨機挑一個 pod, 去看裡面的配置

```sh
 $ kubectl exec kube-keepalived-vip-c4sxw cat /etc/keepalived/keepalived.conf


global_defs {
  vrrp_version 3
  vrrp_iptables KUBE-KEEPALIVED-VIP
}

vrrp_instance vips {
  state BACKUP
  interface eno1
  virtual_router_id 50
  priority 103
  nopreempt
  advert_int 1

  track_interface {
    eno1
  }



  virtual_ipaddress {
    10.87.2.50
  }
}


# Service: default/nginx
virtual_server 10.87.2.50 80 { // 此為 service 開的口
  delay_loop 5
  lvs_sched wlc
  lvs_method NAT
  persistence_timeout 1800
  protocol TCP


  real_server 10.2.49.30 8080 { // 這裡說明 pod 的真實狀況
    weight 1
    TCP_CHECK {
      connect_port 80
      connect_timeout 3
    }
  }

}

```

最後我們去測試這功能

```sh
$ curl  10.87.2.50
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

10.87.2.50:80(我們假設的 VIP, 實際上其實沒有 node 是用這 IP) 即可幫我們導向這個 service


以上的程式代碼都在 [github](https://github.com/kubernetes/contrib/tree/master/keepalived-vip) 上可以找到。

## 參考文檔

- [kweisamx/kubernetes-keepalived-vip](https://github.com/kweisamx/kubernetes-keepalived-vip)
- [kubernetes/keepalived-vip](https://github.com/kubernetes/contrib/tree/master/keepalived-vip)
