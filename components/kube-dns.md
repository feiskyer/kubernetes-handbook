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

## 启动kube-dns示例

一般通过[addon](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/dns)的方式部署DNS服务，这会在Kubernetes中启动一个包含三个容器的Pod，运行着DNS相关的三个服务：

```sh
# kube-dns container
kube-dns --domain=cluster.local. --dns-port=10053 --config-dir=/kube-dns-config --v=2

# dnsmasq container
dnsmasq-nanny -v=2 -logtostderr -configDir=/etc/k8s/dns/dnsmasq-nanny -restartDnsmasq=true -- -k --cache-size=1000 --log-facility=- --server=127.0.0.1#10053

# sidecar container
sidecar --v=2 --logtostderr --probe=kubedns,127.0.0.1:10053,kubernetes.default.svc.cluster.local.,5,A --probe=dnsmasq,127.0.0.1:53,kubernetes.default.svc.cluster.local.,5,A
```

## 工作原理

如下图所示，kube-dns由三个容器构成：

- kube-dns：DNS服务的核心组件，主要由KubeDNS和SkyDNS组成
  - KubeDNS负责监听Service和Endpoint的变化情况，并将相关的信息更新到SkyDNS中
  - SkyDNS负责DNS解析，监听在10053端口(tcp/udp)，同时也监听在10055端口提供metrics
  - kube-dns还监听了8081端口，以供健康检查使用
- dnsmasq-nanny：负责启动dnsmasq，并在配置发生变化时重启dnsmasq
  - dnsmasq的upstream为SkyDNS，即集群内部的DNS解析由SkyDNS负责
- sidecar：负责健康检查和提供DNS metrics（监听在10054端口）

![](images/kube-dns.png)

## 代码分析

kube-dns的代码已经从kubernetes里面分离出来，放到了<https://github.com/kubernetes/dns>。kube-dns、dnsmasq-nanny和sidecar的代码均是从`cmd/<cmd-name>/main.go`开始，并分别调用`pkg/dns`、`pkg/dnsmasq`和`pkg/sidecar`完成相应的功能。而最核心的DNS解析则是直接引用了`github.com/skynetservices/skydns/server`的代码，具体实现见[skynetservices/skydns](https://github.com/skynetservices/skydns/tree/master/server)。
