# Large-Scale Clusters

Kubernetes v1.6 and above can support a single cluster of up to 5000 nodes. This means the latest stable version of Kubernetes can accommodate:

* Up to 5000 nodes
* Up to 150000 Pods
* Up to 300000 containers
* No more than 100 Pods per Node

## Public Cloud Quotas

For Kubernetes clusters hosted on public clouds, it's quite common to run into quota issues as the scale increases. It's necessary to request higher quotas from the cloud platform in advance. The quotas that may need to be increased include:

* Number of virtual machines
* Number of vCPUs
* Number of private IP addresses
* Number of public IP addresses
* Number of security group entries
* Number of route table entries
* Size of persistent storage

### Etcd Storage

In addition to the standard [Etcd high availability cluster](https://coreos.com/etcd/docs/3.2.15/op-guide/clustering.html) configuration and using SSD for storage, a separate Etcd cluster for Events is also needed. That is, deploy two separate Etcd clusters and configure kube-apiserver with:

```bash
--etcd-servers="http://etcd1:2379,http://etcd2:2379,http://etcd3:2379" \
--etcd-servers-overrides="/events#http://etcd4:2379,http://etcd5:2379,http://etcd6:2379"
```

Additionally, the default Etcd storage limit is 2GB, which can be increased with the `--quota-backend-bytes` option.

## Master Node Size

For sizing master nodes, one can refer to AWS's configuration:

* 1-5 nodes: m3.medium
* 6-10 nodes: m3.large
* 11-100 nodes: m3.xlarge
* 101-250 nodes: m3.2xlarge
* 251-500 nodes: c4.4xlarge
* More than 500 nodes: c4.8xlarge

## Allocating More Resources for Scaling

Scaling within a Kubernetes cluster also requires allocating more resources, including assigning more CPU and memory for the Pods, and increasing the number of container replicas. When the Node's own capacity is too small, it's also necessary to increase the CPU and memory of the Node itself (especially in public cloud platforms).

The following add-on services need more CPU and memory:

* [DNS (kube-dns or CoreDNS)](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/dns)
* [Kibana](http://releases.k8s.io/master/cluster/addons/fluentd-elasticsearch/kibana-deployment.yaml)
* [FluentD with ElasticSearch Plugin](http://releases.k8s.io/master/cluster/addons/fluentd-elasticsearch/fluentd-es-ds.yaml)
* [FluentD with GCP Plugin](http://releases.k8s.io/master/cluster/addons/fluentd-gcp/fluentd-gcp-ds.yaml)

The following add-on services need to increase their replica count:

* [elasticsearch](http://releases.k8s.io/master/cluster/addons/fluentd-elasticsearch/es-statefulset.yaml)
* [DNS (kube-dns or CoreDNS)](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/dns)

Moreover, to ensure multiple replicas are scheduled across different Nodes, configure [AntiAffinity](https://kubernetes.io/docs/concepts/configuration/assign-pod-node/#affinity-and-anti-affinity) for the containers. For instance, for kube-dns, you can add the following configuration:

```yaml
affinity:
 podAntiAffinity:
   requiredDuringSchedulingIgnoredDuringExecution:
   - weight: 100
     labelSelector:
       matchExpressions:
       - key: k8s-app
         operator: In
         values:
         - kube-dns
     topologyKey: kubernetes.io/hostname
```

## Kube-apiserver Configuration

* Set `--max-requests-inflight=3000`
* Set `--max-mutating-requests-inflight=1000`

## Kube-scheduler Configuration

* Set `--kube-api-qps=100`

## Kube-controller-manager Configuration

* Set `--kube-api-qps=100`
* Set `--kube-api-burst=100`

## Kubelet Configuration

* Set `--image-pull-progress-deadline=30m`
* Set `--serialize-image-pulls=false` (requires Docker to use overlay2)
* Maximum number of Pods allowed on a single Kubelet node: `--max-pods=110` (the default is 110 but can be set according to actual needs)

## Docker Configuration

* Set `max-concurrent-downloads=10`
* Use SSD for storage `graph=/ssd-storage-path`
* Preload the pause image, e.g., `docker image save -o /opt/preloaded_docker_images.tar` and `docker image load -i /opt/preloaded_docker_images.tar`

## Node Configuration

Increase kernel option settings in `/etc/sysctl.conf`:

```bash
fs.file-max=1000000

net.ipv4.ip_forward=1
net.netfilter.nf_conntrack_max=10485760
net.netfilter.nf_conntrack_tcp_timeout_established=300
net.netfilter.nf_conntrack_buckets=655360
net.core.netdev_max_backlog=10000

net.ipv4.neigh.default.gc_thresh1=1024
net.ipv4.neigh.default.gc_thresh2=4096
net.ipv4.neigh.default.gc_thresh3=8192

net.netfilter.nf_conntrack_max=10485760
net.netfilter.nf_conntrack_tcp_timeout_established=300
net.netfilter.nf_conntrack_buckets=655360
net.core.netdev_max_backlog=10000

fs.inotify.max_user_instances=524288
fs.inotify.max_user_watches=524288
```

## Application Configuration

When running Pods, it's also important to follow some best practices such as:

* Setting resource requests and limits for containers
  * `spec.containers[].resources.limits.cpu`
  * `spec.containers[].resources.limits.memory`
  * `spec.containers[].resources.requests.cpu`
  * `spec.containers[].resources.requests.memory`
  * `spec.containers[].resources.limits.ephemeral-storage`
  * `spec.containers[].resources.requests.ephemeral-storage`
* Protecting critical applications with PodDisruptionBudget, nodeAffinity, podAffinity, and podAntiAffinity.
* Preferably managing containers with controllers (such as Deployment, StatefulSet, DaemonSet, Job, etc.).
* Enable [Watch Bookmarks](https://kubernetes.io/docs/reference/using-api/api-concepts/#watch-bookmarks) to optimize Watch performance (1.17 GA), clients can add `allowWatchBookmarks=true` to Watch requests to enable this feature.
* Reduce image sizes, use P2P for image distribution, pre-cache popular images.
* More content can be found [here](../setup/kubernetes-configuration-best-practice.md).

## Necessary Add-ons

Monitoring, alerting, and visualization tools like Prometheus and Grafana are vital. It's recommended to deploy and enable them.

* [How to Scale a Single Prometheus to Monitor Tens of Thousands of Kubernetes Clusters](https://mp.weixin.qq.com/s/DBJ0F3g2Y5EhS02D7k2n5w)

## Reference Documents

* [Building Large Clusters](https://kubernetes.io/docs/setup/best-practices/cluster-large/)
* [Scaling Kubernetes to 2,500 Nodes](https://blog.openai.com/scaling-kubernetes-to-2500-nodes/)
* [Scaling Kubernetes for 25M users](https://medium.com/@brendanrius/scaling-kubernetes-for-25m-users-a7937e3536a0)
* [How Does Alibaba Ensure the Performance of System Components in a 10,000-node Kubernetes Cluster](https://www.alibabacloud.com/blog/how-does-alibaba-ensure-the-performance-of-system-components-in-a-10000-node-kubernetes-cluster_595469)
* [Architecting Kubernetes clusters — choosing a cluster size](https://itnext.io/architecting-kubernetes-clusters-choosing-a-cluster-size-92f6feaa2908)
* [Bayer Crop Science seeds the future with 15000-node GKE clusters](https://cloud.google.com/blog/products/containers-kubernetes/google-kubernetes-engine-clusters-can-have-up-to-15000-nodes)