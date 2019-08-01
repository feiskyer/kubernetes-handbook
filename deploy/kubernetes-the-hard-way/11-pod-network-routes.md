# 配置 Pod 網絡路由

每個 Pod 都會從所在 Node 的 Pod CIDR 中分配一個 IP 地址。由於網絡 [路由](https://cloud.google.com/compute/docs/vpc/routes) 還沒有配置，跨節點的 Pod 之間還無法通信。

本部分將為每個 worker 節點創建一條路由，將匹配 Pod CIDR 的網絡請求路由到 Node 的內網 IP 地址上。

> 也可以選擇 [其他方法](https://kubernetes.io/docs/concepts/cluster-administration/networking/#how-to-achieve-this) 來實現 Kubernetes 網絡模型。

## 路由表

本節將為創建 `kubernetes-the-hard-way` VPC 路由收集必要的信息。

列出每個 worker 節點的內部 IP 地址和 Pod CIDR 範圍:

```sh
for instance in worker-0 worker-1 worker-2; do
  gcloud compute instances describe ${instance} \
    --format 'value[separator=" "](networkInterfaces[0].networkIP,metadata.items[0].value)'
done
```

輸出為

```sh
10.240.0.20 10.200.0.0/24
10.240.0.21 10.200.1.0/24
10.240.0.22 10.200.2.0/24
```

## 路由

為每個 worker 節點創建網絡路由:

```sh
for i in 0 1 2; do
  gcloud compute routes create kubernetes-route-10-200-${i}-0-24 \
    --network kubernetes-the-hard-way \
    --next-hop-address 10.240.0.2${i} \
    --destination-range 10.200.${i}.0/24
done
```

列出 `kubernetes-the-hard-way` VPC 網絡的路由表:

```sh
gcloud compute routes list --filter "network: kubernetes-the-hard-way"
```

輸出為

```sh
NAME                            NETWORK                  DEST_RANGE     NEXT_HOP                  PRIORITY
default-route-081879136902de56  kubernetes-the-hard-way  10.240.0.0/24  kubernetes-the-hard-way   1000
default-route-55199a5aa126d7aa  kubernetes-the-hard-way  0.0.0.0/0      default-internet-gateway  1000
kubernetes-route-10-200-0-0-24  kubernetes-the-hard-way  10.200.0.0/24  10.240.0.20               1000
kubernetes-route-10-200-1-0-24  kubernetes-the-hard-way  10.200.1.0/24  10.240.0.21               1000
kubernetes-route-10-200-2-0-24  kubernetes-the-hard-way  10.200.2.0/24  10.240.0.22               1000
```

下一步：[部署 DNS 擴展](12-dns-addon.md)。
