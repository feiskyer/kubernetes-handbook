# 配置 CA 并创建 TLS 证书

我们将使用 CloudFlare's PKI 工具 [cfssl](https://github.com/cloudflare/cfssl) 来配置 [PKI Infrastructure](https://en.wikipedia.org/wiki/Public_key_infrastructure)，然后使用它去创建 Certificate Authority（CA）， 并为 etcd、kube-apiserver、kubelet 以及 kube-proxy 创建 TLS 证书。

## Certificate Authority

本节创建用于生成其他 TLS 证书的 Certificate Authority。

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

新建 CA 凭证签发请求文件:

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

生成 CA 凭证和私钥:

```sh
cfssl gencert -initca ca-csr.json | cfssljson -bare ca
```

结果将生成以下两个文件：

```sh
ca-key.pem
ca.pem
```

## client 与 server 凭证

本节将创建用于 Kubernetes 组件的 client 与 server 凭证，以及一个用于 Kubernetes admin 用户的 client 凭证。

### Admin 客户端凭证

创建 `admin` client 凭证签发请求文件:

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

创建 `admin` client 凭证和私钥:

```sh
cfssl gencert \
  -ca=ca.pem \
  -ca-key=ca-key.pem \
  -config=ca-config.json \
  -profile=kubernetes \
  admin-csr.json | cfssljson -bare admin
```

结果将生成以下两个文件

```sh
admin-key.pem
admin.pem
```

### Kubelet 客户端凭证

Kubernetes 使用 [special-purpose authorization mode](https://kubernetes.io/docs/admin/authorization/node/)（被称作 Node Authorizer）授权来自 [Kubelet](https://kubernetes.io/docs/concepts/overview/components/#kubelet)
的 API 请求。为了通过 Node Authorizer 的授权, Kubelet 必须使用一个署名为 `system:node:<nodeName>` 的凭证来证明它属于 `system:nodes` 用户组。本节将会给每台 worker 节点创建符合 Node Authorizer 要求的凭证。

给每台 worker 节点创建凭证和私钥：

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

结果将产生以下几个文件：

```sh
worker-0-key.pem
worker-0.pem
worker-1-key.pem
worker-1.pem
worker-2-key.pem
worker-2.pem
```

### Kube-controller-manager 客户端凭证

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

结果将产生以下几个文件：

```sh
kube-controller-manager-key.pem
kube-controller-manager.pem
```

### Kube-proxy 客户端凭证

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

结果将产生以下两个文件：

```sh
kube-proxy-key.pem
kube-proxy.pem
```

### kube-scheduler 证书

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

结果将产生以下两个文件：

```sh
kube-scheduler-key.pem
kube-scheduler.pem
```

### Kubernetes API Server 证书

为了保证客户端与 Kubernetes API 的认证，Kubernetes API Server 凭证 中必需包含 `kubernetes-the-hard-way` 的静态 IP 地址。

首先查询 `kubernetes-the-hard-way` 的静态 IP 地址:

```sh
KUBERNETES_PUBLIC_ADDRESS=$(gcloud compute addresses describe kubernetes-the-hard-way \
  --region $(gcloud config get-value compute/region) \
  --format 'value(address)')
```

创建 Kubernetes API Server 凭证签发请求文件:

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

创建 Kubernetes API Server 凭证与私钥:

```sh
cfssl gencert \
  -ca=ca.pem \
  -ca-key=ca-key.pem \
  -config=ca-config.json \
  -hostname=10.32.0.1,10.240.0.10,10.240.0.11,10.240.0.12,${KUBERNETES_PUBLIC_ADDRESS},127.0.0.1,kubernetes.default \
  -profile=kubernetes \
  kubernetes-csr.json | cfssljson -bare kubernetes
```

结果产生以下两个文件:

```sh
kubernetes-key.pem
kubernetes.pem
```

### Service Account 证书

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

结果将生成以下两个文件

```sh
service-account-key.pem
service-account.pem
```

## 分发客户端和服务器证书

将客户端凭证以及私钥复制到每个工作节点上:

```sh
for instance in worker-0 worker-1 worker-2; do
  gcloud compute scp ca.pem ${instance}-key.pem ${instance}.pem ${instance}:~/
done
```

将服务器凭证以及私钥复制到每个控制节点上:

```sh
for instance in controller-0 controller-1 controller-2; do
  gcloud compute scp ca.pem ca-key.pem kubernetes-key.pem kubernetes.pem \
    service-account-key.pem service-account.pem ${instance}:~/
done
```

> `kube-proxy`、`kube-controller-manager`、`kube-scheduler` 和 `kubelet` 客户端凭证将会在下一节中用来创建客户端签发请求文件。

下一步：[配置和生成 Kubernetes 配置文件](05-kubernetes-configuration-files.md)。
