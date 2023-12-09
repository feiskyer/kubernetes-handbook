# Inside a Kubernetes Cluster

![](../.gitbook/assets/architecture%20%287%29.png)

At the heart of a Kubernetes cluster, lies a harmonious blend of distributed storage, etcd, control nodes, and service nodes known as Nodes.

* Control nodes are the orchestrators of the cluster, responsible for container scheduling, maintaining resource states, automatic scaling, and rolling updates.
* Service nodes are the workhorses that run containers, managing images and containers, as well as handling service discovery and load balancing within the cluster.
* An etcd cluster holds the entire state of the Kubernetes cluster.

For a more detailed introduction, please refer to [Kubernetes Architecture](../concepts/architecture.md).

## Cluster Federation

Cluster Federation (Federation) extends Kubernetes across multiple availability zones and is realized in conjunction with cloud service providers such as GCE and AWS.

![](../.gitbook/assets/federation%20%284%29.png)

For a more detailed introduction, please refer to [Federation](../concepts/components/federation.md).

## Setting Up a Kubernetes Cluster

You can deploy a Kubernetes cluster by following the [Kubernetes Deployment Guide](../setup/index.md). For beginners or for simple validation tests, the following are easier methods.

### minikube

The easiest way to create a Kubernetes cluster (single-node version) is with [minikube](https://github.com/kubernetes/minikube):

```bash
$ minikube start
Starting local Kubernetes cluster...
Kubectl is now configured to use the cluster.
$ kubectl cluster-info
Kubernetes master is running at https://192.168.64.12:8443
kubernetes-dashboard is running at https://192.168.64.12:8443/api/v1/proxy/namespaces/kube-system/services/kubernetes-dashboard

To further debug and diagnose cluster problems, use 'kubectl cluster-info dump'.
```

### play-with-k8s

[Play with Kubernetes](http://play-with-k8s.com) provides a free Kubernetes learning environment, giving you access to kubeadm to create clusters directly at [http://play-with-k8s.com](http://play-with-k8s.com). Be mindful that each created cluster can only be used for up to 4 hours.

A handy feature of Play with Kubernetes is the automatic display of all NodePort type service ports on the page. Simply clicking on the port allows access to the corresponding service.

For detailed usage, refer to [Play-With-Kubernetes](https://github.com/feiskyer/kubernetes-handbook/tree/549e0e3c9ba0175e64b2d4719b5a46e9016d532b/appendix/play-with-k8s.md).

---

# Discover the World of Kubernetes Clusters

![](../.gitbook/assets/architecture%20%287%29.png)

Delve into the ecosystem of a Kubernetes cluster, an intricate infrastructure comprised of distributed storage with etcd, central command centers known as control nodes, and the workstations called service nodes or nodes.

* **Control nodes** like conductors in an orchestra, they manage the overall operations of the cluster, ensuring containers are aptly scheduled, resources statuses are up to date, scaling is done automatically, and updates roll out seamlessly.
* **Service nodes** are the powerhouse of the cluster, directly hosting and handling containers, busying themselves with the management of images and containers, alongside the pivotal roles of service discovery and load balancing within the 'Kubernetes universe'.
* The **etcd cluster’s** task is momentous, as it meticulously archives the entire state of the Kubernetes cluster.

For a deep dive into this topic, check out the [Kubernetes Architecture](../concepts/architecture.md).

## Expanding Horizons with Cluster Federation

Cluster Federation (Federation) is designed to scale Kubernetes across several availability zones, tightly integrating with cloud service giants like GCE and AWS.

![](../.gitbook/assets/federation%20%284%29.png)

Tackle more on this subject in the [Federation Overview](../concepts/components/federation.md).

## Crafting Your Kubernetes Cluster

Embark on setting up your own Kubernetes cluster via the comprehensive [Kubernetes Deployment Guide](../setup/index.md). If you're just getting your feet wet or simply tinkering for testing purposes, here are some straightforward alternatives:

### minikube

For a breezy introduction to a single-node Kubernetes cluster, [minikube](https://github.com/kubernetes/minikube) is your best bet:

```bash
$ minikube start
Starting local Kubernetes cluster...
Kubectl is now configured to use the cluster.
$ kubectl cluster-info
Kubernetes master is running at https://192.168.64.12:8443
kubernetes-dashboard is running at https://192.168.64.12:8443/api/v1/proxy/namespaces/kube-system/services/kubernetes-dashboard

To further debug and diagnose cluster problems, use 'kubectl cluster-info dump'.
```

### play-with-k8s

For a hands-on, no-cost experience with Kubernetes, [Play with Kubernetes](http://play-with-k8s.com) is the go-to platform. It allows you to dive in using kubeadm to craft clusters right there on [http://play-with-k8s.com](http://play-with-k8s.com), though remember each cluster exists for a fleeting 4 hours maximum.

What's neat about Play with Kubernetes is its intuitive presentation of all NodePort type service ports, just a click away from accessing the services they lead to.

Uncover tips and tricks in the realm of Play with Kubernetes by visiting [Play-With-Kubernetes](https://github.com/feiskyer/kubernetes-handbook/tree/549e0e3c9ba0175e64b2d4719b5a46e9016d532b/appendix/play-with-k8s.md).