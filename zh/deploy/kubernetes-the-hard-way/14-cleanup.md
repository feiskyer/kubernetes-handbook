# 删除集群

本部分将删除该教程所创建的全部计算资源。

## 计算节点

删除所有的控制节点和 worker 节点:

```sh
gcloud -q compute instances delete \
  controller-0 controller-1 controller-2 \
  worker-0 worker-1 worker-2
```

## 网路

删除外部负载均衡器以及网络资源:

```sh
gcloud -q compute forwarding-rules delete kubernetes-forwarding-rule \
    --region $(gcloud config get-value compute/region)
gcloud -q compute target-pools delete kubernetes-target-pool
gcloud -q compute http-health-checks delete kubernetes
gcloud -q compute addresses delete kubernetes-the-hard-way
```

删除 `kubernetes-the-hard-way` 防火墙规则:

```sh
gcloud -q compute firewall-rules delete \
  kubernetes-the-hard-way-allow-nginx-service \
  kubernetes-the-hard-way-allow-internal \
  kubernetes-the-hard-way-allow-external \
  kubernetes-the-hard-way-allow-health-check
```

删除 Pod 网络路由:

```sh
gcloud -q compute routes delete \
    kubernetes-route-10-200-0-0-24 \
    kubernetes-route-10-200-1-0-24 \
    kubernetes-route-10-200-2-0-24
```

删除 `kubernetes` 子网:

```sh
gcloud -q compute networks subnets delete kubernetes
```

删除 `kubernetes-the-hard-way` 网络 VPC:

```sh
gcloud -q compute networks delete kubernetes-the-hard-way
```
