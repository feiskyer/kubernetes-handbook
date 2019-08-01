# 配置 Kubectl

本部分將生成一個用於 admin 用戶的 kubeconfig 文件。

> 注意：在生成 admin 客戶端證書的目錄來運行本部分的指令。

## admin kubeconfig

每一個 kubeconfig 都需要一個 Kuberntes API Server 地址。為了保證高可用，這裡將使用 API Servers 前端外部負載均衡器的 IP 地址。

查詢 `kubernetes-the-hard-way` 的靜態 IP 地址：

```sh
KUBERNETES_PUBLIC_ADDRESS=$(gcloud compute addresses describe kubernetes-the-hard-way \
    --region $(gcloud config get-value compute/region) \
    --format 'value(address)')
```

為 `admin` 用戶生成 kubeconfig 文件：

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

## 驗證

檢查遠端 Kubernetes 群集的健康狀況:

```sh
kubectl get componentstatuses
```

輸出為

```sh
NAME                 STATUS    MESSAGE              ERROR
controller-manager   Healthy   ok
scheduler            Healthy   ok
etcd-2               Healthy   {"health": "true"}
etcd-0               Healthy   {"health": "true"}
etcd-1               Healthy   {"health": "true"}
```

列出遠端 kubernetes cluster 的節點:

```sh
kubectl get nodes
```

輸出為

```sh
NAME       STATUS   ROLES    AGE    VERSION
worker-0   Ready    <none>   117s   v1.12.0
worker-1   Ready    <none>   118s   v1.12.0
worker-2   Ready    <none>   118s   v1.12.0
```

下一步：[配置 Pod 網絡路由](11-pod-network-routes.md)。
