# 部署 DNS 扩展

本部分将部署 [DNS 扩展](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/)，用于为集群内的应用提供服务发现。

## DNS 扩展

部属 `kube-dns` 群集扩展:

```sh
kubectl apply -f https://storage.googleapis.com/kubernetes-the-hard-way/coredns.yaml
```

输出为

```sh
serviceaccount/coredns created
clusterrole.rbac.authorization.k8s.io/system:coredns created
clusterrolebinding.rbac.authorization.k8s.io/system:coredns created
configmap/coredns created
deployment.extensions/coredns created
service/kube-dns created
```

列出 `kube-dns` 部署的 Pod 列表:

```sh
kubectl get pods -l k8s-app=kube-dns -n kube-system
```

输出为

```sh
NAME                       READY   STATUS    RESTARTS   AGE
coredns-699f8ddd77-94qv9   1/1     Running   0          20s
coredns-699f8ddd77-gtcgb   1/1     Running   0          20s
```

## 验证

建立一个 `busybox` 部署:

```sh
kubectl run busybox --image=busybox --command -- sleep 3600
```

列出 `busybox` 部署的 Pod：


```sh
kubectl get pods -l run=busybox
```

输出为

```sh
NAME                       READY     STATUS    RESTARTS   AGE
busybox-2125412808-mt2vb   1/1       Running   0          15s
```

查询 `busybox` Pod 的全名:

```sh
POD_NAME=$(kubectl get pods -l run=busybox -o jsonpath="{.items[0].metadata.name}")
```

在 `busybox` Pod 中查询 DNS：


```sh
kubectl exec -ti $POD_NAME -- nslookup kubernetes
```

输出为

```sh
Server:    10.32.0.10
Address 1: 10.32.0.10 kube-dns.kube-system.svc.cluster.local

Name:      kubernetes
Address 1: 10.32.0.1 kubernetes.default.svc.cluster.local
```

下一步：[烟雾测试](13-smoke-test.md)。
