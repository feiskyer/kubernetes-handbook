# kube-dns工作原理

如下图所示，kube-dns由三个容器构成：

- kube-dns：DNS服务的核心组件，主要由KubeDNS和SkyDNS组成
  - KubeDNS负责监听Service和Endpoint的变化情况，并将相关的信息更新到SkyDNS中
  - SkyDNS负责DNS解析，监听在10053端口(tcp/udp)，同时也监听在10055端口提供metrics
  - kube-dns还监听了8081端口，以供健康检查使用
- dnsmasq-nanny：负责启动dnsmasq，并在配置发生变化时重启dnsmasq
  - dnsmasq的upstream为SkyDNS，即集群内部的DNS解析由SkyDNS负责
- sidecar：负责健康检查和提供DNS metrics（监听在10054端口）

![](images/kube-dns.png)

## 源码简介

kube-dns的代码已经从kubernetes里面分离出来，放到了<https://github.com/kubernetes/dns>。

kube-dns、dnsmasq-nanny和sidecar的代码均是从`cmd/<cmd-name>/main.go`开始，并分别调用`pkg/dns`、`pkg/dnsmasq`和`pkg/sidecar`完成相应的功能。而最核心的DNS解析则是直接引用了`github.com/skynetservices/skydns/server`的代码，具体实现见[skynetservices/skydns](https://github.com/skynetservices/skydns/tree/master/server)。
