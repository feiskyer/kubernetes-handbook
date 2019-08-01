# 資源控制

推薦在 YAML 清單中針對所有 pod 設置 pod 請求和限制：

- **pod 請求**定義 pod 所需的 CPU 和內存量。Kubernetes 基於這些請求量進行節點調度。
- **pod 限制**是 pod 可以使用的最大 CPU 和內存量，用於防治失控 Pod 佔用過多資源。

如果不包含這些值，Kubernetes 調度程序將不知道需要多少資源。 調度程序可能會在資源不足的節點上運行 pod，從而無法提供可接受的應用程序性能。 

群集管理員也可以為需要設置資源請求和限制的命名空間設置資源配額。

## 使用 kube-advisor 檢查應用程序問題

你可以定期運行 [kube-advisor](https://github.com/Azure/kube-advisor) 工具，檢查應用程序的配置是否存在問題。

運行 kube-advisor 示例：

```sh
$ kubectl apply -f https://github.com/Azure/kube-advisor/raw/master/sa.yaml

$ kubectl run --rm -i -t kube-advisor --image=mcr.microsoft.com/aks/kubeadvisor --restart=Never --overrides="{ \"apiVersion\": \"v1\", \"spec\": { \"serviceAccountName\": \"kube-advisor\" } }"
If you don't see a command prompt, try pressing enter.
+--------------+-------------------------+----------------+-------------+--------------------------------+
|  NAMESPACE   |  POD NAME               | POD CPU/MEMORY | CONTAINER   |             ISSUE              |
+--------------+-------------------------+----------------+-------------+--------------------------------+
| default      | demo-58bcb96b46-9952m   | 0 / 41272Ki    | demo        | CPU Resource Limits Missing    |
+              +                         +                +             +--------------------------------+
|              |                         |                |             | Memory Resource Limits Missing |
+              +                         +                +             +--------------------------------+
|              |                         |                |             | CPU Request Limits Missing     |
+              +                         +                +             +--------------------------------+
|              |                         |                |             | Memory Request Limits Missing  |
+--------------+-------------------------+----------------+-------------+--------------------------------+
```

## 參考文檔

- <https://github.com/Azure/kube-advisor>
- [Best practices for application developers to manage resources in Azure Kubernetes Service](https://docs.microsoft.com/en-us/azure/aks/developer-best-practices-resource-management)

