
# 配置 Pod 网络路由

Pods 排程到节点上会从节点的Pod CIDR 范围里挑出一个IP address。由于missing network [routes](https://cloud.google.com/compute/docs/vpc/routes)导致这些pods并不能与属于其他节点的pods沟通。

这次实验我们将会建立一个路由给每个worker 节点, 帮助对应节点上 Pod CDIR 范围 到此节点的 内部IP address。

> [其他方法](https://kubernetes.io/docs/concepts/cluster-administration/networking/#how-to-achieve-this)来实做Kubernetes 网路模型

## 路由表

在这个部份你将会收集必要的资讯用以建立`kubernetes-the-hard-way` VPC 网路的路由

列出每个worker 节点的内部IP address 和 Pod CIDR 范围:



```
for instance in worker-0 worker-1 worker-2; do
  gcloud compute instances describe ${instance} \
    --format 'value[separator=" "](networkInterfaces[0].networkIP,metadata.items[0].value)'
done
```
> 输出为

```
10.240.0.20 10.200.0.0/24
10.240.0.21 10.200.1.0/24
10.240.0.22 10.200.2.0/24
```

## 路由

为每个worker节点建立网路路由:

```
for i in 0 1 2; do
  gcloud compute routes create kubernetes-route-10-200-${i}-0-24 \
    --network kubernetes-the-hard-way \
    --next-hop-address 10.240.0.2${i} \
    --destination-range 10.200.${i}.0/24
done
```

列出`kubernetes-the-hard-way` VPC 网路的路由表:

```
gcloud compute routes list --filter "network: kubernetes-the-hard-way"
```

> 输出为


```
NAME                            NETWORK                  DEST_RANGE     NEXT_HOP                  PRIORITY
default-route-77bcc6bee33b5535  kubernetes-the-hard-way  10.240.0.0/24                            1000
default-route-b11fc914b626974d  kubernetes-the-hard-way  0.0.0.0/0      default-internet-gateway  1000
kubernetes-route-10-200-0-0-24  kubernetes-the-hard-way  10.200.0.0/24  10.240.0.20               1000
kubernetes-route-10-200-1-0-24  kubernetes-the-hard-way  10.200.1.0/24  10.240.0.21               1000
kubernetes-route-10-200-2-0-24  kubernetes-the-hard-way  10.200.2.0/24  10.240.0.22               1000
```



Next: [部署 DNS 扩展](12-dns-addon.md)
