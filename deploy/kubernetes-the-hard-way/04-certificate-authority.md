# 配置 CA 並創建 TLS 證書

我們將使用 CloudFlare's PKI 工具 [cfssl](https://github.com/cloudflare/cfssl) 來配置 [PKI Infrastructure](https://en.wikipedia.org/wiki/Public_key_infrastructure)，然後使用它去創建 Certificate Authority（CA）， 併為 etcd、kube-apiserver、kubelet 以及 kube-proxy 創建 TLS 證書。

## Certificate Authority

本節創建用於生成其他 TLS 證書的 Certificate Authority。

新建 CA 配置文件

```sh
cat > ca-config.json <<EOF
{
  "signing": {
    "default": {
      "expiry": "8760h"
    },
    "profiles": {
      "kubernetes": {
        "usages": ["signing", "key encipherment", "server auth", "client auth"],
        "expiry": "8760h"
      }
    }
  }
}
EOF
```

新建 CA 憑證簽發請求文件:

```sh
cat > ca-csr.json <<EOF
{
  "CN": "Kubernetes",
  "key": {
    "algo": "rsa",
    "size": 2048
  },
  "names": [
    {
      "C": "US",
      "L": "Portland",
      "O": "Kubernetes",
      "OU": "CA",
      "ST": "Oregon"
    }
  ]
}
EOF
```

生成 CA 憑證和私鑰:

```sh
cfssl gencert -initca ca-csr.json | cfssljson -bare ca
```

結果將生成以下兩個文件：

```sh
ca-key.pem
ca.pem
```

## client 與 server 憑證

本節將創建用於 Kubernetes 組件的 client 與 server 憑證，以及一個用於 Kubernetes admin 用戶的 client 憑證。

### Admin 客戶端憑證

創建 `admin` client 憑證簽發請求文件:

```sh
cat > admin-csr.json <<EOF
{
  "CN": "admin",
  "key": {
    "algo": "rsa",
    "size": 2048
  },
  "names": [
    {
      "C": "US",
      "L": "Portland",
      "O": "system:masters",
      "OU": "Kubernetes The Hard Way",
      "ST": "Oregon"
    }
  ]
}
EOF
```

創建 `admin` client 憑證和私鑰:

```sh
cfssl gencert \
  -ca=ca.pem \
  -ca-key=ca-key.pem \
  -config=ca-config.json \
  -profile=kubernetes \
  admin-csr.json | cfssljson -bare admin
```

結果將生成以下兩個文件

```sh
admin-key.pem
admin.pem
```

### Kubelet 客戶端憑證

