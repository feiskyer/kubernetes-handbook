# Network Policy

随着微服务的流行，越来越多的云服务平台需要大量模块之间的网络调用。Kubernetes 在 1.3 引入了Network Policy，Network Policy提供了基于策略的网络控制，用于隔离应用并减少攻击面。它使用标签选择器模拟传统的分段网络，并通过策略控制它们之间的流量以及来自外部的流量。

在使用Network Policy时，需要注意

- v1.6以及以前的版本需要在kube-apiserver中开启`extensions/v1beta1/networkpolicies`
- v1.7版本Network Policy已经GA，API版本为`networking.k8s.io/v1`
- v1.8版本新增 **Egress** 和 **IPBlock** 的支持
- 网络插件要支持 Network Policy，如 Calico、Romana、Weave Net和trireme 等，参考[这里](../plugins/network-policy.md)

## 网络策略

### Namespace隔离

默认情况下，所有Pod之间是全通的。每个Namespace可以配置独立的网络策略，来隔离Pod之间的流量。

v1.7+版本通过创建匹配所有Pod的Network Policy来作为默认的网络策略，比如默认拒绝所有Pod之间Ingress通信

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
spec:
  podSelector: {}
  policyTypes:
  - Ingress
```

默认拒绝所有Pod之间Egress通信的策略为

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
spec:
  podSelector: {}
  policyTypes:
  - Egress
```

甚至是默认拒绝所有Pod之间Ingress和Egress通信的策略为

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
```

而默认允许所有Pod之间Ingress通信的策略为

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-all
spec:
  podSelector: {}
  ingress:
  - {}
```

默认允许所有Pod之间Egress通信的策略为

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-all
spec:
  podSelector: {}
  egress:
  - {}
```

而v1.6版本则通过Annotation来隔离namespace的所有Pod之间的流量，包括从外部到该namespace中所有Pod的流量以及namespace内部Pod相互之间的流量：

```sh
kubectl annotate ns <namespace> "net.beta.kubernetes.io/network-policy={\"ingress\": {\"isolation\": \"DefaultDeny\"}}"
```

### Pod隔离

通过使用标签选择器（包括namespaceSelector和podSelector）来控制Pod之间的流量。比如下面的Network Policy

- 允许default namespace中带有`role=frontend`标签的Pod访问default namespace中带有`role=db`标签Pod的6379端口
- 允许带有`project=myprojects`标签的namespace中所有Pod访问default namespace中带有`role=db`标签Pod的6379端口

```yaml
# v1.6以及更老的版本应该使用extensions/v1beta1
# apiVersion: extensions/v1beta1
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: test-network-policy
  namespace: default
spec:
  podSelector:
    matchLabels:
      role: db
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          project: myproject
    - podSelector:
        matchLabels:
          role: frontend
    ports:
    - protocol: tcp
      port: 6379
```

另外一个同时开启Ingress和Egress通信的策略为

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: test-network-policy
  namespace: default
spec:
  podSelector:
    matchLabels:
      role: db
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - ipBlock:
        cidr: 172.17.0.0/16
        except:
        - 172.17.1.0/24
    - namespaceSelector:
        matchLabels:
          project: myproject
    - podSelector:
        matchLabels:
          role: frontend
    ports:
    - protocol: TCP
      port: 6379
  egress:
  - to:
    - ipBlock:
        cidr: 10.0.0.0/24
    ports:
    - protocol: TCP
      port: 5978
```

它用来隔离default namespace中带有`role=db`标签的Pod：

* 允许default namespace中`role=frontend`标签的Pod访问`role=db`标签Pod的TCP 6379端口
* 允许default namespace中`project=myproject`标签的Pod访问 `role=db` 标签Pod的TCP 6379端口
* 允许default namespace中`role=db`标签的Pod访问 `10.0.0.0/24` 网段的TCP 5987端口

## 简单示例

以calico为例看一下Network Policy的具体用法。

首先配置kubelet使用CNI网络插件

```sh
kubelet --network-plugin=cni --cni-conf-dir=/etc/cni/net.d --cni-bin-dir=/opt/cni/bin ...
```

安装calio网络插件

```sh
# 注意修改CIDR，需要跟k8s pod-network-cidr一致，默认为192.168.0.0/16
kubectl apply -f http://docs.projectcalico.org/v2.1/getting-started/kubernetes/installation/hosted/kubeadm/1.6/calico.yaml
```

首先部署一个nginx服务

```sh
$ kubectl run nginx --image=nginx --replicas=2
deployment "nginx" created
$ kubectl expose deployment nginx --port=80
service "nginx" exposed
```

此时，通过其他Pod是可以访问nginx服务的

```sh
$ kubectl get svc,pod
NAME                        CLUSTER-IP    EXTERNAL-IP   PORT(S)    AGE
svc/kubernetes              10.100.0.1    <none>        443/TCP    46m
svc/nginx                   10.100.0.16   <none>        80/TCP     33s

NAME                        READY         STATUS        RESTARTS   AGE
po/nginx-701339712-e0qfq    1/1           Running       0          35s
po/nginx-701339712-o00ef    1/1           Running       0         

$ kubectl run busybox --rm -ti --image=busybox /bin/sh
Waiting for pod default/busybox-472357175-y0m47 to be running, status is Pending, pod ready: false

Hit enter for command prompt

/ # wget --spider --timeout=1 nginx
Connecting to nginx (10.100.0.16:80)
/ #
```

