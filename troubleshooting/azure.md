# Azure 雲平臺排錯

## Azure 負載均衡

使用 Azure Cloud Provider 後，Kubernetes 會為 LoadBalancer 類型的 Service 創建 Azure 負載均衡器以及相關的 公網 IP、BackendPool 和 Network Security Group (NSG)。注意目前 Azure Cloud Provider 僅支持 `Basic` SKU 的負載均衡，並將在 v1.11 中支持 Standard SKU。`Basic` 與 `Standard` SKU 負載均衡相比有一定的[侷限](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-standard-overview)：

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

同樣，對應的 Public IP 也是 Basic SKU，與 Standard SKU 相比也有一定的[侷限](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-standard-overview#sku-service-limits-and-abilities)：

| Public IP                    | Basic           | Standard                                 |
| ---------------------------- | --------------- | ---------------------------------------- |
| Availability Zones scenarios | Zonal only      | Zone-redundant (default), zonal (optional) |
| Fast IP Mobility             | Not supported   | Available                                |
| VIP Availability             | Not supported   | Available                                |
| Counters                     | Not supported   | Available                                |
| Network Security Group       | Optional on NIC | Required                                 |

在創建 Service 時，可以通過 `metadata.annotation` 來自定義 Azure 負載均衡的行為，可選的選項包括

| Annotation                               | 功能                                       |
| ---------------------------------------- | ---------------------------------------- |
| service.beta.kubernetes.io/azure-load-balancer-internal | 如果設置，則創建內網負載均衡                           |
| service.beta.kubernetes.io/azure-load-balancer-internal-subnet | 設置內網負載均衡 IP 使用的子網                        |
| service.beta.kubernetes.io/azure-load-balancer-mode | 設置如何為負載均衡選擇所屬的 AvailabilitySet（之所以有該選項是因為在 Azure 的每個 AvailabilitySet 中只能創建最多一個外網負載均衡和一個內網負載均衡）。可選項為：（1）不設置或者設置為空，使用 `/etc/kubernetes/azure.json` 中設置的 `primaryAvailabilitySet`；（2）設置為 `auto`，選擇負載均衡規則最少的 AvailabilitySet；（3）設置為`as1,as2`，指定 AvailabilitySet 列表 |
| service.beta.kubernetes.io/azure-dns-label-name | 設置後為公網 IP 創建 外網 DNS                      |
| service.beta.kubernetes.io/azure-shared-securityrule | 如果設置，則為多個 Service 共享相同的 NSG 規則。注意該選項需要 [Augmented Security Rules](https://docs.microsoft.com/en-us/azure/virtual-network/security-overview#augmented-security-rules) |
| service.beta.kubernetes.io/azure-load-balancer-resource-group | 當為 Service 指定公網 IP 並且該公網 IP 與 Kubernetes 集群不在同一個 Resource Group 時，需要使用該 Annotation 指定公網 IP 所在的 Resource Group |

在 Kubernetes 中，負載均衡的創建邏輯都在 kube-controller-manager 中，因而排查負載均衡相關的問題時，除了查看 Service 自身的狀態，如

```sh
kubectl describe service <service-name>
```

還需要查看 kube-controller-manager 是否有異常發生：

```
PODNAME=$(kubectl -n kube-system get pod -l component=kube-controller-manager -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100
```

## LoadBalancer Service 一直處於 pending 狀態

查看 Service `kubectl describe service <service-name>` 沒有錯誤信息，但 EXTERNAL-IP 一直是 `<pending>`，說明 Azure Cloud Provider 在創建 LB/NSG/PublicIP 過程中出錯。一般按照前面的步驟查看 kube-controller-manager 可以查到具體失敗的原因，可能的因素包括

- clientId、clientSecret、tenandId 或 subscriptionId 配置錯誤導致 Azure API 認證失敗：更新所有節點的 `/etc/kubernetes/azure.json` ，修復錯誤的配置即可恢復服務
- 配置的客戶端無權管理 LB/NSG/PublicIP/VM：可以為使用的 clientId 增加授權或創建新的 `az ad sp create-for-rbac --role="Contributor" --scopes="/subscriptions/<subscriptionID>/resourceGroups/<resourceGroupName>"`
- Kuberentes v1.8.X 中還有可能出現 `Security rule must specify SourceAddressPrefixes, SourceAddressPrefix, or SourceApplicationSecurityGroups` 的錯誤，這是由於 Azure Go SDK 的問題導致的，可以通過升級集群到 v1.9.X/v1.10.X 或者將 SourceAddressPrefixes 替換為多條 SourceAddressPrefix 規則來解決

## 負載均衡公網 IP 無法訪問

Azure Cloud Provider 會為負載均衡器創建探測器，只有探測正常的服務才可以響應用戶的請求。負載均衡公網 IP 無法訪問一般是探測失敗導致的，可能原因有：

- 後端 VM  本身不正常（可以重啟 VM 恢復）
- 後端容器未監聽在設置的端口上（可通過配置正確的端口解決）
- 防火牆或網絡安全組阻止了要訪問的端口（可通過增加安全規則解決）
- 當使用內網負載均衡時，從同一個 ILB 的後端 VM 上訪問 ILB VIP 時也會失敗，這是 Azure 的[預期行為](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-troubleshoot#cause-4-accessing-the-internal-load-balancer-vip-from-the-participating-load-balancer-backend-pool-vm)（此時可以訪問 service 的 clusterIP）
- 後端容器不響應（部分或者全部）外部請求時也會導致負載均衡 IP 無法訪問。注意這裡包含**部分容器不響應的場景**，這是由於 Azure 探測器與 Kubernetes 服務發現機制共同導致的結果：
  - （1）Azure 探測器定期去訪問 service 的端口（即 NodeIP:NodePort）
  - （2）Kubernetes 將其負載均衡到後端容器中
  - （3）當負載均衡到異常容器時，訪問失敗會導致探測失敗，進而 Azure 可能會將 VM 移出負載均衡
  - 該問題的解決方法是使用[健康探針](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-probes/)，保證異常容器自動從服務的後端（endpoints）中刪除。

## 內網負載均衡 BackendPool 為空

Kubernetes 1.9.0-1.9.3 中會有這個問題（[kubernetes#59746](https://github.com/kubernetes/kubernetes/issues/59746) [kubernetes#60060](https://github.com/kubernetes/kubernetes/issues/60060) [acs-engine#2151](https://github.com/Azure/acs-engine/issues/2151)），這是由於一個查找負載均衡所屬 AvaibilitySet 的缺陷導致的。

該問題的修復（[kubernetes#59747](https://github.com/kubernetes/kubernetes/pull/59747) [kubernetes#59083](https://github.com/kubernetes/kubernetes/pull/59083)）將包含到 v1.9.4 和 v1.10 中。

## 外網負載均衡均衡 BackendPool 為空

在使用不支持 Cloud Provider 的工具（如 kubeadm）部署的集群中，如果未給 Kubelet 配置 `--cloud-provider=azure --cloud-config=/etc/kubernetes/cloud-config`，那麼 Kubelet 會以 hostname 將其註冊到集群中。此時，查看該 Node 的信息（kubectl get node <node-name> -o yaml），可以發現其 externalID 與 hostname 相同。此時，kube-controller-manager 也無法將其加入到負載均衡的後端中。

一個簡單的確認方式是查看 Node 的 externalID 和 name 是否不同：

```sh
$ kubectl get node -o jsonpath='{.items[*].metadata.name}'
k8s-agentpool1-27347916-0
$ kubectl get node -o jsonpath='{.items[*].spec.externalID}'
/subscriptions/<subscription-id>/resourceGroups/<rg-name>/providers/Microsoft.Compute/virtualMachines/k8s-agentpool1-27347916-0
```

該問題的解決方法是先刪除 Node `kubectl delete node <node-name>`，為 Kubelet 配置 `--cloud-provider=azure --cloud-config=/etc/kubernetes/cloud-config`，最後再重啟 Kubelet。

## Service 刪除後 Azure 公網 IP 未自動刪除

Kubernetes 1.9.0-1.9.3 中會有這個問題（[kubernetes#59255](https://github.com/kubernetes/kubernetes/issues/59255)）：當創建超過 10 個 LoadBalancer Service 後有可能會碰到由於超過 FrontendIPConfiguations Quota（默認為 10）導致負載均衡無法創建的錯誤。此時雖然負載均衡無法創建，但公網 IP 已經創建成功了，由於 Cloud Provider 的缺陷導致刪除 Service 後公網 IP 卻未刪除。

該問題的修復（[kubernetes#59340](https://github.com/kubernetes/kubernetes/pull/59340)）將包含到 v1.9.4 和 v1.10 中。

另外，超過 FrontendIPConfiguations Quota 的問題可以參考 [Azure subscription and service limits, quotas, and constraints](https://docs.microsoft.com/en-us/azure/azure-subscription-service-limits) 增加 Quota 來解決。

## MSI 無法使用

配置 `"useManagedIdentityExtension": true` 後，可以使用 [Managed Service Identity (MSI)](https://docs.microsoft.com/en-us/azure/active-directory/msi-overview) 來管理 Azure API 的認證授權。但由於 Cloud Provider 的缺陷（[kubernetes #60691](https://github.com/kubernetes/kubernetes/issues/60691) 未定義 `useManagedIdentityExtension` yaml 標籤導致無法解析該選項。

該問題的修復（[kubernetes#60775](https://github.com/kubernetes/kubernetes/pull/60775)）將包含在 v1.10 中。

## Azure ARM API 調用請求過多

有時 kube-controller-manager 或者 kubelet 會因請求調用過多而導致 Azure ARM API 失敗的情況，比如

```sh
"OperationNotAllowed",\r\n    "message": "The server rejected the request because too many requests have been received for this subscription.
```

特別是在 Kubernetes 集群創建或者批量增加 Nodes 的時候。從 [v1.9.2 和 v1.10](https://github.com/kubernetes/kubernetes/issues/58770) 開始， Azure cloud provider 為一些列的 Azure 資源（如 VM、VMSS、安全組和路由表等）增加了緩存，大大緩解了這個問題。

一般來說，如果該問題重複出現可以考慮

- 使用 Azure instance metadata，即為所有 Node 的 `/etc/kubernetes/azure.json` 設置 `"useInstanceMetadata": true` 並重啟 kubelet
- 為 kube-controller-manager 增大 `--route-reconciliation-period`（默認為 10s），比如在 `/etc/kubernetes/manifests/kube-controller-manager.yaml` 中設置 `--route-reconciliation-period=1m` 後 kubelet 會自動重新創建 kube-controller-manager Pod。

## AKS kubectl logs connection timed out

`kubectl logs` 命令報 `getsockopt: connection timed out` 的錯誤（[AKS#232](https://github.com/Azure/AKS/issues/232)）：

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

在 AKS 中，kubectl logs, exec, and attach 等命令需要 Master 與 Nodes 節點之間建立隧道連接。在 `kube-system` namespace 中可以看到 `tunnelfront` 和 `kube-svc-redirect` Pod：

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

如果它們不是處於 `Running` 狀態或者 Exec/Logs/PortForward 等命令報 `net/http: TLS handshake timeout` 錯誤，刪除 `tunnelfront` Pod，稍等一會就會自動創建新的出來，如：

```
$ kubectl -n kube-system delete po -l component=tunnel
pod "tunnelfront-7644cd56b7-l5jmc" deleted
```

## 使用 Virtual Kubelet 後 LoadBalancer Service 無法分配公網 IP

使用 Virtual Kubelet 後，LoadBalancer Service 可能會一直處於 pending 狀態，無法分配 IP 地址。查看該服務的事件（如 `kubectl describe svc）`會發現錯誤 `CreatingLoadBalancerFailed  4m (x15 over 45m)  service-controller  Error creating load balancer (will retry): failed to ensure load balancer for service default/nginx: ensure(default/nginx): lb(kubernetes) - failed to ensure host in pool: "instance not found"`。這是由於 Virtual Kubelet 創建的虛擬 Node 並不存在於 Azure 雲平臺中，因而無法將其加入到 Azure Load Balancer 的後端中。

解決方法是開啟 ServiceNodeExclusion 特性，即設置 `kube-controller-manager --feature-gates=ServiceNodeExclusion=true`。開啟後，所有帶有 `alpha.service-controller.kubernetes.io/exclude-balancer` 標籤的 Node 都不會加入到雲平臺負載均衡的後端中。

注意該特性僅適用於 Kubernetes 1.9 及以上版本。

## Node 的 GPU 數總是 0

當在 AKS 集群中運行 GPU 負載時，發現它們無法調度，這可能是由於 Node 容量中的 `nvidia.com/gpu` 總是0。

解決方法是重新部署 nvidia-gpu 設備插件擴展：

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

## Azure ServicePrincipal 過期

默認情況下，Service Principal 的過期時間是 1 年，可以通過以下的命令延長過期時間：

```sh
az ad sp credential reset --name <clientId> --password <clientSecret> --years <newYears>
```

## 參考文檔

* [AKS troubleshooting](https://docs.microsoft.com/en-us/azure/aks/troubleshooting)

- [Azure subscription and service limits, quotas, and constraints](https://docs.microsoft.com/en-us/azure/azure-subscription-service-limits)
- [Virtual Kubelet - Missing Load Balancer IP addresses for services](https://github.com/virtual-kubelet/virtual-kubelet#missing-load-balancer-ip-addresses-for-services)
- [Troubleshoot Azure Load Balancer](https://docs.microsoft.com/en-us/azure/load-balancer/load-balancer-troubleshoot#cause-4-accessing-the-internal-load-balancer-vip-from-the-participating-load-balancer-backend-pool-vm)
- [Troubleshooting CustomScriptExtension (CSE) and acs-engine](https://github.com/Azure/acs-engine/blob/master/docs/kubernetes/troubleshooting.md)

