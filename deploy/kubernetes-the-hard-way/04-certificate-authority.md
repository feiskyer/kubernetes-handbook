
# 配置 CA 和产生 TLS 凭证

---

本次实验你将使用 CloudFlare's PKI 工具, [cfssl](https://github.com/cloudflare/cfssl), 来提供 [PKI Infrastructure](https://en.wikipedia.org/wiki/Public_key_infrastructure), 然后使用它去建立Certificate Authority(CA), 并产生 TLS 凭证给以下组件使用: etcd, kube-apiserver, kubelet, 和 kube-proxy

## Certificate Authority

在这个部份会提供 Certificate Authority 来产生额外的 TLS 凭证

新建 CA 设定档:


```
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

新建 CA 凭证簽发请求文件:

```
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
产生 CA 凭证和 私钥:

```
cfssl gencert -initca ca-csr.json | cfssljson -bare ca
```

结果:

```
ca-key.pem
ca.pem
```

## client 与 server 凭证

这个部份你将会建立 client 与 server 的凭证给每个 Kubernetes 的组件, 建立一个 client 凭证 给Kubernetes `admin` 使用者


### The Admin Client Certificate

建立 `admin` client 凭证簽发请求文件:


```
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

产生 `admin` client 凭证 和 私钥:


```
cfssl gencert \
  -ca=ca.pem \
  -ca-key=ca-key.pem \
  -config=ca-config.json \
  -profile=kubernetes \
  admin-csr.json | cfssljson -bare admin
```


结果:

```
admin-key.pem
admin.pem
```


### The Kubelet Client Certificates

Kubernetes 使用[special-purpose authorization mode](https://kubernetes.io/docs/admin/authorization/node/), 被称作Node Authorizer, 这个是用来授权 来自[Kubelets](https://kubernetes.io/docs/concepts/overview/components/#kubelet)
的 API  请求。为了要通过 Node Authorizer  的授权, Kubelet 必须使用一个凭证属名为`system:node:<nodeName>`, 来证明它属于 `system:nodes` 的群集。

在这个部份将产生一个凭证给每个 Kubernetes 工作节点以符合Node Authorizer的需求。

建立 凭证以及私钥 给每个 Kubernetes 工作节点:


```
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

结果: 

```
worker-0-key.pem
worker-0.pem
worker-1-key.pem
worker-1.pem
worker-2-key.pem
worker-2.pem

```

### The kube-proxy Client Certificate



```
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
```

建立 `kube-proxy` client 凭证和私钥:



```
cfssl gencert \
  -ca=ca.pem \
  -ca-key=ca-key.pem \
  -config=ca-config.json \
  -profile=kubernetes \
  kube-proxy-csr.json | cfssljson -bare kube-proxy
```

结果:

```
kube-proxy-key.pem
kube-proxy.pem
```


### The Kubernetes API Server Certificate

`kubernetes-the-hard-way`的固定 IP 地址 会被含在 Kubernetes API Server 凭证里

这将确保此凭证对远端客户端仍然有效

设置 `kubernetes-the-hard-way`的 固定 IP 地址:



```
KUBERNETES_PUBLIC_ADDRESS=$(gcloud compute addresses describe kubernetes-the-hard-way \
  --region $(gcloud config get-value compute/region) \
  --format 'value(address)')
```

建立 Kubernetes API Server 凭证簽发请求文件:



```
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

建立 Kubernetes API Server 凭证与私钥:


```
cfssl gencert \
  -ca=ca.pem \
  -ca-key=ca-key.pem \
  -config=ca-config.json \
  -hostname=10.32.0.1,10.240.0.10,10.240.0.11,10.240.0.12,${KUBERNETES_PUBLIC_ADDRESS},127.0.0.1,kubernetes.default \
  -profile=kubernetes \
  kubernetes-csr.json | cfssljson -bare kubernetes
```

结果:

```
kubernetes-key.pem
kubernetes.pem
```

## Distribute the Client and Server Certificates

复制凭证以及私钥到每个工作节点上:

```
for instance in worker-0 worker-1 worker-2; do
  gcloud compute scp ca.pem ${instance}-key.pem ${instance}.pem ${instance}:~/
done
```

复制凭证以及私钥到每个控制节点上:


```
for instance in controller-0 controller-1 controller-2; do
  gcloud compute scp ca.pem ca-key.pem kubernetes-key.pem kubernetes.pem ${instance}:~/
done
```

> `kube-proxy` 和 `kubelet` client 凭证将会被用来产生client 的授权设定档, 我们将在下一个实验中说明

Next: [配置和生成 Kubernetes 配置文件](05-kubernetes-configuration-files.md)



