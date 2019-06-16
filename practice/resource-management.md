# 资源控制

推荐在 YAML 清单中针对所有 pod 设置 pod 请求和限制：

- **pod 请求**定义 pod 所需的 CPU 和内存量。Kubernetes 基于这些请求量进行节点调度。
- **pod 限制**是 pod 可以使用的最大 CPU 和内存量，用于防治失控 Pod 占用过多资源。

如果不包含这些值，Kubernetes 调度程序将不知道需要多少资源。 调度程序可能会在资源不足的节点上运行 pod，从而无法提供可接受的应用程序性能。 

群集管理员也可以为需要设置资源请求和限制的命名空间设置资源配额。

## 使用 kube-advisor 检查应用程序问题

你可以定期运行 [kube-advisor](https://github.com/Azure/kube-advisor) 工具，检查应用程序的配置是否存在问题。

运行 kube-advisor 示例：

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

## 参考文档

- <https://github.com/Azure/kube-advisor>
- [Best practices for application developers to manage resources in Azure Kubernetes Service](https://docs.microsoft.com/en-us/azure/aks/developer-best-practices-resource-management)