Kubernetes 使用 [special-purpose authorization mode](https://kubernetes.io/docs/admin/authorization/node/)（被稱作 Node Authorizer）授權來自 [Kubelet](https://kubernetes.io/docs/concepts/overview/components/#kubelet)
的 API 請求。為了通過 Node Authorizer 的授權, Kubelet 必須使用一個署名為 `system:node:<nodeName>` 的憑證來證明它屬於 `system:nodes` 用戶組。本節將會給每臺 worker 節點創建符合 Node Authorizer 要求的憑證。

給每臺 worker 節點創建憑證和私鑰：

```sh
for instance in worker-0 worker-1 worker-2; do
cat > ${instance}-csr.json <<EOF
{
  "CN": "system:node:${instance}",
  "key": {
    "algo": "rsa",
    "size": 2048
  },
  "names": [
    {
      "C": "US",
      "L": "Portland",
      "O": "system:nodes",
      "OU": "Kubernetes The Hard Way",
      "ST": "Oregon"
    }
  ]
}
EOF

EXTERNAL_IP=$(gcloud compute instances describe ${instance} \
  --format 'value(networkInterfaces[0].accessConfigs[0].natIP)')

INTERNAL_IP=$(gcloud compute instances describe ${instance} \
  --format 'value(networkInterfaces[0].networkIP)')

cfssl gencert \
  -ca=ca.pem \
  -ca-key=ca-key.pem \
  -config=ca-config.json \
  -hostname=${instance},${EXTERNAL_IP},${INTERNAL_IP} \
  -profile=kubernetes \
  ${instance}-csr.json | cfssljson -bare ${instance}
done
```

結果將產生以下幾個文件：

```sh
worker-0-key.pem
worker-0.pem
worker-1-key.pem
worker-1.pem
worker-2-key.pem
worker-2.pem
```

### Kube-controller-manager 客戶端憑證

```sh
cat > kube-controller-manager-csr.json <<EOF
{
  "CN": "system:kube-controller-manager",
  "key": {
    "algo": "rsa",
    "size": 2048
  },
  "names": [
    {
      "C": "US",
      "L": "Portland",
      "O": "system:kube-controller-manager",
      "OU": "Kubernetes The Hard Way",
      "ST": "Oregon"
    }
  ]
}
EOF

cfssl gencert \
  -ca=ca.pem \
  -ca-key=ca-key.pem \
  -config=ca-config.json \
  -profile=kubernetes \
  kube-controller-manager-csr.json | cfssljson -bare kube-controller-manager
```

結果將產生以下幾個文件：

```sh
kube-controller-manager-key.pem
kube-controller-manager.pem
```

### Kube-proxy 客戶端憑證

```sh
cat > kube-proxy-csr.json <<EOF
{
  "CN": "system:kube-proxy",
  "key": {
    "algo": "rsa",
    "size": 2048
  },
  "names": [
    {
      "C": "US",
      "L": "Portland",
      "O": "system:node-proxier",
      "OU": "Kubernetes The Hard Way",
      "ST": "Oregon"
    }
  ]
}
EOF

cfssl gencert \
  -ca=ca.pem \
  -ca-key=ca-key.pem \
  -config=ca-config.json \
  -profile=kubernetes \
  kube-proxy-csr.json | cfssljson -bare kube-proxy
```

結果將產生以下兩個文件：

```sh
kube-proxy-key.pem
kube-proxy.pem
```

### kube-scheduler 證書

```sh
cat > kube-scheduler-csr.json <<EOF
{
  "CN": "system:kube-scheduler",
  "key": {
    "algo": "rsa",
    "size": 2048
  },
  "names": [
    {
      "C": "US",
      "L": "Portland",
      "O": "system:kube-scheduler",
      "OU": "Kubernetes The Hard Way",
      "ST": "Oregon"
    }
  ]
}
EOF

cfssl gencert \
  -ca=ca.pem \
  -ca-key=ca-key.pem \
  -config=ca-config.json \
  -profile=kubernetes \
  kube-scheduler-csr.json | cfssljson -bare kube-scheduler
```

結果將產生以下兩個文件：

```sh
kube-scheduler-key.pem
kube-scheduler.pem
```

### Kubernetes API Server 證書

為了保證客戶端與 Kubernetes API 的認證，Kubernetes API Server 憑證 中必需包含 `kubernetes-the-hard-way` 的靜態 IP 地址。

首先查詢 `kubernetes-the-hard-way` 的靜態 IP 地址:

```sh
KUBERNETES_PUBLIC_ADDRESS=$(gcloud compute addresses describe kubernetes-the-hard-way \
  --region $(gcloud config get-value compute/region) \
  --format 'value(address)')
```

創建 Kubernetes API Server 憑證簽發請求文件:

```sh
cat > kubernetes-csr.json <<EOF
{
  "CN": "kubernetes",
  "key": {
    "algo": "rsa",
    "size": 2048
  },
  "names": [
    {
      "C": "US",
      "L": "Portland",
      "O": "Kubernetes",
      "OU": "Kubernetes The Hard Way",
      "ST": "Oregon"
    }
  ]
}
EOF
```

創建 Kubernetes API Server 憑證與私鑰:

```sh
cfssl gencert \
  -ca=ca.pem \
  -ca-key=ca-key.pem \
  -config=ca-config.json \
  -hostname=10.32.0.1,10.240.0.10,10.240.0.11,10.240.0.12,${KUBERNETES_PUBLIC_ADDRESS},127.0.0.1,kubernetes.default \
  -profile=kubernetes \
  kubernetes-csr.json | cfssljson -bare kubernetes
```

結果產生以下兩個文件:

```sh
kubernetes-key.pem
kubernetes.pem
```

### Service Account 證書

```sh
cat > service-account-csr.json <<EOF
{
  "CN": "service-accounts",
  "key": {
    "algo": "rsa",
    "size": 2048
  },
  "names": [
    {
      "C": "US",
      "L": "Portland",
      "O": "Kubernetes",
      "OU": "Kubernetes The Hard Way",
      "ST": "Oregon"
    }
  ]
}
EOF

cfssl gencert \
  -ca=ca.pem \
  -ca-key=ca-key.pem \
  -config=ca-config.json \
  -profile=kubernetes \
  service-account-csr.json | cfssljson -bare service-account
```

結果將生成以下兩個文件

```sh
service-account-key.pem
service-account.pem
```

## 分發客戶端和服務器證書

將客戶端憑證以及私鑰複製到每個工作節點上:

```sh
for instance in worker-0 worker-1 worker-2; do
  gcloud compute scp ca.pem ${instance}-key.pem ${instance}.pem ${instance}:~/
done
```

將服務器憑證以及私鑰複製到每個控制節點上:

```sh
for instance in controller-0 controller-1 controller-2; do
  gcloud compute scp ca.pem ca-key.pem kubernetes-key.pem kubernetes.pem \
    service-account-key.pem service-account.pem ${instance}:~/
done
```

> `kube-proxy`、`kube-controller-manager`、`kube-scheduler` 和 `kubelet` 客戶端憑證將會在下一節中用來創建客戶端簽發請求文件。

下一步：[配置和生成 Kubernetes 配置文件](05-kubernetes-configuration-files.md)。
