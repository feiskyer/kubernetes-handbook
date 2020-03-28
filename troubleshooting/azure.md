# Troubleshooting Azure Cloud Provider

## Azure Load Balancer (ALB)

When Azure cloud provider is configured (`kube-controller-manager --cloud-provider=azure --cloud-config=/etc/kubernetes/azure.json`), Azure load balancer (ALB) will be created automatically for `LoadBalancer` typed Service. Please note that only `Basic` SKU ALB is supported now, which has some [limitations](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-standard-overview) compared to `Standard` ALB:

| Load Balancer                     | Basic                                    | Standard                                 |
| --------------------------------- | ---------------------------------------- | ---------------------------------------- |
| Back-end pool size                | up to 100                                | up to 1,000                              |
| Back-end pool boundary            | Availability Set                         | virtual network, region                  |
| Back-end pool design              | VMs in Availability Set, virtual machine scale set in Availability Set | Any VM instance in the virtual network   |
| HA Ports                          | Not supported                            | Available                                |
| Diagnostics                       | Limited, public only                     | Available                                |
| VIP Availability                  | Not supported                            | Available                                |
| Fast IP Mobility                  | Not supported                            | Available                                |
| Availability Zones scenarios      | Zonal only                               | Zonal, Zone-redundant, Cross-zone load-balancing |
| Outbound SNAT algorithm           | On-demand                                | Preallocated                             |
| Outbound SNAT front-end selection | Not configurable, multiple candidates    | Optional configuration to reduce candidates |
| Network Security Group            | Optional on NIC/subnet                   | Required                                 |

