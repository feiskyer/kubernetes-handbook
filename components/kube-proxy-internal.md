# kube-proxy工作原理

kube-proxy监听API server中service和endpoint的变化情况，并通过userspace、iptables等proxier来为服务配置负载均衡（仅支持TCP和UDP）。

![](images/kube-proxy.png)
