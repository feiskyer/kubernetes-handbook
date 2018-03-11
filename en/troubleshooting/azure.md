# Azure 云平台排错

## Azure 负载均衡

使用 Azure Cloud Provider 后，Kubernetes 会为 LoadBalancer 类型的 Service 创建 Azure 负载均衡器以及相关的 公网 IP、BackendPool 和 Network Security Group (NSG)。注意目前 Azure Cloud Provider 仅支持 `Basic` SKU 的负载均衡，它与 `Standard` SKU 负载均衡相比有一定的[局限](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-standard-overview)：

| Load Balancer                     | Basic                                                        | Standard                                         |
| --------------------------------- | ------------------------------------------------------------ | ------------------------------------------------ |
| Back-end pool size                | up to 100                                                    | up to 1,000                                      |
| Back-end pool boundary            | Availability Set                                             | virtual network, region                          |
| Back-end pool design              | VMs in Availability Set, virtual machine scale set in Availability Set | Any VM instance in the virtual network           |
| HA Ports                          | Not supported                                                | Available                                        |
| Diagnostics                       | Limited, public only                                         | Available                                        |
| VIP Availability                  | Not supported                                                | Available                                        |
| Fast IP Mobility                  | Not supported                                                | Available                                        |
| Availability Zones scenarios      | Zonal only                                                   | Zonal, Zone-redundant, Cross-zone load-balancing |
| Outbound SNAT algorithm           | On-demand                                                    | Preallocated                                     |
| Outbound SNAT front-end selection | Not configurable, multiple candidates                        | Optional configuration to reduce candidates      |
| Network Security Group            | Optional on NIC/subnet                                       | Required                                         |

同样，对应的 Public IP 也是 Basic SKU，与 Standard SKU 相比也有一定的[局限](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-standard-overview#sku-service-limits-and-abilities)：

| Public IP                    | Basic           | Standard                                   |
| ---------------------------- | --------------- | ------------------------------------------ |
| Availability Zones scenarios | Zonal only      | Zone-redundant (default), zonal (optional) |
| Fast IP Mobility             | Not supported   | Available                                  |
| VIP Availability             | Not supported   | Available                                  |
| Counters                     | Not supported   | Available                                  |
| Network Security Group       | Optional on NIC | Required                                   |

在创建 Service 时，可以通过 `metadata.annotation` 来自定义 Azure 负载均衡的行为，可选的选项包括

| Annotation                                                   | 功能                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| service.beta.kubernetes.io/azure-load-balancer-internal      | 如果设置，则创建内网负载均衡                                 |
| service.beta.kubernetes.io/azure-load-balancer-internal-subnet | 设置内网负载均衡 IP 使用的子网                               |
| service.beta.kubernetes.io/azure-load-balancer-mode          | 设置如何为负载均衡选择所属的 AvailabilitySet（之所以有该选项是因为在 Azure 的每个 AvailabilitySet 中只能创建最多一个外网负载均衡和一个内网负载均衡）。可选项为：（1）不设置或者设置为空，使用 `/etc/kubernetes/azure.json` 中设置的 `primaryAvailabilitySet`；（2）设置为 `auto`，选择负载均衡规则最少的 AvailabilitySet；（3）设置为`as1,as2`，指定 AvailabilitySet 列表 |
| service.beta.kubernetes.io/azure-dns-label-name              | 设置后为公网 IP 创建 外网 DNS                                |
| service.beta.kubernetes.io/azure-shared-securityrule         | 如果设置，则为多个 Service 共享相同的 NSG 规则。注意该选项需要 [Augmented Security Rules](https://docs.microsoft.com/en-us/azure/virtual-network/security-overview#augmented-security-rules) |
| service.beta.kubernetes.io/azure-load-balancer-resource-group | 当为 Service 指定公网 IP 并且该公网 IP 与 Kubernetes 集群不在同一个 Resource Group 时，需要使用该 Annotation 指定公网 IP 所在的 Resource Group |

在 Kubernetes 中，负载均衡的创建逻辑都在 kube-controller-manager 中，因而排查负载均衡相关的问题时，除了查看 Service 自身的状态，如

```sh
kubectl describe service <service-name>
```

还需要查看 kube-controller-manager 是否有异常发生：

```
PODNAME=$(kubectl -n kube-system get pod -l component=kube-controller-manager -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100
```

## LoadBalancer Service 一直处于 pending 状态

查看 Service `kubectl describe service <service-name>` 没有错误信息，但 EXTERNAL-IP 一直是 `<pending>`，说明 Azure Cloud Provider 在创建 LB/NSG/PublicIP 过程中出错。一般按照前面的步骤查看 kube-controller-manager 可以查到具体失败的原因，可能的因素包括

- clientId、clientSecret、tenandId 或 subscriptionId 配置错误导致 Azure API 认证失败：更新所有节点的 `/etc/kubernetes/azure.json` ，修复错误的配置即可恢复服务
- 配置的客户端无权管理 LB/NSG/PublicIP/VM：可以为使用的 clientId 增加授权或创建新的 `az ad sp create-for-rbac --role="Contributor" --scopes="/subscriptions/<subscriptionID>/resourceGroups/<resourceGroupName>"`

## 内网负载均衡 BackendPool 为空

Kubernetes 1.9.0-1.9.3 中会有这个问题（[kubernetes#59746](https://github.com/kubernetes/kubernetes/issues/59746) [kubernetes#60060](https://github.com/kubernetes/kubernetes/issues/60060) [acs-engine#2151](https://github.com/Azure/acs-engine/issues/2151)），这是由于一个查找负载均衡所属 AvaibilitySet 的缺陷导致的。

该问题的修复（[kubernetes#59747](https://github.com/kubernetes/kubernetes/pull/59747) [kubernetes#59083](https://github.com/kubernetes/kubernetes/pull/59083)）将包含到 v1.9.4 和 v1.10 中。

## Service 删除后 Azure 公网 IP 未自动删除

Kubernetes 1.9.0-1.9.3 中会有这个问题（[kubernetes#59255](https://github.com/kubernetes/kubernetes/issues/59255)）：当创建超过 10 个 LoadBalancer Service 后有可能会碰到由于超过 FrontendIPConfiguations Quota（默认为 10）导致负载均衡无法创建的错误。此时虽然负载均衡无法创建，但公网 IP 已经创建成功了，由于 Cloud Provider 的缺陷导致删除 Service 后公网 IP 却未删除。

该问题的修复（[kubernetes#59340](https://github.com/kubernetes/kubernetes/pull/59340)）将包含到 v1.9.4 和 v1.10 中。

另外，超过 FrontendIPConfiguations Quota 的问题可以参考 [Azure subscription and service limits, quotas, and constraints](https://docs.microsoft.com/en-us/azure/azure-subscription-service-limits) 增加 Quota 来解决。

## MSI 无法使用

配置 `"useManagedIdentityExtension": true` 后，可以使用 [Managed Service Identity (MSI)](https://docs.microsoft.com/en-us/azure/active-directory/msi-overview) 来管理 Azure API 的认证授权。但由于 Cloud Provider 的缺陷（[kubernetes #60691](https://github.com/kubernetes/kubernetes/issues/60691) 未定义 `useManagedIdentityExtension` yaml 标签导致无法解析该选项。

该问题的修复（[kubernetes#60775](https://github.com/kubernetes/kubernetes/pull/60775)）将包含在 v1.10 中。