Public IP associated is Basic SKU, which has some [limitations](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-standard-overview#sku-service-limits-and-abilities) compared to `Standard` Public IP:

| Public IP                    | Basic           | Standard                                 |
| ---------------------------- | --------------- | ---------------------------------------- |
| Availability Zones scenarios | Zonal only      | Zone-redundant (default), zonal (optional) |
| Fast IP Mobility             | Not supported   | Available                                |
| VIP Availability             | Not supported   | Available                                |
| Counters                     | Not supported   | Available                                |
| Network Security Group       | Optional on NIC | Required                                 |

## LoadBalancer SKUs

Azure cloud provider supports both `basic` and `standard` SKU load balancers, which can be set via `loadBalancerSku` option in [cloud config file](cloud-provider-config.md). A list of differences between these two SKUs can be found [here](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-standard-overview#why-use-standard-load-balancer).

> Note that the public IPs used in load balancer frontend configurations should be the same SKU. That is a standard SKU public IP for standard load balancer and a basic SKU public IP for a basic load balancer.

Azure doesn’t support a network interface joining load balancers with different SKUs, hence migration dynamically between them is not supported.

> If you do require migration, please delete all services with type `LoadBalancer` (or change to other type)

### Outbound connectivity

[Outbound connectivity](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-outbound-connections
) is also different between the two load balancer SKUs:

* For the basic SKU, the outbound connectivity is opened by default. If multiple frontends are set, then the outbound IP is selected randomly (and configurable) from them.

* For the standard SKU, the outbound connectivity is disabled by default. There are two ways to open the outbound connectivity: use a standard public IP with the standard load balancer or define outbound rules.

### Standard LoadBalancer

Because the load balancer in a Kubernetes cluster is managed by the Azure cloud provider and it may change dynamically (e.g. the public load balancer would be deleted if no services defined with type `LoadBalancer`), [outbound rules](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-outbound-rules-overview) are the recommended path if you want to ensure the outbound connectivity for all nodes.

> Especially note:
>
> * In the context of outbound connectivity, a single standalone VM, all the VM's in an Availability Set, all the instances in a VMSS behave as a group. This means, if a single VM in an Availability Set is associated with a Standard SKU, all VM instances within this Availability Set now behave by the same rules as if they are associated with Standard SKU, even if an individual instance is not directly associated with it.
>
> * Public IP's used as instance-level public IP are mutually exclusive with outbound rules.

Here is the recommend way to define the [outbound rules](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-outbound-rules-overview) when using separate provisioning tools:

* Create a separate IP (or multiple IPs for scale) in standard SKU for outbound rules. Make use of the [allocatedOutboundPorts](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-outbound-rules-overview#snatports) parameter to allocate sufficient ports for your desired scenario scale.
* Create a separate pool definition for outbound, and ensure all virtual machines or VMSS virtual machines are in this pool. Azure cloud provider will manage the load balancer rules with another pool, so that provisioning tools and the Azure cloud provider won't affect each other.
* Define inbound with load balancing rules and inbound NAT rules as needed, and set `disableOutboundSNAT` to true on the load balancing rule(s).  Don't rely on the side effect from these rules for outbound connectivity. It makes it messier than it needs to be and limits your options.  Use inbound NAT rules to create port forwarding mappings for SSH access to the VM's rather than burning public IPs per instance.

## Service Annotations

When creating LoadBalancer Service, a set of annotations could be set to customize ALB:

| Annotation | Value | Description | Kubernetes Version |
| ------------------------------------------------------------ | ---------------------------- | ------------------------------------------------------------ |------|
| `service.beta.kubernetes.io/azure-load-balancer-internal`    | `true` or `false`            | Specify whether the load balancer should be internal. It’s defaulting to public if not set. | v1.10.0 and later |
| `service.beta.kubernetes.io/azure-load-balancer-internal-subnet` | Name of the subnet           | Specify which subnet the internal load balancer should be bound to. It’s defaulting to the subnet configured in cloud config file if not set. | v1.10.0 and later |
| `service.beta.kubernetes.io/azure-load-balancer-mode`        | `auto`, `{name1},{name2}`    | Specify the Azure load balancer selection algorithm based on availability sets. There are currently three possible load balancer selection modes : default, auto or "{name1}, {name2}". This is only working for basic LB (see below for how it works) |  v1.10.0 and later |
| `service.beta.kubernetes.io/azure-dns-label-name`            | Name of the DNS label        | Specify the DNS label name for the service. If it is set to empty string, DNS in PIP would be deleted. Because of a bug, before v1.15.10/v1.16.7/v1.17.3, the DNS label on PIP would also be deleted if the annotation is not specified. | v1.15.0 and later |
| `service.beta.kubernetes.io/azure-shared-securityrule`       | `true` or `false`            | Specify that the service should be exposed using an Azure security rule that may be shared with another service, trading specificity of rules for an increase in the number of services that can be exposed. This relies on the Azure "augmented security rules" feature. | v1.10.0 and later |
| `service.beta.kubernetes.io/azure-load-balancer-resource-group` | Name of the resource group   | Specify the resource group of load balancer objects that are not in the same resource group as the cluster. | v1.10.0 and later |
| `service.beta.kubernetes.io/azure-allowed-service-tags`      | List of allowed service tags | Specify a list of allowed [service tags](https://docs.microsoft.com/en-us/azure/virtual-network/security-overview#service-tags) separated by comma. | v1.11.0 and later |
| `service.beta.kubernetes.io/azure-load-balancer-tcp-idle-timeout` | TCP idle timeouts in minutes | Specify the time, in minutes, for TCP connection idle timeouts to occur on the load balancer. Default and minimum value is 4. Maximum value is 30. Must be an integer. |  v1.11.4, v1.12.0 and later |
|`service.beta.kubernetes.io/azure-load-balancer-disable-tcp-reset`|`true`|Disable `enableTcpReset` for SLB|v1.16 or later|
|`service.beta.kubernetes.io/azure-pip-name`|Name of PIP|Specify the PIP that will be applied to load balancer|v1.16-v1.18. The annotation has been deprecated and would be removed in a future release.|

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
- There is also a NSG issue in Kubernetes v1.8.X: `Security rule must specify SourceAddressPrefixes, SourceAddressPrefix, or SourceApplicationSecurityGroups`. To get rid of this issue, you could either upgrade cluster to v1.9.X/v1.10.X or replace SourceAddressPrefixes rule with multiple SourceAddressPrefix rules.

## Service external IP is not accessible

Azure Cloud Provider creates a health probe for each Kubernetes services and only probe-successful backend VMs are added to Azure Load Balancer (ALB). If the external IP is not accessible, it's probably caused by health probing.

An incomplete list of such cases include:

- Backend VMs in unhealthy (Solution: login the VM and check, or restart VM)
- Containers are not listening on configured ports (Solution: correct container port configuration)
- Firewall or network security groups block the port on ALB (Solution: add a new rule to expose the port)
- If an ILB VIP is configured inside a VNet, and one of the participant backend VMs is trying to access the Internal Load Balancer VIP, that results in failure. This is an [unsupported scenario](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-troubleshoot#cause-4-accessing-the-internal-load-balancer-vip-from-the-participating-load-balancer-backend-pool-vm). (Solution: use service's clusterIP instead)
- Some or all containers are not responding any accesses. Note that only part of containers not responding could result in service not accessible, this is because
  - Azure probes service periodically by `NodeIP:NodePort`
  - Then, on the Node, kube-proxy load balances it to backend containers
  - And then, if it load balances the access to abnormal containers, then probe is failed and the Node VM may be removed from ALB traffic backends
  - Finally, ALB may think all backends are unhealthy
  - The solution is use [Readiness Probles](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-probes/), which could ensure the unhealthy containers removed from service's endpoints

## No target backends present for the internal load balancer (ILB)

This is a known bug ([kubernetes#59746](https://github.com/kubernetes/kubernetes/issues/59746) [kubernetes#60060](https://github.com/kubernetes/kubernetes/issues/60060) [acs-engine#2151](https://github.com/Azure/acs-engine/issues/2151)) in kubernetes v1.9.0-v1.9.3, which is caused by an error when matching ILB's AvaibilitySet.

The fix of this issue ([kubernetes#59747](https://github.com/kubernetes/kubernetes/pull/59747) [kubernetes#59083](https://github.com/kubernetes/kubernetes/pull/59083)) will be included in v1.9.4+ and v1.10+.

## No target backends present for the external load balancer

If kubelet is not configured with cloud provider (e.g. no `--cloud-provider=azure --cloud-config=/etc/kubernetes/cloud-config` configured), then the node will not join any Azure load balancers. This is because the node registers itself with externalID hostname, which is not recognized by kube-controller-manager.

A simple way to check is comparing externalID and name (they should be different):

```sh
$ kubectl get node -o jsonpath='{.items[*].metadata.name}'
k8s-agentpool1-27347916-0
$ kubectl get node -o jsonpath='{.items[*].spec.externalID}'
/subscriptions/<subscription-id>/resourceGroups/<rg-name>/providers/Microsoft.Compute/virtualMachines/k8s-agentpool1-27347916-0
```

To fix this issue

- Delete the node object `kubectl delete node <node-name>`
- Set Kubelet with options `--cloud-provider=azure --cloud-config=/etc/kubernetes/cloud-config`
- Finally restart kubelet

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

## AKS kubectl logs/exec connection timed out

`kubectl logs` reports `getsockopt: connection timed out` error ([AKS#232](https://github.com/Azure/AKS/issues/232)):

```sh
$ kubectl --v=8 logs x
I0308 10:32:21.539580   26486 round_trippers.go:417] curl -k -v -XGET  -H "Accept: application/json, */*" -H "User-Agent: kubectl/v1.8.1 (linux/amd64) kubernetes/f38e43b" -H "Authorization: Bearer x" https://x:443/api/v1/namespaces/default/pods/x/log?container=x
I0308 10:34:32.790295   26486 round_trippers.go:436] GET https://X:443/api/v1/namespaces/default/pods/x/log?container=x 500 Internal Server Error in 131250 milliseconds
I0308 10:34:32.790356   26486 round_trippers.go:442] Response Headers:
I0308 10:34:32.790376   26486 round_trippers.go:445]     Content-Type: application/json
I0308 10:34:32.790390   26486 round_trippers.go:445]     Content-Length: 275
I0308 10:34:32.790414   26486 round_trippers.go:445]     Date: Thu, 08 Mar 2018 09:34:32 GMT
I0308 10:34:32.790504   26486 request.go:836] Response Body: {"kind":"Status","apiVersion":"v1","metadata":{},"status":"Failure","message":"Get https://aks-nodepool1-53392281-1:10250/containerLogs/default/x: dial tcp 10.240.0.6:10250: getsockopt: connection timed out","code":500}
I0308 10:34:32.790999   26486 helpers.go:207] server response object: [{
  "metadata": {},
  "status": "Failure",
  "message": "Get https://aks-nodepool1-53392281-1:10250/containerLogs/default/x/x: dial tcp 10.240.0.6:10250: getsockopt: connection timed out",
  "code": 500
}]
F0308 10:34:32.791043   26486 helpers.go:120] Error from server: Get https://aks-nodepool1-53392281-1:10250/containerLogs/default/x/x: dial tcp 10.240.0.6:10250: getsockopt: connection timed out
```

In AKS, kubectl logs, exec, and attach all require the master <-> node tunnels to be established. Check that the `tunnelfront` and `kube-svc-redirect` pods are up and running:

```
$ kubectl -n kube-system get po -l component=tunnel
NAME                           READY     STATUS    RESTARTS   AGE
tunnelfront-7644cd56b7-l5jmc   1/1       Running   0          2d

$ kubectl -n kube-system get po -l component=kube-svc-redirect
NAME                      READY     STATUS    RESTARTS   AGE
kube-svc-redirect-pq6kf   1/1       Running   0          2d
kube-svc-redirect-x6sq5   1/1       Running   0          2d
kube-svc-redirect-zjl7x   1/1       Running   1          2d
```

If the pods are not running or `net/http: TLS handshake timeout` error occurred, delete `tunnelfront` pod and wait a while, a new pod will be recreated after a few seconds:

```
$ kubectl -n kube-system delete po -l component=tunnel
pod "tunnelfront-7644cd56b7-l5jmc" deleted
```

## LoadBalancer Service stuck in Pending after Virtual Kubelet deployed

After [Virtual Kubelet](https://github.com/virtual-kubelet/virtual-kubelet) deployed, LoadBalancer Service may stuck in Pending state and public IP can't be allocated. Check the service's events (e.g. by `kubectl describe service <service-name>`), you could find the error `CreatingLoadBalancerFailed  4m (x15 over 45m)  service-controller  Error creating load balancer (will retry): failed to ensure load balancer for service default/nginx: ensure(default/nginx): lb(kubernetes) - failed to ensure host in pool: "instance not found"`. This is because the virtual Node created by Virtual Kubelet is not actually exist on Azure cloud platform, so it couldn't be added to the backends of Azure Load Balancer.

Kubernetes 1.9 introduces a new flag, `ServiceNodeExclusion`, for the control plane's Controller Manager. Enabling this flag in the Controller Manager's manifest ( `kube-controller-manager --feature-gates=ServiceNodeExclusion=true`) allows Kubernetes to exclude Virtual Kubelet nodes (with label `alpha.service-controller.kubernetes.io/exclude-balancer`) from being added to Load Balancer pools, allowing you to create public facing services with external IPs without issue.

## No GPU is found in Node's capacity

This may happen when deploying GPU workloads. Node's capacity `nvidia.com/gpu` is always zero. This is caused by something wrong in device plugin. The workaround is redeploy the nvidia-gpu add-on:

```yaml
apiVersion: extensions/v1beta1
kind: DaemonSet
metadata:
  labels:
    kubernetes.io/cluster-service: "true"
  name: nvidia-device-plugin
  namespace: kube-system
spec:
  template:
    metadata:
      # Mark this pod as a critical add-on; when enabled, the critical add-on scheduler
      # reserves resources for critical add-on pods so that they can be rescheduled after
      # a failure.  This annotation works in tandem with the toleration below.
      annotations:
        scheduler.alpha.kubernetes.io/critical-pod: ""
      labels:
        name: nvidia-device-plugin-ds
    spec:
      tolerations:
      # Allow this pod to be rescheduled while the node is in "critical add-ons only" mode.
      # This, along with the annotation above marks this pod as a critical add-on.
      - key: CriticalAddonsOnly
        operator: Exists
      containers:
      - image: nvidia/k8s-device-plugin:1.10
        name: nvidia-device-plugin-ctr
        securityContext:
          allowPrivilegeEscalation: false
          capabilities:
            drop: ["ALL"]
        volumeMounts:
          - name: device-plugin
            mountPath: /var/lib/kubelet/device-plugins
      volumes:
        - name: device-plugin
          hostPath:
            path: /var/lib/kubelet/device-plugins
      nodeSelector:
        beta.kubernetes.io/os: linux
        accelerator: nvidia
```

## Outstanding issues and fixed versions

1. Azure LoadBalancer would lose backends when the nodes are upgraded to latest model 

    * Upstream issue: https://github.com/kubernetes/kubernetes/issues/80365 and https://github.com/kubernetes/kubernetes/issues/89336
    * Fixed versions for basic LoadBalancer: v1.14.7, v1.15.4, v1.16.0 and above
    * Fixed versions for standard LoadBalancer: v1.15.12, v1.16.9, v1.17.5, v1.18.1 and above (WIP on PRs, not released yet)

2. Public IP dns label will be default deleted when there is no service dns annotation

    * Upstream issue: https://github.com/kubernetes/kubernetes/issues/87127
    * Influenced versions: v1.17.0-v1.17.2, v1.16.0-v1.16.6, v1.15.7-v1.15.9, v1.14.10
    * Fixed versions: v1.15.10, v1.16.7, v1.17.3, v1.18.0 and above

3. Azure route table conflicted updating because of concurrent API calls

    * Upstream issue: https://github.com/kubernetes/kubernetes/issues/88151
    * Fixed versions: v1.15.11, v1.16.8, v1.17.4, v1.18.0 and above

4. Azure VMSS instance conflicted updating for LoadBalancer backedn address pools

    * Upstream issue: https://github.com/kubernetes/kubernetes/pull/88094
    * Fixed versions: v1.15.11, v1.16.8, v1.17.4, v1.18.0 and above
    * Performance improvements only in v1.18.0: https://github.com/kubernetes/kubernetes/pull/88699

5. Azure: Many invalid VMSS update calls due to incorrect VMSS cache

    * Upstream issue: https://github.com/kubernetes/kubernetes/issues/89025
    * Influenced versions: v1.15.8-v1.15.11, v1.16.5-v1.16.8, v1.17.1-v1.17.4
    * Fixed versions: v1.15.12, v1.16.9, v1.17.5, v1.18.0 and above (PR merged, not released yet)

## References

- [Azure subscription and service limits, quotas, and constraints](https://docs.microsoft.com/en-us/azure/azure-subscription-service-limits)
- [Virtual Kubelet - Missing Load Balancer IP addresses for services](https://github.com/virtual-kubelet/virtual-kubelet#missing-load-balancer-ip-addresses-for-services)
- [Troubleshoot Azure Load Balancer](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-troubleshoot#cause-4-accessing-the-internal-load-balancer-vip-from-the-participating-load-balancer-backend-pool-vm)
- [Troubleshooting CustomScriptExtension (CSE) and acs-engine](https://github.com/Azure/acs-engine/blob/master/docs/kubernetes/troubleshooting.md)
