# Deployment Guide

This chapter provides a handy guide for deploying Kubernetes clusters, installing the kubectl client, and recommended configurations.

The [Kubernetes-The-Hard-Way](k8s-hard-way/) guide provides detailed steps to deploy a highly available Kubernetes cluster in Ubuntu virtual machines in Google Cloud Engine (GCE). These steps are also suitable for other operating systems like CentOS, and other public cloud platforms such as AWS and Azure.

When deploying a cluster within China, it's common to encounter difficulties in pulling images or experiencing slow pull speeds. A solution to this problem is to use domestic images. You can refer to the [domestic image list](../appendix/mirrors.md) for options.

Generally speaking, after the deployment, you need to run a series of tests to verify the deployment's success. [Sonobuoy](https://github.com/heptio/sonobuoy) can simplify this validation process by running a series of tests to ensure your cluster is functioning correctly. Its usage methods are:

- Online use via the [Sonobuoy Scanner tool](https://scanner.heptio.com/) (which requires the cluster to be publicly accessible)
- Or use it as a command line tool.

```bash
# Install
$ go get -u -v github.com/heptio/sonobuoy

# Run
$ sonobuoy run
$ sonobuoy status
$ sonobuoy logs
$ sonobuoy retrieve .

# Cleanup
$ sonobuoy delete
```

## Version Dependencies

| Dependencies | v1.13 | v1.12 |
| :--- | :--- | :--- |
...
*Remaining table contents omitted for brevity*

## Deployment Methods

* [1. Single Machine Deployment](single.md)
* [2. Cluster Deployment](cluster/)
  * [kubeadm](cluster/kubeadm.md)
  * [kops](cluster/kops.md)
  * [Kubespray](cluster/kubespray.md)
  * [Azure](cluster/azure.md)
  * [Windows](cluster/windows.md)
  * [LinuxKit](cluster/k8s-linuxkit.md)
  * [Frakti](../extension/cri/frakti.md)
  * [kubeasz](https://github.com/gjmzj/kubeasz)
* [3. kubectl Client](kubectl.md)
* [4. Additional Components](addon-list/)
  * [Addon-manager](addon-list/addon-manager.md)
  * [DNS]()
  * [Dashboard](addon-list/dashboard.md)
  * [Monitoring](addon-list/monitor.md)
  * [Logging](addon-list/logging.md)
  * [Metrics](addon-list/metrics.md)
  * [GPU]()
  * [Cluster Autoscaler](addon-list/cluster-autoscaler.md)
  * [ip-masq-agent](addon-list/ip-masq-agent.md)
  * [Heapster \(retired\)](https://github.com/kubernetes-retired/heapster)
* [5. Recommended Configurations](kubernetes-configuration-best-practice.md)
* [6. Version Support](upgrade.md)
