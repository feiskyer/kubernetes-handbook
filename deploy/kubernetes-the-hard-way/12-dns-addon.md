
# 部署 DNS 扩展

在本次实验中将会部属[DNS 插件](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/)用来提供DNS, 为集群内的应用程式提供服务发现。


##  DNS 扩展

部属 `kube-dns` 群集插件:

```
kubectl create -f https://storage.googleapis.com/kubernetes-the-hard-way/kube-dns.yaml
```

> 输出为

```
serviceaccount "kube-dns" created
configmap "kube-dns" created
service "kube-dns" created
deployment "kube-dns" created
```

列出`kube-dns` deploment 的pods:

```
kubectl get pods -l k8s-app=kube-dns -n kube-system
```

> 输出为

```
NAME                        READY     STATUS    RESTARTS   AGE
kube-dns-3097350089-gq015   3/3       Running   0          20s
kube-dns-3097350089-q64qc   3/3       Running   0          20s
```

## 验证

建立一个`busybox` deployment:

```
kubectl run busybox --image=busybox --command -- sleep 3600
```

列出`busybox` deployment 的 pod


```
kubectl get pods -l run=busybox
```

> 输出为


```
NAME                       READY     STATUS    RESTARTS   AGE
busybox-2125412808-mt2vb   1/1       Running   0          15s
```

取得`busybox` pod 的全名:

```
POD_NAME=$(kubectl get pods -l run=busybox -o jsonpath="{.items[0].metadata.name}")
```

执行在`busybox` pod 的 DNS 查询服务


```
kubectl exec -ti $POD_NAME -- nslookup kubernetes
```

> 输出为

```
Server:    10.32.0.10
Address 1: 10.32.0.10 kube-dns.kube-system.svc.cluster.local

Name:      kubernetes
Address 1: 10.32.0.1 kubernetes.default.svc.cluster.local
```

Next: [烟雾测试](13-smoke-test.md)
