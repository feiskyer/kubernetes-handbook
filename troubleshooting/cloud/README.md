# Troubleshooting in the Cloud

In this chapter, we'll take a look at some of the common issues you might run into when running Kubernetes in a public cloud, not to mention how to troubleshoot them.

Running Kubernetes on a public cloud platform generally involves using the managed Kubernetes services provided by the cloud platform. Names you might recognize are Google's GKE, Microsoft Azure's AKS, or AWS's Amazon EKS. Of course, there's always the option to deploy Kubernetes directly on the virtual machines (VMs) within these public cloud platforms if you're after more flexibility. Whichever way you go, you'll usually need to configure a Cloud Provider option for Kubernetes. This just makes it easier for you to take advantage of the advanced networking, persistent storage, and security controls offered by these platforms.

But here are some of the common issues you might experience when running Kubernetes in the cloud:

* Authentication and authorization issues: For instance, the authentication method configured in Kubernetes Cloud Provider might not have the rights to operate the network or persistent storage where the VM is located. You can usually spot this issue by checking the logs of the kube-controller-manager.
* Failed network routing configurations: Ideally, the Cloud Provider should configure a PodCIDR-to-NodeIP routing rule for each Node. If those rules are problematic, it could lead to connectivity issues between the Pods situated on different hosts.
* Problems with public IP allocation: For example, your LoadBalancer type Service might not be able to allocate a public IP or use a pre-assigned public IP. Like most things, this is usually due to a configuration error.
* Security group configuration failures: This could be issues creating a security group for Service (maybe you've exceeded your quota or perhaps there's a conflict with an existing security group).
* Issues with persistent storage allocation or mounting: For instance, assigning a Persistent Volume (PV) might fail (like if you've exceeded your quota or you've made a configuration error) or mounting might fail when trying to mount it to a VM (like if the PV is already in use by abnormal Pods and therefore cannot be unmounted from the old VM).
* Misuse of network plugins: For example, the network plugin might be using a network protocol that's not supported by the cloud platform.

## Node Not Registered in the Cluster

Usually, when Kubelet starts it'll automatically register itself in the Kubernetes API, and then you can query this Node using the `kubectl get nodes` command. If your new Node hasn't auto-registered into the Kubernetes cluster, this means there's been an error in the registration process, and you need to examine the logs of kubelet and kube-controller-manager to identify the exact reason.

### Kubelet Logs

To inspect the Kubelet logs, you need to first SSH into the Node. Then you can run the `journalctl` command to view the kubelet logs:

```bash
journalctl -l -u kubelet
```

### kube-controller-manager Logs

Our mighty kube-controller-manager auto-creates a route for each Node in the cloud platform. If this fails, it might also prevent the Node from registering correctly.

```bash
PODNAME=$(kubectl -n kube-system get pod -l component=kube-controller-manager -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100
```
