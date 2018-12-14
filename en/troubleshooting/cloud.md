# Troubleshooting Cloud Provider

This chapter is about troubleshooting kubernetes clusters on public clouds (AWS, Azure, GCE etc).

For those clusters, kubernetes is usually configured with cloud provider. e.g. on Azure

```sh
--cloud-config=/etc/kubernetes/azure.json --cloud-provider=azure
```

It may be configured by cloud's managed kubernetes service (e.g. GKE, AKS or EKS). Or it may be configured directly on VM, which gains much more flexibility.

## Overview

An incomplete list of things that could go wrong include:

- **AuthorizationFailure**, e.g. not authorized to operate network routes or persistent volumes. This failure could be easily found in kube-controller-manager or cloud-controller-manager logs.
- **Network routes not configured**. Normally, cloud provider will configure a network route for each nodes registered. If the configuration is wrong or not able to finish (e.g. quota limits), then pod connections will be abnormal.
- **Public IP not allocated for LoadBalancer Service**.
- **Security group rules error**, e.g. new rules couldn't be added (because of quota ) or conflicting with other rules.
- **Persistent volume not able to allocate or attach to VM**, e.g.
  - PV may not be able to allocate if exceeding quota
  - Most PVs doesn't allow to mount on multiple VMs
- **Network plugin configure error**. Network plugin may be configured with protocol not allowed by the cloud, e.g. Azure doesn't allow GRE and ipip in VM.

## Node not list in kubernetes

Node is usually registered when Kubelet starts first time. And it will be shown in the kubernetes nodes list, e.g. by `kubectl get nodes`. If the node is not shown, then there should be something wrong with kubelet or kube-controller-manager.

### Looking at kubelet logs

If kubelet can't initialize the node (e.g. can't get node's IP or providerID), then reasons could be got from kubelet logs.

SSH to the Node and check kubelet logs with `journalctl` command:

```sh
journalctl -l -u kubelet
```

### Looking at kube-controller-manager logs

kube-controller-manager will create routes for the node in cloud provider, if route creation failed, then the node may be removed from kubernetes. Such errors could be got from kube-controller-manager logs:

```sh
PODNAME=$(kubectl -n kube-system get pod -l component=kube-controller-manager -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100
```
