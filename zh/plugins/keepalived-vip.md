# keepalived-vip

Kubernetes 使用 [keepalived](http://www.keepalived.org) 来产生虚拟 IP address

我们将探讨如何利用 [IPVS - The Linux Virtual Server Project](http://www.linuxvirtualserver.org/software/ipvs.html)" 来 kubernetes 配置 VIP


## 前言

kubernetes v1.6 版提供了三种方式去暴露 Service：

1. **L4 的 LoadBalacncer** : 只能在 [cloud providers](https://kubernetes.io/docs/tasks/access-application-cluster/create-external-load-balancer/) 上被使用 像是 GCE 或 AWS
2. **NodePort** : [NodePort](https://kubernetes.io/docs/concepts/services-networking/service/#type-nodeport) 允许在每个节点上开启一个 port 口, 借由这个 port 口会再将请求导向到随机的 pod 上
3. **L7 Ingress** :[Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/) 为一个 LoadBalancer(例: nginx, HAProxy, traefik, vulcand) 会将 HTTP/HTTPS 的各个请求导向到相对应的 service endpoint

有了这些方式, 为何我们还需要 _keepalived_ ?

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

我们假设 Ingress 运行在 3 个 kubernetes 节点上, 并对外暴露 `10.4.0.x` 的 IP 去做 loadbalance

DNS Round Robin (RR) 将对应到 `example.com` 的请求轮循给这 3 个节点, 如果 `10.4.0.3` 掛了, 仍有三分之一的流量会导向 `10.4.0.3`, 这样就会有一段 downtime, 直到 DNS 发现 `10.4.0.3` 掛了并修正导向

严格来说, 这并没有真正的做到 High Availability (HA)

这边 IPVS 可以帮助我们解决这件事, 这个想法是虚拟 IP(VIP) 对应到每个 service 上, 并将 VIP 暴露到 kubernetes 群集之外

### 与 [service-loadbalancer](https://github.com/kubernetes/contrib/tree/master/service-loadbalancer) 或 [ingress-nginx](https://github.com/kubernetes/ingress-nginx) 的区别

我们看到以下的图

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

我们可以看到只有一个 node 被选为 Master(透过 VRRP 选择的), 而我们的 VIP 是 `10.4.0.50`, 如果 `10.4.0.3` 掛掉了, 那会从剩余的节点中选一个成为 Master 并接手 VIP, 这样我们就可以确保落实真正的 HA

## 环境需求

只需要确认要运行 keepalived-vip 的 kubernetes 群集 [DaemonSets](../concepts/daemonset.md) 功能是正常的就行了

### RBAC

由于 kubernetes 在 1.6 后引进了 RBAC 的概念, 所以我们要先去设定 rule, 至於有关 RBAC 的详情请至 [说明](../plugins/rbac.md)。

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



先建立一个简单的 service


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

主要功能就是 pod 去监听听 80 port, 再开启 service NodePort 监听 30320


```sh
$ kubecrl create -f nginx-deployment.yaml
```
接下来我们要做的是 config map


```sh
$ echo "apiVersion: v1
kind: ConfigMap
metadata:
  name: vip-configmap
data:
  10.87.2.50: default/nginx" | kubectl create -f -
```


注意, 这边的 ```10.87.2.50``` 必须换成你自己同网段下无使用的 IP e.g. 10.87.2.X
后面 ```nginx``` 为 service 的 name, 这边可以自行更换

接着确认一下
```sh
$kubectl get configmap
NAME            DATA      AGE
vip-configmap   1         23h

```

再来就是设置 keepalived-vip

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

检查一下配置状态

```sh
kubectl get pod -o wide |grep keepalive
kube-keepalived-vip-c4sxw         1/1       Running            0          23h       10.87.2.6    10.87.2.6
kube-keepalived-vip-c9p7n         1/1       Running            0          23h       10.87.2.8    10.87.2.8
kube-keepalived-vip-psdp9         1/1       Running            0          23h       10.87.2.10   10.87.2.10
kube-keepalived-vip-xfmxg         1/1       Running            0          23h       10.87.2.12   10.87.2.12
kube-keepalived-vip-zjts7         1/1       Running            3          23h       10.87.2.4    10.87.2.4
```
可以随机挑一个 pod, 去看里面的配置

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
virtual_server 10.87.2.50 80 { // 此为 service 开的口
  delay_loop 5
  lvs_sched wlc
  lvs_method NAT
  persistence_timeout 1800
  protocol TCP


  real_server 10.2.49.30 8080 { // 这里说明 pod 的真实状况
    weight 1
    TCP_CHECK {
      connect_port 80
      connect_timeout 3
    }
  }

}

```

最后我们去测试这功能

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

10.87.2.50:80(我们假设的 VIP, 实际上其实没有 node 是用这 IP) 即可帮我们导向这个 service


以上的程式代码都在 [github](https://github.com/kubernetes/contrib/tree/master/keepalived-vip) 上可以找到。

## 参考文档

- [kweisamx/kubernetes-keepalived-vip](https://github.com/kweisamx/kubernetes-keepalived-vip)
- [kubernetes/keepalived-vip](https://github.com/kubernetes/contrib/tree/master/keepalived-vip)
