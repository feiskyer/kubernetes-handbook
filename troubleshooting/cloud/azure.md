# Azure

## Azure Load Balancing

Upon using Azure Cloud Provider, Kubernetes creates an Azure Load Balancer along with its associated public IP, BackendPool, and Network Security Group (NSG) for each LoadBalancer-type Service. Note that Azure Cloud Provider only supports Basic SKU load balancing for now, but will support Standard SKU from v1.11 onwards. Compared with `Standard` SKU, `Basic` SKU load balancing has some [limitations](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-standard-overview):

| Load Balancer | Basic | Standard |
| :--- | :--- | :--- |
| Back-end pool size | up to 100 | up to 1,000 |
| Back-end pool boundary | Availability Set | virtual network, region |
| Back-end pool design | VMs in Availability Set, virtual machine scale set in Availability Set | Any VM instance in the virtual network |
| HA Ports | Not supported | Available |
| Diagnostics | Limited, public only | Available |
| VIP Availability | Not supported | Available |
| Fast IP Mobility | Not supported | Available |
| Availability Zones scenarios | Zonal only | Zonal, Zone-redundant, Cross-zone load-balancing |
| Outbound SNAT algorithm | On-demand | Preallocated |
| Outbound SNAT front-end selection | Not configurable, multiple candidates | Optional configuration to reduce candidates |
| Network Security Group | Optional on NIC/subnet | Required |

