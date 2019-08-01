# Windows 容器異常排錯

本章介紹 Windows 容器異常的排錯方法。

## RDP 登錄到 Node

通常在排查 Windows 容器異常問題時需要通過 RDP 登錄到 Windows Node上面查看 kubelet、docker、HNS 等的狀態和日誌。在使用雲平臺時，可以給相應的 VM 綁定一個公網 IP；而在物理機部署時，可以通過路由器上的端口映射來訪問。

除此之外，還有一種更簡單的方法，即通過 Kubernetes Service 對外暴露 Node 的 3389 端口（注意替換為你自己的 node-ip）：

```yaml
# rdp.yaml
apiVersion: v1
kind: Service
metadata:
  name: rdp
spec:
  type: LoadBalancer
  ports:
  - protocol: TCP
    port: 3389
    targetPort: 3389
---
kind: Endpoints
apiVersion: v1
metadata:
  name: rdp
subsets:
  - addresses:
      - ip: <node-ip>
    ports:
      - port: 3389
```

```sh
$ kubectl create -f rdp.yaml
$ kubectl get svc rdp
NAME      TYPE           CLUSTER-IP    EXTERNAL-IP      PORT(S)        AGE
rdp       LoadBalancer   10.0.99.149   52.52.52.52   3389:32008/TCP   5m
```

接著，就可以通過 rdp 服務的外網 IP 來登錄 Node，如 `mstsc.exe -v 52.52.52.52`。

在使用完後， 不要忘記刪除 RDP 服務 `kubectl delete -f rdp.yaml`。

## Windows Pod 一直處於 ContainerCreating 狀態

一般有兩種可能的原因

