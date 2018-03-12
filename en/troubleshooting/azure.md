# Troubleshooting Azure Cloud Provider

## Azure Load Balancer (ALB)

When Azure cloud provider is configured (`kube-controller-manager --cloud-provider=azure --cloud-config=/etc/kubernetes/azure.json`), Azure load balancer (ALB) will be created automatically for `LoadBalancer` typed Service. Please note that only `Basic` SKU ALB is supported now, which has some [limitations](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-standard-overview) compared to `Standard` ALB:

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

Public IP associated is Basic SKU, which has some [limitations](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-standard-overview#sku-service-limits-and-abilities) compared to `Standard` Public IP:

| Public IP                    | Basic           | Standard                                   |
| ---------------------------- | --------------- | ------------------------------------------ |
| Availability Zones scenarios | Zonal only      | Zone-redundant (default), zonal (optional) |
| Fast IP Mobility             | Not supported   | Available                                  |
| VIP Availability             | Not supported   | Available                                  |
| Counters                     | Not supported   | Available                                  |
| Network Security Group       | Optional on NIC | Required                                   |

When creating LoadBalancer Service, a set of annotations could be set to customize ALB:

| Annotation                                                   | Comments                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| service.beta.kubernetes.io/azure-load-balancer-internal      | If set, create internal load balancer                        |
| service.beta.kubernetes.io/azure-load-balancer-internal-subnet | Set subnet for internal load balancer                      |
| service.beta.kubernetes.io/azure-load-balancer-mode          | Determine how to select ALB based on availability sets. Candidate values are: 1）Not set or empty, use `primaryAvailabilitySet` set in `/etc/kubernetes/azure.json`; 2）`auto`, select ALB which has the minimum rules associated ; 3）`as1,as2`, specify a list of availability sets |
| service.beta.kubernetes.io/azure-dns-label-name              | Set DNS label name                                           |
| service.beta.kubernetes.io/azure-shared-securityrule         | If set, NSG will be shared with other services. This relies on [Augmented Security Rules](https://docs.microsoft.com/en-us/azure/virtual-network/security-overview#augmented-security-rules) |
| service.beta.kubernetes.io/azure-load-balancer-resource-group | Specify the resource group of load balancer objects that are not in the same resource group as the cluster |

## Checking logs and events

ALB is managed by kube-controller-manager or cloud-controller-manager in kubernetes. So whenever there are problems with Azure cloud provider, their logs should be checked fist:

```sh
# kube-controller-manager
PODNAME=$(kubectl -n kube-system get pod -l component=kube-controller-manager -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100

# cloud-controller-manager
PODNAME=$(kubectl -n kube-system get pod -l component=cloud-controller-manager -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100
```

Resources events are also helpful, e.g. for Service

```sh
kubectl describe service <service-name>
```

## LoadBalancer Service stuck in Pending

When checking a service by `kubectl describe service <service-name>`, there is no error events. But its externalIP status is stuck in `<pending>`. This indicates something wrong when provisioning ALB/PublicIP/NSG. In such case, `kube-controller-manager` logs should be checked.

An incomplete list of things that could go wrong include:

- Authorization failed because of cloud-config misconfigured, e.g. clientId, clientSecret, tenantId, subscriptionId, resourceGroup. Fix the configuation in `/etc/kubernetes/azure.json` should solve the problem.
- Client configured is not authorized to ALB/PublicIP/NSG. Add authorization in Azure portal or create a new one (`az ad sp create-for-rbac --role="Contributor" --scopes="/subscriptions/<subscriptionID>/resourceGroups/<resourceGroupName>"` and update `/etc/kubernetes/azure.json` on all nodes) should solve the problem

## No target backends present for the internal load balancer (ILB)

This is a known bug ([kubernetes#59746](https://github.com/kubernetes/kubernetes/issues/59746) [kubernetes#60060](https://github.com/kubernetes/kubernetes/issues/60060) [acs-engine#2151](https://github.com/Azure/acs-engine/issues/2151)) in kubernetes v1.9.0-v1.9.3, which is caused by an error when matching ILB's AvaibilitySet.

The fix of this issue ([kubernetes#59747](https://github.com/kubernetes/kubernetes/pull/59747) [kubernetes#59083](https://github.com/kubernetes/kubernetes/pull/59083)) will be included in v1.9.4+ and v1.10+.

## PublicIP not removed after deleting LoadBalancer service

This is a known issue ([kubernetes#59255](https://github.com/kubernetes/kubernetes/issues/59255)) in v1.9.0-1.9.3: ALB has a default quota of 10 FrontendIPConfiguations for Basic ALB. When this quota is exceeded, ALB FrontendIPConfiguation won't be created but cloud provider continues to create PublicIPs for those services. And after deleting the services, those PublicIPs not removed togather.

The fix of this issue ([kubernetes#59340](https://github.com/kubernetes/kubernetes/pull/59340)) will be included in v1.9.4+ and v1.10+.

Besides the fix, if more than 10 LoadBalancer services are required in your cluster, you should also increase FrontendIPConfiguations quota to make it work. Check [Azure subscription and service limits, quotas, and constraints](https://docs.microsoft.com/en-us/azure/azure-subscription-service-limits) for how to do this.

## No credentials provided for AAD application with MSI

When Azure cloud provider is configured with `"useManagedIdentityExtension": true`, [Managed Service Identity (MSI)](https://docs.microsoft.com/en-us/azure/active-directory/msi-overview) is used to authorize Azure APIs. It is broken in v1.10.0-beta because of a refactor: [Config.UseManagedIdentityExtension overrides auth.AzureAuthConfig.UseManagedIdentityExtension]([kubernetes #60691](https://github.com/kubernetes/kubernetes/issues/60691)).

The fix of this issue ([kubernetes#60775](https://github.com/kubernetes/kubernetes/pull/60775)) will be included in v1.10.

## Azure ARM calls rejected because of too many requests

Sometimes, kube-controller-manager or kubelet may fail to call Azure ARM APIs because of too many requests in a period.

```sh
"OperationNotAllowed",\r\n    "message": "The server rejected the request because too many requests have been received for this subscription.
```

From [v1.9.2 and v1.10](https://github.com/kubernetes/kubernetes/issues/58770), Azure cloud provider adds cache for various resources (e.g. VM, VMSS, NSG and RouteTable).

Ways to mitigate the issue:

- Ensure instance metadata is used, e.g. set `useInstanceMetadata` to `true` in `/etc/kubernetes/azure.json` for all nodes and restart kubelet
- Increase `--route-reconciliation-period` on kube-controller-manager and restart it, e.g. set the option in `/etc/kubernetes/manifests/kube-controller-manager.yaml` and kubelet will recreate kube-controller-manager pods automatically

## References

- [Azure subscription and service limits, quotas, and constraints](https://docs.microsoft.com/en-us/azure/azure-subscription-service-limits)
