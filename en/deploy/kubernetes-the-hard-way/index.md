# Kubernetes The Hard Way

[Kubernetes The Hard Way](https://github.com/kelseyhightower/kubernetes-the-hard-way) provides a step by step guide to bing up a Kubernetes cluster with HA.

> **Note:**
>
> It is not for people looking for a fully automated command to bring up a Kubernetes cluster. If that's you then check out [Google Kubernetes Engine](https://cloud.google.com/kubernetes-engine), or the [Getting Started Guides](https://kubernetes.io/docs/setup/).
>
> Kubernetes The Hard Way is optimized for learning, which means taking the long route to ensure you understand each task required to bootstrap a Kubernetes cluster.


## Target Audience

The target audience for this tutorial is someone planning to support a production Kubernetes cluster and wants to understand how everything fits together.

## Cluster Details

Kubernetes The Hard Way guides you through bootstrapping a highly available Kubernetes cluster with end-to-end encryption between components and RBAC authentication.

* [Kubernetes](https://github.com/kubernetes/kubernetes) 1.9.0
* [cri-containerd Container Runtime](https://github.com/kubernetes-incubator/cri-containerd) 1.0.0-beta.0
* [CNI Container Networking](https://github.com/containernetworking/cni) 0.6.0
* [etcd](https://github.com/coreos/etcd) 3.2.11

## Labs

This tutorial assumes you have access to the [Google Cloud Platform](https://cloud.google.com). While GCP is used for basic infrastructure requirements the lessons learned in this tutorial can be applied to other platforms.

* [Prerequisites](https://github.com/kelseyhightower/kubernetes-the-hard-way/blob/master/docs/01-prerequisites.md)
* [Installing the Client Tools](https://github.com/kelseyhightower/kubernetes-the-hard-way/blob/master/docs/02-client-tools.md)
* [Provisioning Compute Resources](https://github.com/kelseyhightower/kubernetes-the-hard-way/blob/master/docs/03-compute-resources.md)
* [Provisioning the CA and Generating TLS Certificates](https://github.com/kelseyhightower/kubernetes-the-hard-way/blob/master/docs/04-certificate-authority.md)
* [Generating Kubernetes Configuration Files for Authentication](https://github.com/kelseyhightower/kubernetes-the-hard-way/blob/master/docs/05-kubernetes-configuration-files.md)
* [Generating the Data Encryption Config and Key](https://github.com/kelseyhightower/kubernetes-the-hard-way/blob/master/docs/06-data-encryption-keys.md)
* [Bootstrapping the etcd Cluster](https://github.com/kelseyhightower/kubernetes-the-hard-way/blob/master/docs/07-bootstrapping-etcd.md)
* [Bootstrapping the Kubernetes Control Plane](https://github.com/kelseyhightower/kubernetes-the-hard-way/blob/master/docs/08-bootstrapping-kubernetes-controllers.md)
* [Bootstrapping the Kubernetes Worker Nodes](https://github.com/kelseyhightower/kubernetes-the-hard-way/blob/master/docs/09-bootstrapping-kubernetes-workers.md)
* [Configuring kubectl for Remote Access](https://github.com/kelseyhightower/kubernetes-the-hard-way/blob/master/docs/10-configuring-kubectl.md)
* [Provisioning Pod Network Routes](https://github.com/kelseyhightower/kubernetes-the-hard-way/blob/master/docs/11-pod-network-routes.md)
* [Deploying the DNS Cluster Add-on](https://github.com/kelseyhightower/kubernetes-the-hard-way/blob/master/docs/12-dns-addon.md)
* [Smoke Test](https://github.com/kelseyhightower/kubernetes-the-hard-way/blob/master/docs/13-smoke-test.md)
* [Cleaning Up](https://github.com/kelseyhightower/kubernetes-the-hard-way/blob/master/docs/14-cleanup.md)
