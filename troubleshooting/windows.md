# Troubleshooting Windows containers

This chapter is about Windows containers troubleshooting.

## SSH to Windows Node

When checking Windows container issues, a common step is RDP to nodes and check component status and logs. You could allocate a public IP to the Node or do a port forwarding from router. But a simpler way is via a RDP service (replace with your own node-ip):

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

Then connect to the node via service rdp's external IP, e.g. `mstsc.exe -v 52.52.52.52`.

Don't forget to delete the service after user: `kubectl delete -f rdp.yaml`.

## Windows Pod stuck in ContainerCreating

Besides reasons introduced in [Troubleshooting Pod](pod.md), there are also other causes including:

- the pause image is misconfigured
- the container image is not [compatible with Windows](https://docs.microsoft.com/en-us/virtualization/windowscontainers/deploy-containers/version-compatibility).
  - Containers on Windows Server 1709 should use images with 1709 tags, e.g.
    - `microsoft/aspnet:4.7.2-windowsservercore-1709`
    - `microsoft/windowsservercore:1709`
    - `microsoft/iis:windowsservercore-1709`
  - Containers on Windows Server 1803 should use images with 1803 tags, e.g.
    - `microsoft/aspnet:4.7.2-windowsservercore-1803`
    - `microsoft/windowsservercore:1803`
    - `microsoft/iis:windowsservercore-1803`

## Windows Pod failed to resolve DNS

This is a [known issue](https://github.com/Azure/acs-engine/issues/2027). After Windows Node rebooted, HNS Policy need to be cleaned up (**Should do this for each rebooting**):

```powershell
# On Windows Node
Start-BitsTransfer -Source https://raw.githubusercontent.com/Microsoft/SDN/master/Kubernetes/windows/hns.psm1
Import-Module .\hns.psm1

Stop-Service kubeproxy
Stop-Service kubelet
Get-HnsNetwork | ? Name -eq l2Bridge | Remove-HnsNetwork 
Get-HnsPolicyList | Remove-HnsPolicyList
Start-Service kubelet
Start-Service kubeproxy
```

Even with this, kube-dns clusterIP may be still not working. A workaround is configure kube-dns Pod's IP address to normal Pods, e.g.

```powershell
# In Windows container, e.g. kubectl exec -i -t <pod-name> powershell
$adapter=Get-NetAdapter
Set-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -ServerAddresses 10.244.0.2,10.244.0.3
Set-DnsClient -InterfaceIndex $adapter.ifIndex -ConnectionSpecificSuffix "default.svc.cluster.local"
```

The kube-dns Pod's IP could be got by

```sh
$ kubectl -n kube-system describe endpoints kube-dns
Name:         kube-dns
Namespace:    kube-system
Labels:       k8s-app=kube-dns
              kubernetes.io/cluster-service=true
              kubernetes.io/name=KubeDNS
Annotations:  <none>
Subsets:
  Addresses:          10.244.0.2,10.244.0.3
  NotReadyAddresses:  <none>
  Ports:
    Name     Port  Protocol
    ----     ----  --------
    dns      53    UDP
    dns-tcp  53    TCP

Events:  <none>
```

If your kubernetes cluster is deployed by acs-engine, then [acs-engine#2378](https://github.com/Azure/acs-engine/pull/2378) could help to fix this issue (redeploy the cluster with this patch or change existing files according to it).

If kubernetes cluster is running on Azure and is using [custom VNET](https://github.com/Azure/acs-engine/blob/master/docs/kubernetes/features.md#feat-custom-vnet), then [the VNET should be attached with route table created by provisioning the cluster](https://github.com/Azure/acs-engine/blob/master/docs/custom-vnet.md#post-deployment-attach-cluster-route-table-to-vnet)：

```sh
#!/bin/bash
rt=$(az network route-table list -g acs-custom-vnet -o json | jq -r '.[].id')
az network vnet subnet update -n KubernetesSubnet \
-g acs-custom-vnet \
--vnet-name KubernetesCustomVNET \
--route-table $rt
```

where `KubernetesSubnet` is the name of the vnet subnet, and `KubernetesCustomVNET` is the name of the custom VNET itself.

An example in bash form if the VNET is in a separate ResourceGroup:

```sh
#!/bin/bash
rt=$(az network route-table list -g RESOURCE_GROUP_NAME_KUBE -o json | jq -r '.[].id')
az network vnet subnet update \
-g RESOURCE_GROUP_NAME_VNET \
--route-table $rt \
--ids "/subscriptions/SUBSCRIPTION_ID/resourceGroups/RESOURCE_GROUP_NAME_VNET/providers/Microsoft.Network/VirtualNetworks/KUBERNETES_CUSTOM_VNET/subnets/KUBERNETES_SUBNET"
```

## Remote endpoint creation failed: HNS failed with error: The switch-port was not found

This is an error happened in kube-proxy when provisioning load balancer rules for kubernetes services. [KB4089848](https://support.microsoft.com/en-us/help/4089848/windows-10-update-kb4089848) should be installed to fix this issue:

```powershell
Start-BitsTransfer http://download.windowsupdate.com/d/msdownload/update/software/updt/2018/03/windows10.0-kb4089848-x64_db7c5aad31c520c6983a937c3d53170e84372b11.msu
wusa.exe windows10.0-kb4089848-x64_db7c5aad31c520c6983a937c3d53170e84372b11.msu
Restart-Computer
```

After the Node rebooted, recheck the fix has been installed:

```powershelgl
PS C:\k> Get-HotFix

Source        Description      HotFixID      InstalledBy          InstalledOn
------        -----------      --------      -----------          -----------
27171k8s9000  Update           KB4087256     NT AUTHORITY\SYSTEM  3/22/2018 12:00:00 AM
27171k8s9000  Update           KB4089848     NT AUTHORITY\SYSTEM  4/4/2018 12:00:00 AM
```

If there are still DNS resolve issues, the steps in previous steps should be applied, e.g. restart kubelet/kube-proxy and setup DnsClientServerAddress.

## Windows Pod failed to get ServiceAccount Secret

This is a [known issue](https://github.com/moby/moby/issues/28401) for old Windows releases. The fix has been included in Windows 1803, please follow [here](https://blogs.windows.com/windowsexperience/2018/04/30/how-to-get-the-windows-10-april-2018-update/) to upgrade Windows.

## Windows Pod failed to access Kubernetes API

If you are using a Hyper-V virtual machine, ensure that MAC spoofing is enabled on the network adapter(s).

## Windows node cannot access services clusterIP

This is a known limitation of the current networking stack on Windows. Only pods can refer to the Service ClusterIP.

## References

- [Troubleshooting Kubernetes](https://docs.microsoft.com/en-us/virtualization/windowscontainers/kubernetes/common-problems)
