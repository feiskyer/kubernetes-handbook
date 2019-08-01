# 證書輪換

## 檢查證書過期時間

```sh
# For kubeadm provisioned clusters
kubeadm alpha certs check-expiration

# For all clusters
openssl x509 -noout -dates -in /etc/kubernetes/pki/apiserver.crt
```

## 更新過期時間

根據集群的不同，可以選擇如下幾種方法來更新證書過期時間（任選一種即可）。

### 方法1: 使用 kubeadm 升級集群自動輪換證書

```sh
kubeadm upgrade apply --certificate-renewal v1.15.0
```

### 方法2:  使用 kubeadm 手動生成並替換證書

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

非 kubeadm 集群請參考 [配置 CA 並創建 TLS 證書](../deploy/kubernetes-the-hard-way/04-certificate-authority.md) 重新生成證書，並重啟各個 Kubernetes 服務。

## kubelet 證書自動輪換

Kubelet 從 v1.8.0 開始支持[證書輪換](https://kubernetes.io/docs/tasks/tls/certificate-rotation/)，當證書過期時，可以自動生成新的密鑰，並從 Kubernetes API 申請新的證書。

證書輪換的開啟方法如下：

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

## 撤銷證書

Kubernetes 目前還不支持通過 [Certificate Rovocation List (CRL)](https://en.wikipedia.org/wiki/Certificate_revocation_list) 來[撤銷證書](https://github.com/kubernetes/kubernetes/issues/18982)。所以，目前撤銷證書的唯一方法就是使用新的 CA 重新生成所有證書，然後再重啟所有服務。

為了避免這個問題，推薦為客戶端配置 [OIDC](https://kubernetes.io/docs/reference/access-authn-authz/authentication/#openid-connect-tokens) 認證，比如可以使用 [dex](https://github.com/dexidp/dex) 項目來實現。

> 注：Etcd 支持 CRL 撤銷證書，具體實現可以參考[這裡](https://github.com/etcd-io/etcd/blob/master/pkg/transport/listener_tls.go#L169-L190)。

## 附: 名詞解釋

- CA (Certificate Authority)：根證書籤發機構，用於簽發證書（即證明證書是合法的）。
  - CA 擁有私鑰 (ca.key) 和證書 (ca.crt，包含公鑰)。對於自簽名 CA 來說， ca.crt 需要分發給所有客戶端。
  - ca.crt 會自動掛載到 Pod 中`/var/run/secrets/kubernetes.io/serviceaccount/ca.crt`
- key (Public key or Private key)：即公鑰或者私鑰。
- csr (Certificate Signing Request)：證書籤名請求，用於向權威證書頒發機構獲得簽名證書的申請，申請中通常包含公鑰（私鑰自己保存）。
- crt/cer (Certificate)：已簽發的證書，一般是 PEM 格式（也支持 DER 格式）。

## 參考文檔

- [Certificate Management with kubeadm](https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-certs/)
- [Manage TLS Certificates in a Cluster](https://kubernetes.io/docs/tasks/tls/managing-tls-in-a-cluster/)
- [Kubelet Certificate Rotation](https://kubernetes.io/docs/tasks/tls/certificate-rotation/)
