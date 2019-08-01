# 刪除集群

本部分將刪除該教程所創建的全部計算資源。

## 計算節點

刪除所有的控制節點和 worker 節點:

```sh
gcloud -q compute instances delete \
  controller-0 controller-1 controller-2 \
  worker-0 worker-1 worker-2
```

## 網路

刪除外部負載均衡器以及網絡資源:

```sh
gcloud -q compute forwarding-rules delete kubernetes-forwarding-rule \
    --region $(gcloud config get-value compute/region)
gcloud -q compute target-pools delete kubernetes-target-pool
gcloud -q compute http-health-checks delete kubernetes
gcloud -q compute addresses delete kubernetes-the-hard-way
```

刪除 `kubernetes-the-hard-way` 防火牆規則:

```sh
gcloud -q compute firewall-rules delete \
  kubernetes-the-hard-way-allow-nginx-service \
  kubernetes-the-hard-way-allow-internal \
  kubernetes-the-hard-way-allow-external \
  kubernetes-the-hard-way-allow-health-check
```

刪除 Pod 網絡路由:

```sh
gcloud -q compute routes delete \
    kubernetes-route-10-200-0-0-24 \
    kubernetes-route-10-200-1-0-24 \
    kubernetes-route-10-200-2-0-24
```

刪除 `kubernetes` 子網:

```sh
gcloud -q compute networks subnets delete kubernetes
```

刪除 `kubernetes-the-hard-way` 網絡 VPC:

```sh
gcloud -q compute networks delete kubernetes-the-hard-way
```
