# 配置和生成 Kubernetes 配置文件

本部分内容将会创建 [kubeconfig 配置文件](https://kubernetes.io/docs/concepts/configuration/organize-cluster-access-kubeconfig/)，它们是 Kubernetes 客户端与 API Server 认证与鉴权的保证。

## 客户端认证配置

本节将会创建用于 `kubelet` 和 `kube-proxy` 的 kubeconfig 文件。

> `scheduler` 和 `controller manager` 将会通过不安全的端口与 API Server 通信，该端口无需认证，并仅允许来自本地的请求访问。

### Kubernetes 公有 IP 地址

每一个 kubeconfig 文件都需要一个 Kuberntes API Server 的 IP 地址。为了保证高可用性，我们将该 IP 分配给 API Server 之前的外部负载均衡器。

查询 `kubernetes-the-hard-way` 的静态 IP 地址：

```sh
KUBERNETES_PUBLIC_ADDRESS=$(gcloud compute addresses describe kubernetes-the-hard-way \
  --region $(gcloud config get-value compute/region) \
  --format 'value(address)')
```

### kubelet 配置文件

为了确保[Node Authorizer](https://kubernetes.io/docs/admin/authorization/node/) 授权，Kubelet 配置文件中的客户端证书必需匹配 Node 名字。

为每个 worker 节点创建 kubeconfig 配置：

```sh
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

结果将会生成以下3个文件：

```sh
worker-0.kubeconfig
worker-1.kubeconfig
worker-2.kubeconfig
```

### kube-proxy 配置文件

为 kube-proxy 服务生成 kubeconfig 配置文件：

```sh
kubectl config set-cluster kubernetes-the-hard-way \
  --certificate-authority=ca.pem \
  --embed-certs=true \
  --server=https://${KUBERNETES_PUBLIC_ADDRESS}:6443 \
  --kubeconfig=kube-proxy.kubeconfig

kubectl config set-credentials kube-proxy \
  --client-certificate=kube-proxy.pem \
  --client-key=kube-proxy-key.pem \
  --embed-certs=true \
  --kubeconfig=kube-proxy.kubeconfig

kubectl config set-context default \
  --cluster=kubernetes-the-hard-way \
  --user=kube-proxy \
  --kubeconfig=kube-proxy.kubeconfig

kubectl config use-context default --kubeconfig=kube-proxy.kubeconfig
```

### 分发配置文件

将 `kubelet` 与 `kube-proxy` kubeconfig 配置文件复制到每个 worker 节点上：

```sh
for instance in worker-0 worker-1 worker-2; do
  gcloud compute scp ${instance}.kubeconfig kube-proxy.kubeconfig ${instance}:~/
done
```

下一步：[配置和生成密钥](06-data-encryption-keys.md)。
