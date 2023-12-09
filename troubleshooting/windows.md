# Troubleshooting Windows

In this chapter, we'll delve into methods for troubleshooting anomalies in Windows containers.

## RDP Login to Node

When troubleshooting issues with Windows containers, you often need to log into the Windows node using RDP to check the status and logs of kubelet, Docker, HNS, and so forth. When using a cloud platform, you can assign a public IP to the relevant VM. When deploying on a physical machine, access can be obtained through port mapping on the router.

In addition, there's a simpler method: exposing node's port 3389 externally through the Kubernetes Service (be sure to replace with your own node-ip):

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

```bash
$ kubectl create -f rdp.yaml
$ kubectl get svc rdp
NAME      TYPE           CLUSTER-IP    EXTERNAL-IP      PORT(S)        AGE
rdp       LoadBalancer   10.0.99.149   52.52.52.52   3389:32008/TCP   5m
```

Next, you can log into the Node through the external IP of the rdp service, like so: `mstsc.exe -v 52.52.52.52`.

After you're done, don't forget to delete the RDP service `kubectl delete -f rdp.yaml`.

## Windows Pod Stuck in ContainerCreating State

This typically happens for one of two reasons:

* Incorrect pause image configuration
* Container [image version incompatible with Windows system](https://docs.microsoft.com/en-us/virtualization/windowscontainers/deploy-containers/version-compatibility)

On Windows Server 1709, images with 1709 labels should be used, like:

* `microsoft/aspnet:4.7.2-windowsservercore-1709`
* `microsoft/windowsservercore:1709`
* `microsoft/iis:windowsservercore-1709`

While on Windows Server 1803, images with 1803 labels should be used, including:

* `microsoft/aspnet:4.7.2-windowsservercore-1803`
* `microsoft/iis:windowsservercore-1803`
* `microsoft/windowsservercore:1803`

## DNS Cannot Be Resolved Within Windows Pod

This is a [known issue](https://github.com/Azure/acs-engine/issues/2027), and there are three temporary solutions:

1) After Windows restarts, clear HNS Policy and reboot KubeProxy service:

```text
Start-BitsTransfer -Source https://raw.githubusercontent.com/Microsoft/SDN/master/Kubernetes/windows/hns.psm1
Import-Module .\hns.psm1

Stop-Service kubeproxy
Stop-Service kubelet
Get-HnsNetwork | ? Name -eq l2Bridge | Remove-HnsNetwork
Get-HnsPolicyList | Remove-HnsPolicyList
Start-Service kubelet
Start-Service kubeproxy
```

2) Directly configure the kube-dns Pod address for the Pod:

```text
$adapter=Get-NetAdapter
Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -ServerAddresses 10.244.0.4,10.244.0.6
Set-DnsClient -InterfaceIndex $adapter.ifIndex -ConnectionSpecificSuffix "default.svc.cluster.local"
```

3) More simply, [run an extra Pod](https://github.com/Azure/acs-engine/issues/2027#issuecomment-373767442) on each Windows Node—meaning at least two Pods are running on each Node. In this case, DNS resolution also works correctly.

If Windows Node is running on Azure, and [custom VNET](https://github.com/Azure/acs-engine/blob/master/docs/kubernetes/features.md#feat-custom-vnet) was used when deploying Kubernetes, a [route table needs to be added to that VNET](https://github.com/Azure/acs-engine/blob/master/docs/custom-vnet.md#post-deployment-attach-cluster-route-table-to-vnet):

```bash
#!/bin/bash
# KubernetesSubnet is the name of the vnet subnet
# KubernetesCustomVNET is the name of the custom VNET itself
rt=$(az network route-table list -g acs-custom-vnet -o json | jq -r '.[].id')
az network vnet subnet update -n KubernetesSubnet \
-g acs-custom-vnet \
--vnet-name KubernetesCustomVNET \
--route-table $rt
```

When the VNET is in a different ResourceGroup, here's the solution:

```bash
rt=$(az network route-table list -g RESOURCE_GROUP_NAME_KUBE -o json | jq -r '.[].id')
az network vnet subnet update \
-g RESOURCE_GROUP_NAME_VNET \
--route-table $rt \
--ids "/subscriptions/SUBSCRIPTION_ID/resourceGroups/RESOURCE_GROUP_NAME_VNET/providers/Microsoft.Network/VirtualNetworks/KUBERNETES_CUSTOM_VNET/subnets/KUBERNETES_SUBNET"
```

## Remote Endpoint Creation Failed: HNS Failed with Error: The Switch-port Was Not Found

This error occurs when kube-proxy sets up load balancing for a service. To resolve this, install [KB4089848](https://support.microsoft.com/en-us/help/4089848/windows-10-update-kb4089848):

```text
Start-BitsTransfer http://download.windowsupdate.com/d/msdownload/update/software/updt/2018/03/windows10.0-kb4089848-x64_db7c5aad31c520c6983a937c3d53170e84372b11.msu
wusa.exe windows10.0-kb4089848-x64_db7c5aad31c520c6983a937c3d53170e84372b11.msu
Restart-Computer
```

After rebooting, confirm that the update was successful:

```text
PS C:\k> Get-HotFix

Source        Description      HotFixID      InstalledBy          InstalledOn
------        -----------      --------      -----------          -----------
27171k8s9000  Update           KB4087256     NT AUTHORITY\SYSTEM  3/22/2018 12:00:00 AM
27171k8s9000  Update           KB4089848     NT AUTHORITY\SYSTEM  4/4/2018 12:00:00 AM
```

Netx, after updating, if there are still DNS resolution problems, Kubelet and Kube-proxy can be restarted as discussed in the previous section.

## ServiceAccount Secret Cannot Be Accessed Within Windows Pod

This is a [known issue](https://github.com/moby/moby/issues/28401) in older versions of Windows. The problem can be solved by upgrading Windows to 1803, with the upgrade process discussed [here](https://blogs.windows.com/windowsexperience/2018/04/30/how-to-get-the-windows-10-april-2018-update/).

## Kubernetes API Cannot Be Accessed Within Windows Pod

If Hyper-V isolated containers are in use, MAC spoofing needs to be enabled.

## Service ClusterIP Cannot Be Accessed Within Windows Node

This is a known problem with the current Windows network protocol stack. Service ClusterIP can only be accessed within the Pod.

## Kubelet Can't Start

When using Docker 18.03 and Kubelet v1.12.x, Kubelet can't start and returns an error:

```bash
Error response from daemon: client version 1.38 is too new. Maximum supported API version is 1.37
```

The solution is to set the environment variable for the Docker API version on Windows:

```bash
[System.Environment]::SetEnvironmentVariable('DOCKER_API_VERSION', '1.37', [System.EnvironmentVariableTarget]::Machine)
```

## References

* [Kubernetes On Windows - Troubleshooting Kubernetes](https://docs.microsoft.com/en-us/virtualization/windowscontainers/kubernetes/common-problems)
* [Debug Networking issues on Windows](https://github.com/microsoft/SDN/tree/master/Kubernetes/windows/debug)
