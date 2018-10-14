# 配置 Pod 网络路由

每个 Pod 都会从所在 Node 的 Pod CIDR 中分配一个 IP 地址。由于网络 [路由](https://cloud.google.com/compute/docs/vpc/routes) 还没有配置，跨节点的 Pod 之间还无法通信。

本部分将为每个 worker 节点创建一条路由，将匹配 Pod CIDR 的网络请求路由到 Node 的内网 IP 地址上。

> 也可以选择 [其他方法](https://kubernetes.io/docs/concepts/cluster-administration/networking/#how-to-achieve-this) 来实现 Kubernetes 网络模型。

## 路由表

本节将为创建 `kubernetes-the-hard-way` VPC 路由收集必要的信息。

列出每个 worker 节点的内部 IP 地址和 Pod CIDR 范围:

```sh
for instance in worker-0 worker-1 worker-2; do
  gcloud compute instances describe ${instance} \
    --format 'value[separator=" "](networkInterfaces[0].networkIP,metadata.items[0].value)'
done
```

输出为

```sh
10.240.0.20 10.200.0.0/24
10.240.0.21 10.200.1.0/24
10.240.0.22 10.200.2.0/24
```

## 路由

为每个 worker 节点创建网络路由:

```sh
for i in 0 1 2; do
  gcloud compute routes create kubernetes-route-10-200-${i}-0-24 \
    --network kubernetes-the-hard-way \
    --next-hop-address 10.240.0.2${i} \
    --destination-range 10.200.${i}.0/24
done
```

列出 `kubernetes-the-hard-way` VPC 网络的路由表:

```sh
gcloud compute routes list --filter "network: kubernetes-the-hard-way"
```

输出为

```sh
NAME                            NETWORK                  DEST_RANGE     NEXT_HOP                  PRIORITY
default-route-081879136902de56  kubernetes-the-hard-way  10.240.0.0/24  kubernetes-the-hard-way   1000
default-route-55199a5aa126d7aa  kubernetes-the-hard-way  0.0.0.0/0      default-internet-gateway  1000
kubernetes-route-10-200-0-0-24  kubernetes-the-hard-way  10.200.0.0/24  10.240.0.20               1000
kubernetes-route-10-200-1-0-24  kubernetes-the-hard-way  10.200.1.0/24  10.240.0.21               1000
kubernetes-route-10-200-2-0-24  kubernetes-the-hard-way  10.200.2.0/24  10.240.0.22               1000
```

下一步：[部署 DNS 扩展](12-dns-addon.md)。
