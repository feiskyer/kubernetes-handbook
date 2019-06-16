# Windows 容器异常排错

本章介绍 Windows 容器异常的排错方法。

## RDP 登录到 Node

通常在排查 Windows 容器异常问题时需要通过 RDP 登录到 Windows Node上面查看 kubelet、docker、HNS 等的状态和日志。在使用云平台时，可以给相应的 VM 绑定一个公网 IP；而在物理机部署时，可以通过路由器上的端口映射来访问。

除此之外，还有一种更简单的方法，即通过 Kubernetes Service 对外暴露 Node 的 3389 端口（注意替换为你自己的 node-ip）：

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

接着，就可以通过 rdp 服务的外网 IP 来登录 Node，如 `mstsc.exe -v 52.52.52.52`。

在使用完后， 不要忘记删除 RDP 服务 `kubectl delete -f rdp.yaml`。

## Windows Pod 一直处于 ContainerCreating 状态

一般有两种可能的原因

* Pause 镜像配置错误
* 容器[镜像版本与 Windows 系统不兼容](https://docs.microsoft.com/en-us/virtualization/windowscontainers/deploy-containers/version-compatibility)



在 Windows Server 1709 上面需要使用 1709 标签的镜像，比如

    * `microsoft/aspnet:4.7.2-windowsservercore-1709`
    * `microsoft/windowsservercore:1709`
    * `microsoft/iis:windowsservercore-1709`



在 Windows Server 1803 上面需要使用 1803 标签的镜像，比如

    * `microsoft/aspnet:4.7.2-windowsservercore-1803`
    * `microsoft/iis:windowsservercore-1803`
    * `microsoft/windowsservercore:1803`


## Windows Pod 内无法解析 DNS

这是一个[已知问题](https://github.com/Azure/acs-engine/issues/2027)，有以下三种临时解决方法：

（1）Windows 重启后，清空 HNS Policy 并重启 KubeProxy 服务：

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

（2）是为 Pod 直接配置 kube-dns Pod 的地址：

```powershell
$adapter=Get-NetAdapter
Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -ServerAddresses 10.244.0.4,10.244.0.6
Set-DnsClient -InterfaceIndex $adapter.ifIndex -ConnectionSpecificSuffix "default.svc.cluster.local"
```

（3）更简单的为每个 Windows Node [多运行一个 Pod](https://github.com/Azure/acs-engine/issues/2027#issuecomment-373767442)，即保证每台 Node 上面至少有两个 Pod 在运行。此时，DNS 解析也是正常的。

如果 Windows Node 运行在 Azure 上面，并且部署 Kubernetes 时使用了[自定义 VNET](https://github.com/Azure/acs-engine/blob/master/docs/kubernetes/features.md#feat-custom-vnet)，那么需要[为该 VNET 添加路由表](https://github.com/Azure/acs-engine/blob/master/docs/custom-vnet.md#post-deployment-attach-cluster-route-table-to-vnet)：

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

如果 VNET 在不同的 ResourceGroup 里面，那么

```sh
rt=$(az network route-table list -g RESOURCE_GROUP_NAME_KUBE -o json | jq -r '.[].id')
az network vnet subnet update \
-g RESOURCE_GROUP_NAME_VNET \
--route-table $rt \
--ids "/subscriptions/SUBSCRIPTION_ID/resourceGroups/RESOURCE_GROUP_NAME_VNET/providers/Microsoft.Network/VirtualNetworks/KUBERNETES_CUSTOM_VNET/subnets/KUBERNETES_SUBNET"
```

## Remote endpoint creation failed: HNS failed with error: The switch-port was not found

这个错误发生在 kube-proxy 为服务配置负载均衡的时候，需要安装 [KB4089848](https://support.microsoft.com/en-us/help/4089848/windows-10-update-kb4089848)：

```powershell
Start-BitsTransfer http://download.windowsupdate.com/d/msdownload/update/software/updt/2018/03/windows10.0-kb4089848-x64_db7c5aad31c520c6983a937c3d53170e84372b11.msu
wusa.exe windows10.0-kb4089848-x64_db7c5aad31c520c6983a937c3d53170e84372b11.msu
Restart-Computer
```

重启后确认更新安装成功：

```powershelgl
PS C:\k> Get-HotFix

Source        Description      HotFixID      InstalledBy          InstalledOn
------        -----------      --------      -----------          -----------
27171k8s9000  Update           KB4087256     NT AUTHORITY\SYSTEM  3/22/2018 12:00:00 AM
27171k8s9000  Update           KB4089848     NT AUTHORITY\SYSTEM  4/4/2018 12:00:00 AM
```

安装更新后，如果 DNS 解析还是有问题，可以按照上一节中的方法（1） 重启 kubelet 和 kube-proxy。

## Windows Pod 内无法访问 ServiceAccount Secret

这是老版本 Windows 的[已知问题](https://github.com/moby/moby/issues/28401)，升级 Windows 到 1803 即可解决，升级步骤见[这里](https://blogs.windows.com/windowsexperience/2018/04/30/how-to-get-the-windows-10-april-2018-update/)。

## Windows Pod 内无法访问 Kubernetes API

如果使用了 Hyper-V 隔离容器，需要开启 MAC spoofing 。

## Windows Node 内无法访问 Service ClusterIP

这是个当前 Windows 网络协议栈的已知问题，只有在 Pod 内才可以访问 Service ClusterIP。

## Kubelet 无法启动

使用 Docker 18.03 版本和 Kubelet v1.12.x 时，Kubelet 无法正常启动报错：

```sh
Error response from daemon: client version 1.38 is too new. Maximum supported API version is 1.37
```

解决方法是为 Windows 上面的 Docker 设置 API 版本的环境变量：

```powershell
[System.Environment]::SetEnvironmentVariable('DOCKER_API_VERSION', '1.37', [System.EnvironmentVariableTarget]::Machine)
```

## 参考文档

- [Kubernetes On Windows - Troubleshooting Kubernetes](https://docs.microsoft.com/en-us/virtualization/windowscontainers/kubernetes/common-problems)
- [Debug Networking issues on Windows](https://github.com/microsoft/SDN/tree/master/Kubernetes/windows/debug)

