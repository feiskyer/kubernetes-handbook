# kube-apiserver工作原理

kube-apiserver提供了Kubernetes的REST API，实现了认证、授权、准入控制等安全校验功能，同时也负责集群状态的存储操作（通过etcd）。

![](images/kube-apiserver.png)

