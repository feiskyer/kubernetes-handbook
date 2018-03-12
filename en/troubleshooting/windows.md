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
- the container image is not [compatible with Windows](https://docs.microsoft.com/en-us/virtualization/windowscontainers/deploy-containers/version-compatibility). Note that containers on Windows Server 1709 should use images with 1709 tags, e.g.
  - `microsoft/aspnet:4.7.1-windowsservercore-1709`
  - `microsoft/windowsservercore:1709`
  - `microsoft/iis:windowsservercore-1709

## Windows Pod failed to resolve DNS

This is a [known issue](https://github.com/Azure/acs-engine/issues/2027). A workaround is configure kube-dns Pod's IP address to normal Pods, e.g.

```powershell
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

## Windows Pod failed to get ServiceAccount Secret

This is also a [known issue](https://github.com/moby/moby/issues/28401). There is no workaround for current windows yet, but its fix has been released in Windows 10 Insider and Windows Server Insider builds 17074+.

## Windows Pod failed to access Kubernetes API

If you are using a Hyper-V virtual machine, ensure that MAC spoofing is enabled on the network adapter(s).

## Windows node cannot access services clusterIP

This is a known limitation of the current networking stack on Windows. Only pods can refer to the Service ClusterIP.

## References

- [Troubleshooting Kubernetes](https://docs.microsoft.com/en-us/virtualization/windowscontainers/kubernetes/common-problems)
