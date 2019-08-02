# Azure 云平台排错

## Azure 负载均衡

使用 Azure Cloud Provider 后，Kubernetes 会为 LoadBalancer 类型的 Service 创建 Azure 负载均衡器以及相关的 公网 IP、BackendPool 和 Network Security Group (NSG)。注意目前 Azure Cloud Provider 仅支持 `Basic` SKU 的负载均衡，并将在 v1.11 中支持 Standard SKU。`Basic` 与 `Standard` SKU 负载均衡相比有一定的[局限](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-standard-overview)：

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

同样，对应的 Public IP 也是 Basic SKU，与 Standard SKU 相比也有一定的[局限](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-standard-overview#sku-service-limits-and-abilities)：

| Public IP                    | Basic           | Standard                                 |
| ---------------------------- | --------------- | ---------------------------------------- |
| Availability Zones scenarios | Zonal only      | Zone-redundant (default), zonal (optional) |
| Fast IP Mobility             | Not supported   | Available                                |
| VIP Availability             | Not supported   | Available                                |
| Counters                     | Not supported   | Available                                |
| Network Security Group       | Optional on NIC | Required                                 |

在创建 Service 时，可以通过 `metadata.annotation` 来自定义 Azure 负载均衡的行为，可选的选项包括

| Annotation                               | 功能                                       |
| ---------------------------------------- | ---------------------------------------- |
| service.beta.kubernetes.io/azure-load-balancer-internal | 如果设置，则创建内网负载均衡                           |
| service.beta.kubernetes.io/azure-load-balancer-internal-subnet | 设置内网负载均衡 IP 使用的子网                        |
| service.beta.kubernetes.io/azure-load-balancer-mode | 设置如何为负载均衡选择所属的 AvailabilitySet（之所以有该选项是因为在 Azure 的每个 AvailabilitySet 中只能创建最多一个外网负载均衡和一个内网负载均衡）。可选项为：（1）不设置或者设置为空，使用 `/etc/kubernetes/azure.json` 中设置的 `primaryAvailabilitySet`；（2）设置为 `auto`，选择负载均衡规则最少的 AvailabilitySet；（3）设置为`as1,as2`，指定 AvailabilitySet 列表 |
| service.beta.kubernetes.io/azure-dns-label-name | 设置后为公网 IP 创建 外网 DNS                      |
| service.beta.kubernetes.io/azure-shared-securityrule | 如果设置，则为多个 Service 共享相同的 NSG 规则。注意该选项需要 [Augmented Security Rules](https://docs.microsoft.com/en-us/azure/virtual-network/security-overview#augmented-security-rules) |
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
- Kuberentes v1.8.X 中还有可能出现 `Security rule must specify SourceAddressPrefixes, SourceAddressPrefix, or SourceApplicationSecurityGroups` 的错误，这是由于 Azure Go SDK 的问题导致的，可以通过升级集群到 v1.9.X/v1.10.X 或者将 SourceAddressPrefixes 替换为多条 SourceAddressPrefix 规则来解决

## 负载均衡公网 IP 无法访问

Azure Cloud Provider 会为负载均衡器创建探测器，只有探测正常的服务才可以响应用户的请求。负载均衡公网 IP 无法访问一般是探测失败导致的，可能原因有：

- 后端 VM  本身不正常（可以重启 VM 恢复）
- 后端容器未监听在设置的端口上（可通过配置正确的端口解决）
- 防火墙或网络安全组阻止了要访问的端口（可通过增加安全规则解决）
- 当使用内网负载均衡时，从同一个 ILB 的后端 VM 上访问 ILB VIP 时也会失败，这是 Azure 的[预期行为](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-troubleshoot#cause-4-accessing-the-internal-load-balancer-vip-from-the-participating-load-balancer-backend-pool-vm)（此时可以访问 service 的 clusterIP）
- 后端容器不响应（部分或者全部）外部请求时也会导致负载均衡 IP 无法访问。注意这里包含**部分容器不响应的场景**，这是由于 Azure 探测器与 Kubernetes 服务发现机制共同导致的结果：
  - （1）Azure 探测器定期去访问 service 的端口（即 NodeIP:NodePort）
  - （2）Kubernetes 将其负载均衡到后端容器中
  - （3）当负载均衡到异常容器时，访问失败会导致探测失败，进而 Azure 可能会将 VM 移出负载均衡
  - 该问题的解决方法是使用[健康探针](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-probes/)，保证异常容器自动从服务的后端（endpoints）中删除。

## 内网负载均衡 BackendPool 为空

Kubernetes 1.9.0-1.9.3 中会有这个问题（[kubernetes#59746](https://github.com/kubernetes/kubernetes/issues/59746) [kubernetes#60060](https://github.com/kubernetes/kubernetes/issues/60060) [acs-engine#2151](https://github.com/Azure/acs-engine/issues/2151)），这是由于一个查找负载均衡所属 AvaibilitySet 的缺陷导致的。

该问题的修复（[kubernetes#59747](https://github.com/kubernetes/kubernetes/pull/59747) [kubernetes#59083](https://github.com/kubernetes/kubernetes/pull/59083)）将包含到 v1.9.4 和 v1.10 中。

## 外网负载均衡均衡 BackendPool 为空

在使用不支持 Cloud Provider 的工具（如 kubeadm）部署的集群中，如果未给 Kubelet 配置 `--cloud-provider=azure --cloud-config=/etc/kubernetes/cloud-config`，那么 Kubelet 会以 hostname 将其注册到集群中。此时，查看该 Node 的信息（kubectl get node <node-name> -o yaml），可以发现其 externalID 与 hostname 相同。此时，kube-controller-manager 也无法将其加入到负载均衡的后端中。

一个简单的确认方式是查看 Node 的 externalID 和 name 是否不同：

```sh
$ kubectl get node -o jsonpath='{.items[*].metadata.name}'
k8s-agentpool1-27347916-0
$ kubectl get node -o jsonpath='{.items[*].spec.externalID}'
/subscriptions/<subscription-id>/resourceGroups/<rg-name>/providers/Microsoft.Compute/virtualMachines/k8s-agentpool1-27347916-0
```

该问题的解决方法是先删除 Node `kubectl delete node <node-name>`，为 Kubelet 配置 `--cloud-provider=azure --cloud-config=/etc/kubernetes/cloud-config`，最后再重启 Kubelet。

## Service 删除后 Azure 公网 IP 未自动删除

Kubernetes 1.9.0-1.9.3 中会有这个问题（[kubernetes#59255](https://github.com/kubernetes/kubernetes/issues/59255)）：当创建超过 10 个 LoadBalancer Service 后有可能会碰到由于超过 FrontendIPConfiguations Quota（默认为 10）导致负载均衡无法创建的错误。此时虽然负载均衡无法创建，但公网 IP 已经创建成功了，由于 Cloud Provider 的缺陷导致删除 Service 后公网 IP 却未删除。

该问题的修复（[kubernetes#59340](https://github.com/kubernetes/kubernetes/pull/59340)）将包含到 v1.9.4 和 v1.10 中。

另外，超过 FrontendIPConfiguations Quota 的问题可以参考 [Azure subscription and service limits, quotas, and constraints](https://docs.microsoft.com/en-us/azure/azure-subscription-service-limits) 增加 Quota 来解决。

## MSI 无法使用

配置 `"useManagedIdentityExtension": true` 后，可以使用 [Managed Service Identity (MSI)](https://docs.microsoft.com/en-us/azure/active-directory/msi-overview) 来管理 Azure API 的认证授权。但由于 Cloud Provider 的缺陷（[kubernetes #60691](https://github.com/kubernetes/kubernetes/issues/60691) 未定义 `useManagedIdentityExtension` yaml 标签导致无法解析该选项。

该问题的修复（[kubernetes#60775](https://github.com/kubernetes/kubernetes/pull/60775)）将包含在 v1.10 中。

## Azure ARM API 调用请求过多

有时 kube-controller-manager 或者 kubelet 会因请求调用过多而导致 Azure ARM API 失败的情况，比如

```sh
"OperationNotAllowed",\r\n    "message": "The server rejected the request because too many requests have been received for this subscription.
```

特别是在 Kubernetes 集群创建或者批量增加 Nodes 的时候。从 [v1.9.2 和 v1.10](https://github.com/kubernetes/kubernetes/issues/58770) 开始， Azure cloud provider 为一些列的 Azure 资源（如 VM、VMSS、安全组和路由表等）增加了缓存，大大缓解了这个问题。

一般来说，如果该问题重复出现可以考虑

- 使用 Azure instance metadata，即为所有 Node 的 `/etc/kubernetes/azure.json` 设置 `"useInstanceMetadata": true` 并重启 kubelet
- 为 kube-controller-manager 增大 `--route-reconciliation-period`（默认为 10s），比如在 `/etc/kubernetes/manifests/kube-controller-manager.yaml` 中设置 `--route-reconciliation-period=1m` 后 kubelet 会自动重新创建 kube-controller-manager Pod。

## AKS kubectl logs connection timed out

`kubectl logs` 命令报 `getsockopt: connection timed out` 的错误（[AKS#232](https://github.com/Azure/AKS/issues/232)）：

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

在 AKS 中，kubectl logs, exec, and attach 等命令需要 Master 与 Nodes 节点之间建立隧道连接。在 `kube-system` namespace 中可以看到 `tunnelfront` 和 `kube-svc-redirect` Pod：

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

如果它们不是处于 `Running` 状态或者 Exec/Logs/PortForward 等命令报 `net/http: TLS handshake timeout` 错误，删除 `tunnelfront` Pod，稍等一会就会自动创建新的出来，如：

```
$ kubectl -n kube-system delete po -l component=tunnel
pod "tunnelfront-7644cd56b7-l5jmc" deleted
```

## 使用 Virtual Kubelet 后 LoadBalancer Service 无法分配公网 IP

使用 Virtual Kubelet 后，LoadBalancer Service 可能会一直处于 pending 状态，无法分配 IP 地址。查看该服务的事件（如 `kubectl describe svc）`会发现错误 `CreatingLoadBalancerFailed  4m (x15 over 45m)  service-controller  Error creating load balancer (will retry): failed to ensure load balancer for service default/nginx: ensure(default/nginx): lb(kubernetes) - failed to ensure host in pool: "instance not found"`。这是由于 Virtual Kubelet 创建的虚拟 Node 并不存在于 Azure 云平台中，因而无法将其加入到 Azure Load Balancer 的后端中。

解决方法是开启 ServiceNodeExclusion 特性，即设置 `kube-controller-manager --feature-gates=ServiceNodeExclusion=true`。开启后，所有带有 `alpha.service-controller.kubernetes.io/exclude-balancer` 标签的 Node 都不会加入到云平台负载均衡的后端中。

注意该特性仅适用于 Kubernetes 1.9 及以上版本。

## Node 的 GPU 数总是 0

当在 AKS 集群中运行 GPU 负载时，发现它们无法调度，这可能是由于 Node 容量中的 `nvidia.com/gpu` 总是0。

解决方法是重新部署 nvidia-gpu 设备插件扩展：

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

## Azure ServicePrincipal 过期

默认情况下，Service Principal 的过期时间是 1 年，可以通过以下的命令延长过期时间：

```sh
az ad sp credential reset --name <clientId> --password <clientSecret> --years <newYears>
```

## Node 自动重启

为了保护 AKS 群集，安全更新自动应用于所有的 Linux 节点。 这些更新包括 OS 安全修复项或内核更新，其中的部分更新需要重启节点才能完成。 AKS 不会自动重新启动这些 Linux 节点，但你可以参考[这里](https://docs.microsoft.com/zh-cn/azure/aks/node-updates-kured)配置 [kured](https://github.com/weaveworks/kured) 来自动重启节点。

除此之外，如果你还想收到节点需要重启的通知，可以参考[Dashboard and notifications on AKS for required worker nodes reboots](https://medium.com/@denniszielke/dashboard-and-notifications-on-aks-for-required-worker-nodes-reboots-c883d08e9404) 进行配置。

## 参考文档

* [AKS troubleshooting](https://docs.microsoft.com/en-us/azure/aks/troubleshooting)

- [Azure subscription and service limits, quotas, and constraints](https://docs.microsoft.com/en-us/azure/azure-subscription-service-limits)
- [Virtual Kubelet - Missing Load Balancer IP addresses for services](https://github.com/virtual-kubelet/virtual-kubelet#missing-load-balancer-ip-addresses-for-services)
- [Troubleshoot Azure Load Balancer](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-troubleshoot#cause-4-accessing-the-internal-load-balancer-vip-from-the-participating-load-balancer-backend-pool-vm)
- [Troubleshooting CustomScriptExtension (CSE) and acs-engine](https://github.com/Azure/acs-engine/blob/master/docs/kubernetes/troubleshooting.md)
- [Setting up azure firewall for analysing outgoing traffic in AKS](https://medium.com/@denniszielke/setting-up-azure-firewall-for-analysing-outgoing-traffic-in-aks-55759d188039)
- [Dashboard and notifications on AKS for required worker nodes reboots](https://medium.com/@denniszielke/dashboard-and-notifications-on-aks-for-required-worker-nodes-reboots-c883d08e9404)

