# kube-dns

kube-dns为Kubernetes集群提供命名服务，一般通过addon的方式部署，从v1.3版本开始，成为了一个内建的自启动服务。

## 支持的DNS格式

- Service
  - A record：生成`my-svc.my-namespace.svc.cluster.local`，解析IP分为两种情况
    - 普通Service解析为Cluster IP
    - Headless Service解析为指定的Pod IP列表
  - SRV record：生成`_my-port-name._my-port-protocol.my-svc.my-namespace.svc.cluster.local`
- Pod
  - A record：`pod-ip-address.my-namespace.pod.cluster.local`
  - 指定hostname和subdomain：`hostname.custom-subdomain.default.svc.cluster.local`，如下所示

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

![](images/dns-demo.png)

## 支持配置私有DNS服务器和上游DNS服务器

从Kubernetes 1.6开始，可以通过为kube-dns提供ConfigMap来实现对存根域以及上游名称服务器的自定义指定。例如，下面的配置插入了一个单独的私有根DNS服务器和两个上游DNS服务器。

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: kube-dns
  namespace: kube-system
data:
  stubDomains: |
    {“acme.local”: [“1.2.3.4”]}
  upstreamNameservers: |
    [“8.8.8.8”, “8.8.4.4”]
```
使用上述特定配置，查询请求首先会被发送到kube-dns的DNS缓存层(Dnsmasq 服务器)。Dnsmasq服务器会先检查请求的后缀，带有集群后缀（例如：”.cluster.local”）的请求会被发往kube-dns，拥有存根域后缀的名称（例如：”.acme.local”）将会被发送到配置的私有DNS服务器[“1.2.3.4”]。最后，不满足任何这些后缀的请求将会被发送到上游DNS [“8.8.8.8”, “8.8.4.4”]里。

![](images/kube-dns-upstream.png)

## 启动kube-dns示例

一般通过扩展的方式部署DNS服务，如把 [kube-dns.yaml](/manifests/kubedns/kube-dns.yaml) 放到 Master 节点的 `/etc/kubernetes/addons` 目录中。当然也可以手动部署：

```sh
kubectl apply -f https://kubernetes.feisky.xyz/manifests/kubedns/kube-dns.yaml
```



这会在Kubernetes中启动一个包含三个容器的Pod，运行着DNS相关的三个服务：

```sh
# kube-dns container
kube-dns --domain=cluster.local. --dns-port=10053 --config-dir=/kube-dns-config --v=2

# dnsmasq container
dnsmasq-nanny -v=2 -logtostderr -configDir=/etc/k8s/dns/dnsmasq-nanny -restartDnsmasq=true -- -k --cache-size=1000 --log-facility=- --server=127.0.0.1#10053

# sidecar container
sidecar --v=2 --logtostderr --probe=kubedns,127.0.0.1:10053,kubernetes.default.svc.cluster.local.,5,A --probe=dnsmasq,127.0.0.1:53,kubernetes.default.svc.cluster.local.,5,A
```

Kubernetes v1.10 也支持 Beta 版的 CoreDNS，其性能较 kube-dns 更好。可以以扩展方式部署，如把 [coredns.yaml](/manifests/kubedns/coredns.yaml) 放到 Master 节点的 `/etc/kubernetes/addons` 目录中。当然也可以手动部署：

```sh
kubectl apply -f https://kubernetes.feisky.xyz/manifests/kubedns/coredns.yaml
```

## How it works


如下图所示，kube-dns由三个容器构成：

- kube-dns：DNS服务的核心组件，主要由KubeDNS和SkyDNS组成
  - KubeDNS负责监听Service和Endpoint的变化情况，并将相关的信息更新到SkyDNS中
  - SkyDNS负责DNS解析，监听在10053端口(tcp/udp)，同时也监听在10055端口提供metrics
  - kube-dns还监听了8081端口，以供健康检查使用
- dnsmasq-nanny：负责启动dnsmasq，并在配置发生变化时重启dnsmasq
  - dnsmasq的upstream为SkyDNS，即集群内部的DNS解析由SkyDNS负责
- sidecar：负责健康检查和提供DNS metrics（监听在10054端口）

![](images/kube-dns.png)


## 参考文档

- [dns-pod-service 介绍](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/)
- [coredns/coredns](https://github.com/coredns/coredns)
