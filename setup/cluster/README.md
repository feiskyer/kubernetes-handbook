# The Art of Cluster Deployment

## The Architecture of a Kubernetes Cluster

![cluster](../../.gitbook/assets/ha%20%283%29.png)

### The etcd Cluster

After obtaining a token from `https://discovery.etcd.io/new?size=3`, place `etcd.yaml` on each machine's `/etc/kubernetes/manifests/etcd.yaml` and replace `${DISCOVERY_TOKEN}`, `${NODE_NAME}`, and `${NODE_IP}`. With this, the kubelet can initiate an etcd cluster.

For an etcd running outside the kubelet, refer to the [etcd cluster guide](https://etcd.io/docs/v3.5/op-guide/clustering/) for manually setting the cluster mode.

### The kube-apiserver

Place `kube-apiserver.yaml` on each Master node's `/etc/kubernetes/manifests/`, and put related configurations into `/srv/kubernetes/`. This lets kubelet automatically create and launch the apiserver, which requires:

* basic\_auth.csv - basic authentication username and password
* ca.crt - Certificate Authority cert
* known\_tokens.csv - tokens that specific entities (like the kubelet) can use to communicate with the apiserver
* kubecfg.crt - Client certificate, public key
* kubecfg.key - Client certificate, private key
* server.cert - Server certificate, public key
* server.key - Server certificate, private key

After launching the apiserver, load balancing is crucial. This can be achieved via the elastic load balance service of cloud platforms or configuring master nodes with haproxy/lvs/nginx.

Moreover, tools like Keepalived, OSPF, Pacemaker, etc., can ensure high availability of load balance nodes.

Note:

* For large-scale clusters, increase `--max-requests-inflight` (default at 400)
* When using nginx, increase `proxy_timeout: 10m`

### Controller Manager and Scheduler

It's important to ensure that at any given moment, only a single instance of both the controller manager and scheduler is running. This requires a leader election process, so include `--leader-elect=true` at startup, such as:

```text
kube-scheduler --master=127.0.0.1:8080 --v=2 --leader-elect=true
kube-controller-manager --master=127.0.0.1:8080 --cluster-cidr=10.245.0.0/16 --allocate-node-cidrs=true --service-account-private-key-file=/srv/kubernetes/server.key --v=2 --leader-elect=true
```

Placing `kube-scheduler.yaml` and `kube-controller-manager` on each Master node's `/etc/kubernetes/manifests/` and the related configuration into `/srv/kubernetes/` lets kubelet automatically create and start kube-scheduler and kube-controller-manager.

### kube-dns

kube-dns can be deployed via the Deployment method. While kubeadm automatically creates it in a default setting, for large-scale clusters, you need to relax resource limits, like:

```text
dns_replicas: 6
dns_cpu_limit: 100m
dns_memory_limit: 512Mi
dns_cpu_requests: 70m
dns_memory_requests: 70Mi
```

Additionally, resources for dnsmasq need to be increased too, such as enlarging cache size to 10000, increasing concurrent handling ability with `--dns-forward-max=1000`, etc.

### Data Persistence

In addition to the above configurations, persistent storage is essential for a high availability Kubernetes cluster.

* For clusters deployed on public cloud, consider using persistent storage provided by the cloud platform, like AWS EBS or GCE persistent disk.
* For clusters deployed on physical machines, consider network storage options like iSCSI, NFS, Gluster, Ceph, or even RAID.

## Azure

On Azure, you can use AKS or acs-engine to deploy a Kubernetes cluster. For detailed deployment methods, refer [here](azure.md).

## GCE

On GCE, you can conveniently deploy clusters utilizing cluster scripts:

```text
# gce,aws,gke,azure-legacy,vsphere,openstack-heat,rackspace,libvirt-coreos
export KUBERNETES_PROVIDER=gce
curl -sS https://get.k8s.io | bash
cd kubernetes
cluster/kube-up.sh
```

## AWS

Deploying on AWS is best done using [kops](https://kubernetes.io/docs/setup/production-environment/tools/kops/).

## Physical or Virtual Machines

On Linux physical or virtual machines, we recommend using [kubeadm](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/install-kubeadm/) or [kubespray](kubespray.md) for Kubernetes cluster deployment.