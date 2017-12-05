
# 远端请求Kubectl相关设定

在本次实验中你将会建立基於`admin` user 凭证的kubeconfig档给`kubectl`指令使用

> 在这个实验同个目录中, 运行指令来产生admin client凭证

## Admin Kubernetes 设定档

每一个kubeconfig 需要一个Kuberntes API Server 连接, 为了支援高可用, IP address被分配到外部负载均衡器, Kubernetes API Server 将部署在负载均衡器之后

设定kubernetes-the-hard-way 的固定IP address:

```
KUBERNETES_PUBLIC_ADDRESS=$(gcloud compute addresses describe kubernetes-the-hard-way \
  --region $(gcloud config get-value compute/region) \
  --format 'value(address)')
```

为 `admin` user 建立认证用kubeconfig档:


```
kubectl config set-cluster kubernetes-the-hard-way \
  --certificate-authority=ca.pem \
  --embed-certs=true \
  --server=https://${KUBERNETES_PUBLIC_ADDRESS}:6443
```

```
kubectl config set-credentials admin \
  --client-certificate=admin.pem \
  --client-key=admin-key.pem
```

```
kubectl config set-context kubernetes-the-hard-way \
  --cluster=kubernetes-the-hard-way \
  --user=admin
```

```
kubectl config use-context kubernetes-the-hard-way
```


## 验证

检查远端Kubernetes 群集的健康状况:

```
kubectl get componentstatuses
```

> 输出为

```
NAME                 STATUS    MESSAGE              ERROR
controller-manager   Healthy   ok
scheduler            Healthy   ok
etcd-2               Healthy   {"health": "true"}
etcd-0               Healthy   {"health": "true"}
etcd-1               Healthy   {"health": "true"}
```

列出远端kubernetes cluster的节点:


```
kubectl get nodes
```

> 输出为


```
NAME       STATUS    ROLES     AGE       VERSION
worker-0   Ready     <none>    2m        v1.8.0
worker-1   Ready     <none>    2m        v1.8.0
worker-2   Ready     <none>    2m        v1.8.0
```


Next: [提供Pod网路路由](11-pod-network-routes.md)


