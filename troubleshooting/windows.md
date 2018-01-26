# Windows 容器异常排错

本章介绍 Windows 容器异常的排错方法。

### Windows Pod 一直处于 ContainerCreating 状态

一般有两种可能的原因

* Pause 镜像配置错误
* 容器[镜像版本与 Windows 系统不兼容](https://docs.microsoft.com/en-us/virtualization/windowscontainers/deploy-containers/version-compatibility)。注意在 Windows Server 1709 上面需要使用 1709 标签的镜像，比如
  * `microsoft/aspnet:4.7.1-windowsservercore-1709`
  * `microsoft/windowsservercore:1709`
  * `microsoft/iis:windowsservercore-1709`

### Windows Pod 内无法解析 DNS

这是一个[已知问题](https://github.com/Azure/acs-engine/issues/2027)，临时解决方法是为 Pod 直接配置 kube-dns Pod 的地址：

```powershell
$adapter=Get-NetAdapter
Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -ServerAddresses 10.244.0.2,10.244.0.3
Set-DnsClient -InterfaceIndex $adapter.ifIndex -ConnectionSpecificSuffix "default.svc.cluster.local"
```

### Windows Pod 内无法访问 ServiceAccount Secret

这是个[已知问题](https://github.com/moby/moby/issues/28401)，需要等 Windows Update。针对该问题的修复已经包含在 Windows 10 Insider 和 Windows Server Insider builds 17074+ 内。

### Windows Pod 内无法访问 Kubernetes API

如果使用了 Hyper-V 隔离容器，需要开启 MAC spoofing 。

###  Windows Node 内无法访问 Service ClusterIP

这是个当前 Windows 网络协议栈的已知问题，只有在 Pod 内才可以访问 Service ClusterIP。

## 参考文档

- [Troubleshooting Kubernetes](https://docs.microsoft.com/en-us/virtualization/windowscontainers/kubernetes/common-problems)