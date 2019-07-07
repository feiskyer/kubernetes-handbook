# 证书轮换

## 检查证书过期时间

```sh
# For kubeadm provisioned clusters
kubeadm alpha certs check-expiration

# For all clusters
openssl x509 -noout -dates -in /etc/kubernetes/pki/apiserver.crt
```

## 更新过期时间

根据集群的不同，可以选择如下几种方法来更新证书过期时间（任选一种即可）。

### 方法1: 使用 kubeadm 升级集群自动轮换证书

```sh
kubeadm upgrade apply --certificate-renewal v1.15.0
```

### 方法2:  使用 kubeadm 手动生成并替换证书

```sh
# Step 1): Backup old certs and kubeconfigs
mkdir /etc/kubernetes.bak
cp -r /etc/kubernetes/pki/ /etc/kubernetes.bak
cp /etc/kubernetes/*.conf /etc/kubernetes.bak

# Step 2): Renew all certs
kubeadm alpha certs renew all --config kubeadm.yaml

# Step 3): Renew all kubeconfigs
kubeadm alpha kubeconfig user --client-name=admin
kubeadm alpha kubeconfig user --org system:masters --client-name kubernetes-admin  > /etc/kubernetes/admin.conf
kubeadm alpha kubeconfig user --client-name system:kube-controller-manager > /etc/kubernetes/controller-manager.conf
kubeadm alpha kubeconfig user --org system:nodes --client-name system:node:$(hostname) > /etc/kubernetes/kubelet.conf
kubeadm alpha kubeconfig user --client-name system:kube-scheduler > /etc/kubernetes/scheduler.conf

# Another way to renew kubeconfigs
# kubeadm init phase kubeconfig all --config kubeadm.yaml

# Step 4): Copy certs/kubeconfigs and restart Kubernetes services
```

### 方法3: 非 kubeadm 集群

非 kubeadm 集群请参考 [配置 CA 并创建 TLS 证书](../deploy/kubernetes-the-hard-way/04-certificate-authority.md) 重新生成证书，并重启各个 Kubernetes 服务。

## kubelet 证书自动轮换

Kubelet 从 v1.8.0 开始支持[证书轮换](https://kubernetes.io/docs/tasks/tls/certificate-rotation/)，当证书过期时，可以自动生成新的密钥，并从 Kubernetes API 申请新的证书。

证书轮换的开启方法如下：

```sh
# Step 1): Config kube-controller-manager
kube-controller-manager --experimental-cluster-signing-duration=87600h \
                --feature-gates=RotateKubeletClientCertificate=true \
                ...

# Step 2): Config RBAC
# Refer https://kubernetes.io/docs/reference/command-line-tools-reference/kubelet-tls-bootstrapping/#approval

# Step 3): Config Kubelet
kubelet --feature-gates=RotateKubeletClientCertificate=true \
                --cert-dir=/var/lib/kubelet/pki \
                --rotate-certificates \
                --rotate-server-certificates \
                ...
```

## 撤销证书

Kubernetes 目前还不支持通过 [Certificate Rovocation List (CRL)](https://en.wikipedia.org/wiki/Certificate_revocation_list) 来[撤销证书](https://github.com/kubernetes/kubernetes/issues/18982)。所以，目前撤销证书的唯一方法就是使用新的 CA 重新生成所有证书，然后再重启所有服务。

为了避免这个问题，推荐为客户端配置 [OIDC](https://kubernetes.io/docs/reference/access-authn-authz/authentication/#openid-connect-tokens) 认证，比如可以使用 [dex](https://github.com/dexidp/dex) 项目来实现。

> 注：Etcd 支持 CRL 撤销证书，具体实现可以参考[这里](https://github.com/etcd-io/etcd/blob/master/pkg/transport/listener_tls.go#L169-L190)。

## 附: 名词解释

- CA (Certificate Authority)：根证书签发机构，用于签发证书（即证明证书是合法的）。
  - CA 拥有私钥 (ca.key) 和证书 (ca.crt，包含公钥)。对于自签名 CA 来说， ca.crt 需要分发给所有客户端。
  - ca.crt 会自动挂载到 Pod 中`/var/run/secrets/kubernetes.io/serviceaccount/ca.crt`
- key (Public key or Private key)：即公钥或者私钥。
- csr (Certificate Signing Request)：证书签名请求，用于向权威证书颁发机构获得签名证书的申请，申请中通常包含公钥（私钥自己保存）。
- crt/cer (Certificate)：已签发的证书，一般是 PEM 格式（也支持 DER 格式）。

## 参考文档

- [Certificate Management with kubeadm](https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-certs/)
- [Manage TLS Certificates in a Cluster](https://kubernetes.io/docs/tasks/tls/managing-tls-in-a-cluster/)
- [Kubelet Certificate Rotation](https://kubernetes.io/docs/tasks/tls/certificate-rotation/)