开启default namespace的DefaultDeny Network Policy后，其他Pod（包括namespace外部）不能访问nginx了：

```sh
$ cat default-deny.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
spec:
  podSelector: {}
  policyTypes:
  - Ingress

$ kubectl create -f default-deny.yaml

$ kubectl run busybox --rm -ti --image=busybox /bin/sh
Waiting for pod default/busybox-472357175-y0m47 to be running, status is Pending, pod ready: false

Hit enter for command prompt

/ # wget --spider --timeout=1 nginx
Connecting to nginx (10.100.0.16:80)
wget: download timed out
/ #
```

最后再创建一个运行带有`access=true`的Pod访问的网络策略

```sh
$ cat nginx-policy.yaml
kind: NetworkPolicy
apiVersion: networking.k8s.io/v1
metadata:
  name: access-nginx
spec:
  podSelector:
    matchLabels:
      run: nginx
  ingress:
  - from:
    - podSelector:
        matchLabels:
          access: "true"

$ kubectl create -f nginx-policy.yaml
networkpolicy "access-nginx" created

# 不带access=true标签的Pod还是无法访问nginx服务
$ kubectl run busybox --rm -ti --image=busybox /bin/sh
Waiting for pod default/busybox-472357175-y0m47 to be running, status is Pending, pod ready: false

Hit enter for command prompt

/ # wget --spider --timeout=1 nginx 
Connecting to nginx (10.100.0.16:80)
wget: download timed out
/ #


# 而带有access=true标签的Pod可以访问nginx服务
$ kubectl run busybox --rm -ti --labels="access=true" --image=busybox /bin/sh
Waiting for pod default/busybox-472357175-y0m47 to be running, status is Pending, pod ready: false

Hit enter for command prompt

/ # wget --spider --timeout=1 nginx
Connecting to nginx (10.100.0.16:80)
/ #
```

最后开启nginx服务的外部访问：

```sh
$ cat nginx-external-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: front-end-access
  namespace: sock-shop
spec:
  podSelector:
    matchLabels:
      run: nginx
  ingress:
    - ports:
        - protocol: TCP
          port: 80

$ kubectl create -f nginx-external-policy.yaml
```

## 使用场景

### 禁止访问指定服务

```sh
kubectl run web --image=nginx --labels app=web,env=prod --expose --port 80
```

![](images/15022447799137.jpg)

网络策略

```yaml
kind: NetworkPolicy
apiVersion: networking.k8s.io/v1
metadata:
  name: web-deny-all
spec:
  podSelector:
    matchLabels:
      app: web
      env: prod
```

### 只允许指定Pod访问服务

```sh
kubectl run apiserver --image=nginx --labels app=bookstore,role=api --expose --port 80
```

![](images/15022448622429.jpg)

网络策略

```yaml
kind: NetworkPolicy
apiVersion: networking.k8s.io/v1
metadata:
  name: api-allow
spec:
  podSelector:
    matchLabels:
      app: bookstore
      role: api
  ingress:
  - from:
      - podSelector:
          matchLabels:
            app: bookstore
```

### 禁止namespace中所有Pod之间的相互访问

![](images/15022451724392.gif)

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
  namespace: default
spec:
  podSelector: {}
```

### 禁止其他namespace访问服务

```sh
kubectl create namespace secondary
kubectl run web --namespace secondary --image=nginx \
    --labels=app=web --expose --port 80
```

![](images/15022452203435.gif)

网络策略

```yaml
kind: NetworkPolicy
apiVersion: networking.k8s.io/v1
metadata:
  namespace: secondary
  name: web-deny-other-namespaces
spec:
  podSelector:
    matchLabels:
  ingress:
  - from:
    - podSelector: {}
```

### 只允许指定namespace访问服务

```sh
kubectl run web --image=nginx \
    --labels=app=web --expose --port 80
```

![](images/15022453441751.gif)

网络策略

```yaml
kind: NetworkPolicy
apiVersion: networking.k8s.io/v1
metadata:
  name: web-allow-prod
spec:
  podSelector:
    matchLabels:
      app: web
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          purpose: production
```

### 允许外网访问服务

```sh
kubectl run web --image=nginx --labels=app=web --port 80
kubectl expose deployment/web --type=LoadBalancer
```

![](images/15022454444461.gif)

网络策略

```yaml
kind: NetworkPolicy
apiVersion: networking.k8s.io/v1
metadata:
  name: web-allow-external
spec:
  podSelector:
    matchLabels:
      app: web
  ingress:
  - ports:
    - port: 80
    from: []
```

## 参考文档

- [Kubernetes network policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [Declare Network Policy](https://kubernetes.io/docs/tasks/administer-cluster/declare-network-policy/)
- [Securing Kubernetes Cluster Networking](https://ahmet.im/blog/kubernetes-network-policy/)
- [Kubernetes Network Policy Recipes](https://github.com/ahmetb/kubernetes-networkpolicy-tutorial)

