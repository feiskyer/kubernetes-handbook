# 配置 Kubectl

本部分将生成一个用于 admin 用户的 kubeconfig 文件。

> 注意：在生成 admin 客户端证书的目录来运行本部分的指令。

## admin kubeconfig

每一个 kubeconfig 都需要一个 Kuberntes API Server 地址。为了保证高可用，这里将使用 API Servers 前端外部负载均衡器的 IP 地址。

查询 `kubernetes-the-hard-way` 的静态 IP 地址：

```sh
KUBERNETES_PUBLIC_ADDRESS=$(gcloud compute addresses describe kubernetes-the-hard-way \
    --region $(gcloud config get-value compute/region) \
    --format 'value(address)')
```

为 `admin` 用户生成 kubeconfig 文件：

```sh
kubectl config set-cluster kubernetes-the-hard-way \
  --certificate-authority=ca.pem \
  --embed-certs=true \
  --server=https://${KUBERNETES_PUBLIC_ADDRESS}:6443

kubectl config set-credentials admin \
  --client-certificate=admin.pem \
  --client-key=admin-key.pem

kubectl config set-context kubernetes-the-hard-way \
  --cluster=kubernetes-the-hard-way \
  --user=admin

kubectl config use-context kubernetes-the-hard-way
```

## 验证

检查远端 Kubernetes 群集的健康状况:

```sh
kubectl get componentstatuses
```

输出为

```sh
NAME                 STATUS    MESSAGE              ERROR
controller-manager   Healthy   ok
scheduler            Healthy   ok
etcd-2               Healthy   {"health": "true"}
etcd-0               Healthy   {"health": "true"}
etcd-1               Healthy   {"health": "true"}
```

列出远端 kubernetes cluster 的节点:

```sh
kubectl get nodes
```

输出为

```sh
NAME       STATUS   ROLES    AGE    VERSION
worker-0   Ready    <none>   117s   v1.12.0
worker-1   Ready    <none>   118s   v1.12.0
worker-2   Ready    <none>   118s   v1.12.0
```

下一步：[配置 Pod 网络路由](11-pod-network-routes.md)。