Additionally, the associated Public IP is Basic SKU and also has certain [limitations](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-standard-overview#sku-service-limits-and-abilities) compared to Standard SKU:

| Public IP | Basic | Standard |
| :--- | :--- | :--- |
| Availability Zones scenarios | Zonal only | Zone-redundant \(default\), zonal \(optional\) |
| Fast IP Mobility | Not supported | Available |
| VIP Availability | Not supported | Available |
| Counters | Not supported | Available |
| Network Security Group | Optional on NIC | Required |

When creating a Service, you can personalize the behavior of Azure Load Balancer through `metadata.annotation`. For optional Annotation lists, refer to [Cloud Provider Azure documentation](https://github.com/kubernetes-sigs/cloud-provider-azure/tree/master/docs/services).

In Kubernetes, the logic of creating a load balancer resides in the kube-controller-manager. Therefore, when debugging load balancer-related problems, in addition to examining the status of the Service itself, such as

```bash
kubectl describe service <service-name>
```

It's necessary to check whether there are abnormalities in the kube-controller-manager:

```bash
PODNAME=$(kubectl -n kube-system get pod -l component=kube-controller-manager -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100
```

## LoadBalancer Service remains in pending status

Checking the Service `kubectl describe service <service-name>` shows no error messages, but EXTERNAL-IP always appears as `<pending>`. This indicates that Azure Cloud Provider encountered an error during the LB/NSG/PublicIP creation process. Generally, you can check kube-controller-manager based on the steps above to find the specific cause of failure, which may include:

* Configuration error with clientId, clientSecret, tenandId or subscriptionId causing Azure API authentication failure: Service can be restored by updating `/etc/kubernetes/azure.json` on all nodes to correct any faulty configurations.
* The client configured is not authorized to manage LB/NSG/PublicIP/VM: Authorization can be increased for the clientId in use, or a new one can be created via `az ad sp create-for-rbac --role="Contributor" --scopes="/subscriptions/<subscriptionID>/resourceGroups/<resourceGroupName>"`.
* In Kubernetes v1.8.X there might be a `Security rule must specify SourceAddressPrefixes, SourceAddressPrefix, or SourceApplicationSecurityGroups` error due to Azure Go SDK problems. This can be resolved by upgrading the cluster to v1.9.X/v1.10.X or replacing SourceAddressPrefixes with multiple SourceAddressPrefix rules.

## Public IP of Load Balancer cannot be accessed

Azure Cloud Provider creates a probe for the load balancer, and only services that pass the probe can respond to user requests. Inability to access the public IP of the load balancer is typically caused by probe failure. Causes might be:

* Backend VM isn't functioning normally (can be fixed by restarting VM).
* Backend container isn't listening on the set port (resolved by configuring the correct port).
* Firewall or network security group blocking the port that needs to be accessed (resolved by adding security rules).
* When using internal load balancing, trying to access the ILB VIP from the same ILB backend VM will fail. This is [expected behavior by Azure](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-troubleshoot#cause-4-accessing-the-internal-load-balancer-vip-from-the-participating-load-balancer-backend-pool-vm) (in such situations, accessing the clusterIP of the service is possible).
* Load balancer IP may not be accessible if backend container doesn't respond to (some or all) external requests. Note that this scenario includes cases where **some containers do not respond**. This is a joint result of Azure probes and Kubernetes service discovery mechanism:
  * (1) Azure probes periodically access service's port (i.e., NodeIP:NodePort).
  * (2) Kubernetes load balances this to backend containers.
  * (3) When load balancing is directed to an abnormal container, access failure can cause probe failure, thus Azure might remove the VM from the load balancer.
  * This problem can be solved by using [health probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-probes/), ensuring abnormal containers are automatically removed from the service backend (endpoints).

## BackendPool of internal load balancer is empty

This issue occurs in Kubernetes 1.9.0-1.9.3 ([kubernetes\#59746](https://github.com/kubernetes/kubernetes/issues/59746), [kubernetes\#60060](https://github.com/kubernetes/kubernetes/issues/60060), [acs-engine\#2151](https://github.com/Azure/acs-engine/issues/2151)), and is due to a defect in searching for the AvaibilitySet to which the load balancer belongs. 

Problem resolution ([kubernetes\#59747](https://github.com/kubernetes/kubernetes/pull/59747), [kubernetes\#59083](https://github.com/kubernetes/kubernetes/pull/59083)) is included in v1.9.4 and v1.10.

## BackendPool of external load balancer is empty

In clusters deployed using Cloud Provider-unsupported tools like kubeadm, if the Kubelet isn't configured with `--cloud-provider=azure --cloud-config=/etc/kubernetes/cloud-config`, Kubelet will register itself in the cluster using the hostname. Under such circumstances, checking the Node information (kubectl get node  -o yaml) reveals that the externalID is the same as the hostname. In this case, the kube-controller-manager also can't add the Node to the backend of the load balancer.

A simple way to confirm this problem is to check whether the Node's externalID and name are different:

```bash
$ kubectl get node -o jsonpath='{.items[*].metadata.name}'
k8s-agentpool1-27347916-0
$ kubectl get node -o jsonpath='{.items[*].spec.externalID}'
/subscriptions/<subscription-id>/resourceGroups/<rg-name>/providers/Microsoft.Compute/virtualMachines/k8s-agentpool1-27347916-0
```

The solution to this issue is to first remove the Node `kubectl delete node <node-name>`, configure Kubelet with `--cloud-provider=azure --cloud-config=/etc/kubernetes/cloud-config`, then finally restart the Kubelet.

## Azure public IP not automatically removed after deleting Service

This issue can occur in Kubernetes 1.9.0-1.9.3 ([kubernetes\#59255](https://github.com/kubernetes/kubernetes/issues/59255)): when creating more than 10 LoadBalancer Services, it's possible to encounter errors due to exceeding the FrontendIPConfiguations Quota (default is 10) causing load balancer creation to fail. In this circumstance, even though load balancer creation has failed, the public IP has been created successfully. However, due to a flaw in the Cloud Provider, the public IP is not deleted even after the Service is deleted.

The fix for this problem ([kubernetes\#59340](https://github.com/kubernetes/kubernetes/pull/59340)) is included in v1.9.4 and v1.10. 

In addition, the issue of exceeding the FrontendIPConfiguations Quota can be resolved by increasing the Quota, refer to [Azure subscription and service limits, quotas, and constraints](https://docs.microsoft.com/en-us/azure/azure-subscription-service-limits).

## MSI cannot be used

After setting `"useManagedIdentityExtension": true`, you can use [Managed Service Identity (MSI)](https://docs.microsoft.com/en-us/azure/active-directory/msi-overview) to manage Azure API authentication and authorization. However, due to a flaw in the Cloud Provider ([kubernetes \#60691](https://github.com/kubernetes/kubernetes/issues/60691) the `useManagedIdentityExtension` yaml label has not been defined, causing the option to be unparseable.

The fix for this issue ([kubernetes\#60775](https://github.com/kubernetes/kubernetes/pull/60775)) will be included in v1.10.

## Excessive Azure ARM API call requests

Sometimes the kube-controller-manager or kubelet may cause Azure ARM API to fail due to making too many requests, for example

```bash
"OperationNotAllowed",\r\n    "message": "The server rejected the request because too many requests have been received for this subscription.
```

This happens especially when creating a Kubernetes cluster or adding Nodes in bulk. Starting from [v1.9.2 and v1.10](https://github.com/kubernetes/kubernetes/issues/58770), Azure cloud provider has added a cache for a series of Azure resources (like VM, VMSS, security group, and route table, etc.), greatly easing this problem.

Generally, if this problem repeats, consider
* Using Azure instance metadata, i.e., setting `"useInstanceMetadata": true` for all Nodes' `/etc/kubernetes/azure.json` and restarting kubelet.
* Increasing the `--route-reconciliation-period` for the kube-controller-manager (