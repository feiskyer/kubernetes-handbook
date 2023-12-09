# Unmasking Errors

The art of untangling issues in Kubernetes clusters and applications primarily involves 

* [Sniffing out irregularities in cluster status](cluster.md)
* [Decoding anomalies in Pod operations](pod.md)
* [Unscrambling network dysfunctions](network.md)
* [Solving persistent storage glitches](pv/)
  * [Untangling AzureDisk issues](pv/azuredisk.md)
  * [Straightening out AzureFile hitches](pv/azurefile.md)
* [Deciphering Windows container hitches](windows.md)
* [Navigating through cloud platform irregularities](cloud/)
  * [Resolving Azure snags](cloud/azure.md)
* [Must-have tools for troubleshooting](tools.md)

With [kube-copilot](https://github.com/feiskyer/kube-copilot) powered by OpenAI, you can automatically diagnose the tribulations encumbering your cluster and interact with the said cluster in natural language.

In the mission of untangling errors, `kubectl` assumes the role of the primary tool, usually serving as the starting point towards identifying mistakes. Following are commands of frequent necessity that are integral to error troubleshooting processes.

### Checking Pod status and running nodes

```bash
kubectl get pods -o wide
kubectl -n kube-system get pods -o wide
```

### Inspect Pod events

```bash
kubectl describe pod <pod-name>
```

### Surveying Node status

```bash
kubectl get nodes
kubectl describe node <node-name>
```

### kube-apiserver logs

```bash
PODNAME=$(kubectl -n kube-system get pod -l component=kube-apiserver -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100
```

The above commands presuppose the control plane functioning in the form of Kubernetes static Pod. If kube-apiserver is governed by systemd, you will have to log into the master node, then use journalctl -u kube-apiserver to review its log.

### kube-controller-manager logs

```bash
PODNAME=$(kubectl -n kube-system get pod -l component=kube-controller-manager -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100
```

Similar to the above, these operations also assume that the control plane is operating in the form of Kubernetes static pod. If the kube-controller-manager is managed by systemd, you will need to log in to the master node, then use journalctl -u kube-controller-manager to review its log.

### kube-scheduler logs

```bash
PODNAME=$(kubectl -n kube-system get pod -l component=kube-scheduler -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100
```

As seen earlier, these operations assume that the control plane is functioning as Kubernetes static Pod. If kube-scheduler is managed by systemd, log into the master node, then use journalctl -u kube-scheduler to access its log.

### kube-dns logs

kube-dns is usually deployed as an Addon, with each Pod encompassing three containers. The most critical log is from the kubedns container:

```bash
PODNAME=$(kubectl -n kube-system get pod -l k8s-app=kube-dns -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME -c kubedns
```

### Kubelet logs

Kubelet is typically managed by systemd. To look at Kubelet logs, begin by SSHing into the Node. It's suggested to use the [kubectl-node-shell](https://github.com/kvaps/kubectl-node-shell) plugin instead of allocating a public IP address for each node. For instance:

```bash
curl -LO https://github.com/kvaps/kubectl-node-shell/raw/master/kubectl-node_shell
chmod +x ./kubectl-node_shell
sudo mv ./kubectl-node_shell /usr/local/bin/kubectl-node_shell

kubectl node-shell <node>
journalctl -l -u kubelet
```

### Kube-proxy logs

Kube-proxy is usually deployed as a DaemonSet, its logs can directly be queried with kubectl

```bash
$ kubectl -n kube-system get pod -l component=kube-proxy
NAME               READY     STATUS    RESTARTS   AGE
kube-proxy-42zpn   1/1       Running   0          1d
kube-proxy-7gd4p   1/1       Running   0          3d
kube-proxy-87dbs   1/1       Running   0          4d
$ kubectl -n kube-system logs kube-proxy-42zpn
```

## Further Reading

* The [hjacobs/kubernetes-failure-stories](https://github.com/hjacobs/kubernetes-failure-stories) collates a montage of public Kubernetes anomaly cases.
* [https://docs.microsoft.com/en-us/azure/aks/troubleshooting](https://docs.microsoft.com/en-us/azure/aks/troubleshooting) shares general insights into troubleshooting AKS.
* [https://cloud.google.com/kubernetes-engine/docs/troubleshooting](https://cloud.google.com/kubernetes-engine/docs/troubleshooting) narrates general strategies for troubleshooting question within GKE.
* [https://www.oreilly.com/ideas/kubernetes-recipes-maintenance-and-troubleshooting](https://www.oreilly.com/ideas/kubernetes-recipes-maintenance-and-troubleshooting).