* Pause 鏡像配置錯誤
* 容器[鏡像版本與 Windows 系統不兼容](https://docs.microsoft.com/en-us/virtualization/windowscontainers/deploy-containers/version-compatibility)



在 Windows Server 1709 上面需要使用 1709 標籤的鏡像，比如

    * `microsoft/aspnet:4.7.2-windowsservercore-1709`
    * `microsoft/windowsservercore:1709`
    * `microsoft/iis:windowsservercore-1709`



在 Windows Server 1803 上面需要使用 1803 標籤的鏡像，比如

    * `microsoft/aspnet:4.7.2-windowsservercore-1803`
    * `microsoft/iis:windowsservercore-1803`
    * `microsoft/windowsservercore:1803`


## Windows Pod 內無法解析 DNS

這是一個[已知問題](https://github.com/Azure/acs-engine/issues/2027)，有以下三種臨時解決方法：

（1）Windows 重啟後，清空 HNS Policy 並重啟 KubeProxy 服務：

```powershell
Start-BitsTransfer -Source https://raw.githubusercontent.com/Microsoft/SDN/master/Kubernetes/windows/hns.psm1
Import-Module .\hns.psm1

Stop-Service kubeproxy
Stop-Service kubelet
Get-HnsNetwork | ? Name -eq l2Bridge | Remove-HnsNetwork
Get-HnsPolicyList | Remove-HnsPolicyList
Start-Service kubelet
Start-Service kubeproxy
```

（2）是為 Pod 直接配置 kube-dns Pod 的地址：

```powershell
$adapter=Get-NetAdapter
Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -ServerAddresses 10.244.0.4,10.244.0.6
Set-DnsClient -InterfaceIndex $adapter.ifIndex -ConnectionSpecificSuffix "default.svc.cluster.local"
```

（3）更簡單的為每個 Windows Node [多運行一個 Pod](https://github.com/Azure/acs-engine/issues/2027#issuecomment-373767442)，即保證每臺 Node 上面至少有兩個 Pod 在運行。此時，DNS 解析也是正常的。

如果 Windows Node 運行在 Azure 上面，並且部署 Kubernetes 時使用了[自定義 VNET](https://github.com/Azure/acs-engine/blob/master/docs/kubernetes/features.md#feat-custom-vnet)，那麼需要[為該 VNET 添加路由表](https://github.com/Azure/acs-engine/blob/master/docs/custom-vnet.md#post-deployment-attach-cluster-route-table-to-vnet)：

```sh
#!/bin/bash
# KubernetesSubnet is the name of the vnet subnet
# KubernetesCustomVNET is the name of the custom VNET itself
rt=$(az network route-table list -g acs-custom-vnet -o json | jq -r '.[].id')
az network vnet subnet update -n KubernetesSubnet \
-g acs-custom-vnet \
--vnet-name KubernetesCustomVNET \
--route-table $rt
```

如果 VNET 在不同的 ResourceGroup 裡面，那麼

```sh
rt=$(az network route-table list -g RESOURCE_GROUP_NAME_KUBE -o json | jq -r '.[].id')
az network vnet subnet update \
-g RESOURCE_GROUP_NAME_VNET \
--route-table $rt \
--ids "/subscriptions/SUBSCRIPTION_ID/resourceGroups/RESOURCE_GROUP_NAME_VNET/providers/Microsoft.Network/VirtualNetworks/KUBERNETES_CUSTOM_VNET/subnets/KUBERNETES_SUBNET"
```

## Remote endpoint creation failed: HNS failed with error: The switch-port was not found

這個錯誤發生在 kube-proxy 為服務配置負載均衡的時候，需要安裝 [KB4089848](https://support.microsoft.com/en-us/help/4089848/windows-10-update-kb4089848)：

```powershell
Start-BitsTransfer http://download.windowsupdate.com/d/msdownload/update/software/updt/2018/03/windows10.0-kb4089848-x64_db7c5aad31c520c6983a937c3d53170e84372b11.msu
wusa.exe windows10.0-kb4089848-x64_db7c5aad31c520c6983a937c3d53170e84372b11.msu
Restart-Computer
```

重啟後確認更新安裝成功：

```powershelgl
PS C:\k> Get-HotFix

Source        Description      HotFixID      InstalledBy          InstalledOn
------        -----------      --------      -----------          -----------
27171k8s9000  Update           KB4087256     NT AUTHORITY\SYSTEM  3/22/2018 12:00:00 AM
27171k8s9000  Update           KB4089848     NT AUTHORITY\SYSTEM  4/4/2018 12:00:00 AM
```

安裝更新後，如果 DNS 解析還是有問題，可以按照上一節中的方法（1） 重啟 kubelet 和 kube-proxy。

## Windows Pod 內無法訪問 ServiceAccount Secret

這是老版本 Windows 的[已知問題](https://github.com/moby/moby/issues/28401)，升級 Windows 到 1803 即可解決，升級步驟見[這裡](https://blogs.windows.com/windowsexperience/2018/04/30/how-to-get-the-windows-10-april-2018-update/)。

## Windows Pod 內無法訪問 Kubernetes API

如果使用了 Hyper-V 隔離容器，需要開啟 MAC spoofing 。

## Windows Node 內無法訪問 Service ClusterIP

這是個當前 Windows 網絡協議棧的已知問題，只有在 Pod 內才可以訪問 Service ClusterIP。

## Kubelet 無法啟動

使用 Docker 18.03 版本和 Kubelet v1.12.x 時，Kubelet 無法正常啟動報錯：

```sh
Error response from daemon: client version 1.38 is too new. Maximum supported API version is 1.37
```

解決方法是為 Windows 上面的 Docker 設置 API 版本的環境變量：

```powershell
[System.Environment]::SetEnvironmentVariable('DOCKER_API_VERSION', '1.37', [System.EnvironmentVariableTarget]::Machine)
```

## 參考文檔

- [Kubernetes On Windows - Troubleshooting Kubernetes](https://docs.microsoft.com/en-us/virtualization/windowscontainers/kubernetes/common-problems)
- [Debug Networking issues on Windows](https://github.com/microsoft/SDN/tree/master/Kubernetes/windows/debug)

