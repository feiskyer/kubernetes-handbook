# Network Policy

隨著微服務的流行，越來越多的雲服務平臺需要大量模塊之間的網絡調用。Kubernetes 在 1.3 引入了 Network Policy，Network Policy 提供了基於策略的網絡控制，用於隔離應用並減少攻擊面。它使用標籤選擇器模擬傳統的分段網絡，並通過策略控制它們之間的流量以及來自外部的流量。

在使用 Network Policy 時，需要注意

- v1.6 以及以前的版本需要在 kube-apiserver 中開啟 `extensions/v1beta1/networkpolicies`
- v1.7 版本 Network Policy 已經 GA，API 版本為 `networking.k8s.io/v1`
- v1.8 版本新增 **Egress** 和 **IPBlock** 的支持
- 網絡插件要支持 Network Policy，如 Calico、Romana、Weave Net 和 trireme 等，參考 [這裡](../plugins/network-policy.md)

## API 版本對照表

| Kubernetes 版本 | Networking API 版本  |
| --------------- | -------------------- |
| v1.5-v1.6       | extensions/v1beta1   |
| v1.7+           | networking.k8s.io/v1 |

## 網絡策略

### Namespace 隔離

默認情況下，所有 Pod 之間是全通的。每個 Namespace 可以配置獨立的網絡策略，來隔離 Pod 之間的流量。

v1.7 + 版本通過創建匹配所有 Pod 的 Network Policy 來作為默認的網絡策略，比如默認拒絕所有 Pod 之間 Ingress 通信

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

默認拒絕所有 Pod 之間 Egress 通信的策略為

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

甚至是默認拒絕所有 Pod 之間 Ingress 和 Egress 通信的策略為

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

而默認允許所有 Pod 之間 Ingress 通信的策略為

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

默認允許所有 Pod 之間 Egress 通信的策略為

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

而 v1.6 版本則通過 Annotation 來隔離 namespace 的所有 Pod 之間的流量，包括從外部到該 namespace 中所有 Pod 的流量以及 namespace 內部 Pod 相互之間的流量：

```sh
kubectl annotate ns <namespace> "net.beta.kubernetes.io/network-policy={\"ingress\": {\"isolation\": \"DefaultDeny\"}}"
```

### Pod 隔離

通過使用標籤選擇器（包括 namespaceSelector 和 podSelector）來控制 Pod 之間的流量。比如下面的 Network Policy

- 允許 default namespace 中帶有 `role=frontend` 標籤的 Pod 訪問 default namespace 中帶有 `role=db` 標籤 Pod 的 6379 端口
- 允許帶有 `project=myprojects` 標籤的 namespace 中所有 Pod 訪問 default namespace 中帶有 `role=db` 標籤 Pod 的 6379 端口

```yaml
# v1.6 以及更老的版本應該使用 extensions/v1beta1
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

另外一個同時開啟 Ingress 和 Egress 通信的策略為

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

它用來隔離 default namespace 中帶有 `role=db` 標籤的 Pod：

- 允許 default namespace 中帶有 `role=frontend` 標籤的 Pod 訪問 default namespace 中帶有 `role=db` 標籤 Pod 的 6379 端口
- 允許帶有 `project=myprojects` 標籤的 namespace 中所有 Pod 訪問 default namespace 中帶有 `role=db` 標籤 Pod 的 6379 端口
- 允許 default namespace 中帶有 `role=db` 標籤的 Pod 訪問 `10.0.0.0/24` 網段的 TCP 5987 端口

## 簡單示例

以 calico 為例看一下 Network Policy 的具體用法。

首先配置 kubelet 使用 CNI 網絡插件

```sh
kubelet --network-plugin=cni --cni-conf-dir=/etc/cni/net.d --cni-bin-dir=/opt/cni/bin ...
```

安裝 calio 網絡插件

```sh
# 注意修改 CIDR，需要跟 k8s pod-network-cidr 一致，默認為 192.168.0.0/16
kubectl apply -f https://docs.projectcalico.org/v3.0/getting-started/kubernetes/installation/hosted/kubeadm/1.7/calico.yaml
```

首先部署一個 nginx 服務

```sh
$ kubectl run nginx --image=nginx --replicas=2
deployment "nginx" created
$ kubectl expose deployment nginx --port=80
service "nginx" exposed
```

此時，通過其他 Pod 是可以訪問 nginx 服務的

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

開啟 default namespace 的 DefaultDeny Network Policy 後，其他 Pod（包括 namespace 外部）不能訪問 nginx 了：

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

最後再創建一個運行帶有 `access=true` 的 Pod 訪問的網絡策略

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

# 不帶 access=true 標籤的 Pod 還是無法訪問 nginx 服務
$ kubectl run busybox --rm -ti --image=busybox /bin/sh
Waiting for pod default/busybox-472357175-y0m47 to be running, status is Pending, pod ready: false

Hit enter for command prompt

/ # wget --spider --timeout=1 nginx
Connecting to nginx (10.100.0.16:80)
wget: download timed out
/ #


# 而帶有 access=true 標籤的 Pod 可以訪問 nginx 服務
$ kubectl run busybox --rm -ti --labels="access=true" --image=busybox /bin/sh
Waiting for pod default/busybox-472357175-y0m47 to be running, status is Pending, pod ready: false

Hit enter for command prompt

/ # wget --spider --timeout=1 nginx
Connecting to nginx (10.100.0.16:80)
/ #
```

最後開啟 nginx 服務的外部訪問：

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

## 使用場景

### 禁止訪問指定服務

```sh
kubectl run web --image=nginx --labels app=web,env=prod --expose --port 80
```

![](images/15022447799137.jpg)

網絡策略

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

### 只允許指定 Pod 訪問服務

```sh
kubectl run apiserver --image=nginx --labels app=bookstore,role=api --expose --port 80
```

![](images/15022448622429.jpg)

網絡策略

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

### 禁止 namespace 中所有 Pod 之間的相互訪問

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

### 禁止其他 namespace 訪問服務

```sh
kubectl create namespace secondary
kubectl run web --namespace secondary --image=nginx \
    --labels=app=web --expose --port 80
```

![](images/15022452203435.gif)

網絡策略

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

### 只允許指定 namespace 訪問服務

```sh
kubectl run web --image=nginx \
    --labels=app=web --expose --port 80
```

![](images/15022453441751.gif)

網絡策略

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

### 允許外網訪問服務

```sh
kubectl run web --image=nginx --labels=app=web --port 80
kubectl expose deployment/web --type=LoadBalancer
```

![](images/15022454444461.gif)

網絡策略

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

## 參考文檔

- [Kubernetes network policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [Declare Network Policy](https://kubernetes.io/docs/tasks/administer-cluster/declare-network-policy/)
- [Securing Kubernetes Cluster Networking](https://ahmet.im/blog/kubernetes-network-policy/)
- [Kubernetes Network Policy Recipes](https://github.com/ahmetb/kubernetes-networkpolicy-tutorial)
