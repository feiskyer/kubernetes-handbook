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
* 容器[镜像版本与 Windows 系统不兼容](https://docs.microsoft.com/en-us/virtualization/windowscontainers/deploy-containers/version-compatibility)。注意在 Windows Server 1709 上面需要使用 1709 标签的镜像，比如
  * `microsoft/aspnet:4.7.1-windowsservercore-1709`
  * `microsoft/windowsservercore:1709`
  * `microsoft/iis:windowsservercore-1709`

## Windows Pod 内无法解析 DNS

这是一个[已知问题](https://github.com/Azure/acs-engine/issues/2027)。在 Windows 重启后，需要清空 HNS Policy 并重启 KubeProxy 服务（每次重启都需要）：

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

临时解决方法是为 Pod 直接配置 kube-dns Pod 的地址：

```powershell
$adapter=Get-NetAdapter
Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -ServerAddresses 10.244.0.2,10.244.0.3
Set-DnsClient -InterfaceIndex $adapter.ifIndex -ConnectionSpecificSuffix "default.svc.cluster.local"
```

或者更简单的为每个 Windows Node [多运行一个 Pod](https://github.com/Azure/acs-engine/issues/2027#issuecomment-373767442)，即保证每台 Node 上面至少有两个 Pod 在运行。此时，DNS 解析也是正常的。

如果 Kubernetes 集群是基于 acs-engine 部署的，那么 [acs-engine#2378](https://github.com/Azure/acs-engine/pull/2378) 可以修复这个问题（重新部署 Kubernetes 集群或者根据这个 PR 修改已部署集群的相关文件）。

## Windows Pod 内无法访问 ServiceAccount Secret

这是个[已知问题](https://github.com/moby/moby/issues/28401)，需要等 Windows Update。针对该问题的修复已经包含在 Windows 10 Insider 和 Windows Server Insider builds 17074+ 内。

## Windows Pod 内无法访问 Kubernetes API

如果使用了 Hyper-V 隔离容器，需要开启 MAC spoofing 。

## Windows Node 内无法访问 Service ClusterIP

这是个当前 Windows 网络协议栈的已知问题，只有在 Pod 内才可以访问 Service ClusterIP。

## 参考文档

- [Kubernetes On Windows - Troubleshooting Kubernetes](https://docs.microsoft.com/en-us/virtualization/windowscontainers/kubernetes/common-problems)