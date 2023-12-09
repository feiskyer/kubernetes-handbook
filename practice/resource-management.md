# Resource Control

It is recommended to set pod requests and limits for all pods in the YAML manifest:

* **Pod requests** define the amount of CPU and memory needed by the pod. Kubernetes makes node scheduling decisions based on these requests.
* **Pod limits** are the maximum amounts of CPU and memory that a pod is allowed to use, preventing runaway pods from consuming excessive resources.

Without these values, the Kubernetes scheduler won't know how much resources are needed. The scheduler might place pods on nodes that lack sufficient resources, leading to subpar application performance.

Cluster administrators can also set resource quotas for namespaces that require resource requests and limits to be specified.

## Using kube-advisor to Check for Application Issues

You can periodically run the [kube-advisor](https://github.com/Azure/kube-advisor) tool to check for issues with your application configuration.

Example of running kube-advisor:

```bash
$ kubectl apply -f https://github.com/Azure/kube-advisor/raw/master/sa.yaml

$ kubectl run --rm -i -t kube-advisor --image=mcr.microsoft.com/aks/kubeadvisor --restart=Never --overrides="{ \"apiVersion\": \"v1\", \"spec\": { \"serviceAccountName\": \"kube-advisor\" } }"
If you don't see a command prompt, try pressing enter.
+--------------+-------------------------+----------------+-------------+--------------------------------+
|  NAMESPACE   |  POD NAME               | POD CPU/MEMORY | CONTAINER   |             ISSUE              |
+--------------+-------------------------+----------------+-------------+--------------------------------+
| default      | demo-58bcb96b46-9952m   | 0 / 41272Ki    | demo        | CPU Resource Limits Missing    |
+              +                         +                +             +--------------------------------+
|              |                         |                |             | Memory Resource Limits Missing |
+              +                         +                +             +--------------------------------+
|              |                         |                |             | CPU Request Limits Missing     |
+              +                         +                +             +--------------------------------+
|              |                         |                |             | Memory Request Limits Missing  |
+--------------+-------------------------+----------------+-------------+--------------------------------+
```

## Reference Documents

* [https://github.com/Azure/kube-advisor](https://github.com/Azure/kube-advisor)
* [Best practices for application developers to manage resources in Azure Kubernetes Service](https://docs.microsoft.com/en-us/azure/aks/developer-best-practices-resource-management)

---

# Mastering Resource Management

When curating your Kubernetes setup, specifying pod requests and limits in your YAML manifests should be part of your routine:

- **Pod requests** earmark the CPU and memory quantities that a pod needs to function optimally. These specifications are pivotal for Kubernetes when it's time to assign pods to nodes.
- **Pod limits** cap how much CPU and memory a pod can use, a necessary precaution to prevent a single pod from hogging resources and affecting other operations.

A Kubernetes scheduler without these values is like a pilot flying blind - it won't know how to allocate resources efficiently. This can lead to pods being placed on nodes that don't have enough to go around, causing your applications to potentially run slower than a sloth in quicksand.

And for those cluster admins out there, you can set up resource quotas to keep each namespace within their resource means, ensuring that requests and limits are not just suggestions but rules to live by.

## Tackling Application Snags with kube-advisor

Keep your applications in top shape by routinely firing up the [kube-advisor](https://github.com/Azure/kube-advisor) tool. This little helper scouts out configuration issues in your application setup, akin to a detective sniffing out clues.

Get started with kube-advisor in no time:

```bash
$ kubectl apply -f https://github.com/Azure/kube-advisor/raw/master/sa.yaml

$ kubectl run --rm -i - t kube-advisor --image=mcr.microsoft.com/aks/kubeadvisor --restart=Never --overrides="{ \"apiVersion\": \"v1\", \"spec\": { \"serviceAccountName\": \"kube-advisor\" } }"
If you don't see a command prompt, try pressing enter.
+--------------+-------------------------+----------------+-------------+--------------------------------+
| NAMESPACE    | POD NAME                | POD CPU/MEMORY | CONTAINER   | ISSUE                          |
+--------------+-------------------------+----------------+-------------+--------------------------------+
| default      | demo-58bcb96b46-9952m   | 0 / 41272Ki    | demo        | CPU Resource Limits Missing    |
+              +                         +                +             +--------------------------------+
|              |                         |                |             | Memory Resource Limits Missing |
+              +                         +                +             +--------------------------------+
|              |                         |                |             | CPU Request Limits Missing     |
+              +                         +                +             +--------------------------------+
|              |                         |                |             | Memory Request Limits Missing  |
+--------------+-------------------------+----------------+-------------+--------------------------------+
```

You can use this tool to spot and troubleshoot potential issues before they become full-blown performance roadblocks. 

## Handy Reference Documents

Dive deeper into efficient resource management with these resources:

- [Azure's kube-advisor GitHub Repository](https://github.com/Azure/kube-advisor) - Your one-stop shop for the kube-advisor tool.
- [Best Practices for Azure Kubernetes Service Resource Management](https://docs.microsoft.com/en-us/azure/aks/developer-best-practices-resource-management) - Your resource management bible for crafting well-behaved Kubernetes applications on Azure.