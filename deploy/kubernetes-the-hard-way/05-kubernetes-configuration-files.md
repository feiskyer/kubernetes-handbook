
# 建立认证用Kubernetes 设定档
在此次实验中, 你会建立[Kubernetes 设定档](https://kubernetes.io/docs/concepts/configuration/organize-cluster-access-kubeconfig/), 又被称作 kubeconfigs, 用来使Kubernetes client能搜寻并认证Kubernetes API Server


## Client 认证设定
这个步骤你将会建立kubeconfig给`kubelet` 和`kube-proxy`

> `scheduler` 和 `controller manager ` 进入Kubernetes API Servers 透过一个不安全的API port , 这个port 并不需要认证, 所以这个port只允许来自本地端的请求进入

### Kubernetes 公有IP address
每一个kubeconfig 需要一个Kuberntes API Server 连接, 为了支援高可用, IP address被分配到外部负载均衡器, Kubernetes API Server 将部署在负载均衡器之后

设定`kubernetes-the-hard-way` 的固定IP address

```
KUBERNETES_PUBLIC_ADDRESS=$(gcloud compute addresses describe kubernetes-the-hard-way \
  --region $(gcloud config get-value compute/region) \
  --format 'value(address)')
```

### kubelet Kubernetes 设定档

当建立kubeconfig给kubelet, client的凭证对应到kubelet 的 node 一定会被使用

这是为了确保kubelet 确实的被Kubernetes [Node Authorizer](https://kubernetes.io/docs/admin/authorization/node/)授权

建立kubeconfig给每个work node:

```
for instance in worker-0 worker-1 worker-2; do
  kubectl config set-cluster kubernetes-the-hard-way \
    --certificate-authority=ca.pem \
    --embed-certs=true \
    --server=https://${KUBERNETES_PUBLIC_ADDRESS}:6443 \
    --kubeconfig=${instance}.kubeconfig

  kubectl config set-credentials system:node:${instance} \
    --client-certificate=${instance}.pem \
    --client-key=${instance}-key.pem \
    --embed-certs=true \
    --kubeconfig=${instance}.kubeconfig

  kubectl config set-context default \
    --cluster=kubernetes-the-hard-way \
    --user=system:node:${instance} \
    --kubeconfig=${instance}.kubeconfig

  kubectl config use-context default --kubeconfig=${instance}.kubeconfig
done
```
结果：

```
worker-0.kubeconfig
worker-1.kubeconfig
worker-2.kubeconfig
```

### kube-proxy Kubernetes 设定档

建立kubeconfig 给 `kube-proxy`:

```
kubectl config set-cluster kubernetes-the-hard-way \
  --certificate-authority=ca.pem \
  --embed-certs=true \
  --server=https://${KUBERNETES_PUBLIC_ADDRESS}:6443 \
  --kubeconfig=kube-proxy.kubeconfig
```

```
kubectl config set-credentials kube-proxy \
  --client-certificate=kube-proxy.pem \
  --client-key=kube-proxy-key.pem \
  --embed-certs=true \
  --kubeconfig=kube-proxy.kubeconfig
```

```
kubectl config set-context default \
  --cluster=kubernetes-the-hard-way \
  --user=kube-proxy \
  --kubeconfig=kube-proxy.kubeconfig
```

```
kubectl config use-context default --kubeconfig=kube-proxy.kubeconfig
```

### 分配kubernetes设定档

复制 `kubelet` 与 `kube-proxy` kubeconfig设定档 到每个work node上：

```
for instance in worker-0 worker-1 worker-2; do
  gcloud compute scp ${instance}.kubeconfig kube-proxy.kubeconfig ${instance}:~/
done
```



Next: [建立资料加密设定档与密钥](06-data-encryption-keys.md)
