# kube-dns

kube-dns为Kubernetes集群提供命名服务，作为addon的方式部署。

## 支持的DNS格式

- Service
  - A record：生成`my-svc.my-namespace.svc.cluster.local`，解析IP分为两种情况
    - 普通Service解析为Cluster IP
    - Headless Service解析为指定的Pod IP列表
  - SRV record：生成`_my-port-name._my-port-protocol.my-svc.my-namespace.svc.cluster.local`
- Pod
  - A record：`pod-ip-address.my-namespace.pod.cluster.local`
  - 指定hostname和subdomain：`hostname.custom-subdomain.default.svc.cluster.local`

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: busybox2
  labels:
    name: busybox
spec:
  hostname: busybox-2
  subdomain: default-subdomain
  containers:
  - image: busybox
    command:
      - sleep
      - "3600"
    name: busybox
```

## 参考文档

- [DNS Pods and Services](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/)
