# Troubleshooting Kubernetes Cluster

This chapter is about kubernetes cluster (kubernetes service itself) troubleshooting, including issues of kubernetes core components and addons. For network related issues, please refer to [Troubleshooting Network](network.md).

## Overview

If there is something wrong with kubernetes components, the first thing we need to do is identifying which component are abnormal, e.g.

```sh
kubectl -n kube-system get pods
```

Pay attention to pods not in `Running` status or whose restart counts are not zero. After confirmed the ill-behavior components, then we could identify how to fix it. There are a lot of reasons which could result in cluster unhealthy, which include

- VM or physical machine shutdown
- Network partition within cluster, or between clusters
- Crashes in Kubernetes components
- Data loss or unavailability of persistent storage (e.g. GCE PD or AWS EBS volume)
- Operator error, e.g. misconfigured Kubernetes software or application software

Specifically, we could group those reasons by components

- **kube-apiserver VM shutdown or kube-apiserver crashing** could result in
  - unable to stop, update, or start new pods, services, replication controller
  - existing pods and services should continue to work normally, unless they depend on the Kubernetes API
- **etcd cluster down or abnormal** could result in
  - kube-apiserver fails to come up
  - cluster changes to read only
  - kubelet couldn't update its status but will continue to run original Pods
- **kube-controller-manager/kube-scheduler VM shutdown or crash** could result in
  - Replication controller and other controller stops to work, and deployments/services won't work any more
  - Node controller stops to work and no new node could be registered in the cluster
  - Scheduler is down so that new pods couldn't be scheduled
  - This is why HA is important
- **kube-dns crash or not come up** could result in
  - in-cluster dns resolve failure
  - other components depending on dns (e.g. dashboard) would also fail
- **Individual node (VM or physical machine) shuts down** could result in
  - pods on that Node stop running
- **Network partition** could result in
  - partition A thinks the nodes in partition B are down; partition B thinks the apiserver is down. (Assuming the master VM ends up in partition A.)
  - pods not tolerating partition stop to work
- **Kubelet crash** could result in
  - crashing kubelet cannot start new pods on the node
  - kubelet might delete the pods or not
  - node marked unhealthy
  - replication controllers start new pods elsewhere
- **Cluster operator** error could result in
  - loss of pods, services, etc
  - lost of apiserver backing store
  - users unable to read API

## General mitigations

A general list of mitigtions include

- Use IaaS provider’s automatic VM restarting feature for IaaS VMs
- Use IaaS providers reliable storage (e.g. GCE PD or AWS EBS volume) for VMs with apiserver+etcd
- Configure multiple nodes cluster for etcd and backup data periodically
- Configure high-availability for controller components, e.g.
  - load balancer on front of kube-apiserver
  - multiple replicas of kube-controller-manager, kube-scheduler and kube-dns
- Use replication controller and services in front of pods
- Multiple independent clusters and avoid making risky changes to all clusters at once

## Listing nodes

Normally, all nodes should be in Ready state

```sh
kubectl get nodes
kubectl describe node <node-name>
```

If some nodes are in `NotReady` state, `kubectl describe node <node-name>`  could get the node's events, which usually helps to identify the problem.

## SSH to Nodes

When checking cluster issues, a common step is SSH to nodes and check component status and logs. You could allocate a public IP to the Node or do a port forwarding from router. But a simpler way is via a SSH pod (replace with your own nodeName):

```yaml
# cat ssh.yaml
apiVersion: v1
kind: Service
metadata:
  name: ssh
spec:
  selector:
    app: ssh
  type: LoadBalancer
  ports:
  - protocol: TCP
    port: 22
    targetPort: 22
---
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: ssh
  labels:
    app: ssh
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ssh
  template:
    metadata:
      labels:
        app: ssh
    spec:
      containers:
      - name: alpine
        image: alpine
        ports:
        - containerPort: 22
        stdin: true
        tty: true
      hostNetwork: true
      nodeName: <node-name>
```

```sh
$ kubectl create -f ssh.yaml
$ kubectl get svc ssh
NAME      TYPE           CLUSTER-IP    EXTERNAL-IP      PORT(S)        AGE
ssh       LoadBalancer   10.0.99.149   52.52.52.52   22:32008/TCP   5m
```

Then connect to the node via service ssh's external IP, e.g. `ssh user@52.52.52.52`.

Don't forget to delete the service after user: `kubectl delete -f ssh.yaml`.

## Looking at logs

Usually, components of kubernetes are managed by systemd or kubelet itself (static pods).

- For static pods, please see next part of how to view their logs
- For systemd-managed components, SSH to the nodes and use journalctl to get logs, e.g.

```sh
journalctl -l -u kube-apiserver
journalctl -l -u kube-controller-manager
journalctl -l -u kube-scheduler
journalctl -l -u kubelet
journalctl -l -u kube-proxy
```

or view their log files

- /var/log/kube-apiserver.log
- /var/log/kube-scheduler.log
- /var/log/kube-controller-manager.log


- /var/log/kubelet.log
- /var/log/kube-proxy.log

### Looking at kube-apiserver logs

Suppose kube-apiserver is running as static pods

```sh
PODNAME=$(kubectl -n kube-system get pod -l component=kube-apiserver -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100
```

### Looking at kube-controller-manager logs

Suppose kube-controller-manager is running as static pods

```sh
PODNAME=$(kubectl -n kube-system get pod -l component=kube-controller-manager -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100
```

### Looking at kube-scheduler logs

Suppose kube-scheduler is running as static pods

```sh
PODNAME=$(kubectl -n kube-system get pod -l component=kube-scheduler -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100
```

### Looking at kube-dns logs

Suppose kube-dns is running as deployment pods

```sh
PODNAME=$(kubectl -n kube-system get pod -l k8s-app=kube-dns -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME -c kubedns
```

### Looking at Kubelet logs

Kubelet couldn't be run as static pods, so it is usually managed by systemd

```sh
journalctl -l -u kubelet
```

### Looking at kube-proxy logs

Suppose kube-proxy is running as daemonset pods

```sh
$ kubectl -n kube-system get pod -l component=kube-proxy
NAME               READY     STATUS    RESTARTS   AGE
kube-proxy-42zpn   1/1       Running   0          1d
kube-proxy-7gd4p   1/1       Running   0          3d
kube-proxy-87dbs   1/1       Running   0          4d
$ kubectl -n kube-system logs kube-proxy-42zpn
```

## Kube-dns/Dashboard CrashLoopBackOff

Because dashboard is depending on kube-dns (it needs to resolve `kubernetes.default`), its failure is usually caused by kube-dns.

Looking at kube-dns logs,

```sh
$ kubectl logs --namespace=kube-system $(kubectl get pods --namespace=kube-system -l k8s-app=kube-dns -o name) -c kubedns
$ kubectl logs --namespace=kube-system $(kubectl get pods --namespace=kube-system -l k8s-app=kube-dns -o name) -c dnsmasq
$ kubectl logs --namespace=kube-system $(kubectl get pods --namespace=kube-system -l k8s-app=kube-dns -o name) -c sidecar
```

if you find following errors

```sh
Waiting for services and endpoints to be initialized from apiserver...
skydns: failure to forward request "read udp 10.240.0.18:47848->168.63.129.16:53: i/o timeout"
Timeout waiting for initialization
```

Then it indicates kube-dns pod failed to forward dns request to upstream servers. The solution to this problem is

- Check docker version whether it's >= 1.13. If so, run `iptables -P FORWARD ACCEPT` on each node
- Wait a while, kube-dns should recover automatically. If not, check on node with
  - whether network configure (e.g. local routes and cloud traffic routing) is right
  - whether upstream dns servers is accessible
  - whether there are iptables, firewalls or cloud network security groups disabled DNS

If kubernetes API access timeout is find instead of forward errors, e.g.

```sh
E0122 06:56:04.774977       1 reflector.go:199] k8s.io/dns/vendor/k8s.io/client-go/tools/cache/reflector.go:94: Failed to list *v1.Endpoints: Get https://10.0.0.1:443/api/v1/endpoints?resourceVersion=0: dial tcp 10.0.0.1:443: i/o timeout
I0122 06:56:04.775358       1 dns.go:174] Waiting for services and endpoints to be initialized from apiserver...
E0122 06:56:04.775574       1 reflector.go:199] k8s.io/dns/vendor/k8s.io/client-go/tools/cache/reflector.go:94: Failed to list *v1.Service: Get https://10.0.0.1:443/api/v1/services?resourceVersion=0: dial tcp 10.0.0.1:443: i/o timeout
I0122 06:56:05.275295       1 dns.go:174] Waiting for services and endpoints to be initialized from apiserver...
I0122 06:56:05.775182       1 dns.go:174] Waiting for services and endpoints to be initialized from apiserver...
I0122 06:56:06.275288       1 dns.go:174] Waiting for services and endpoints to be initialized from apiserver...
```

Then it indicates there are something wrong with Pod-Node and Node-Node networking. There are also a lot of possible reasons for this, please refer to [troubleshooting network](network.md).

## Kubelet: failed to initialize top level QOS containers

`Failed to start ContainerManager failed to initialise top level QOS containers` error message is reported when restarting kubelet ([#43856](https://github.com/kubernetes/kubernetes/issues/43856)). The problem has been fixed in [#44940](https://github.com/kubernetes/kubernetes/pull/44940) (v1.7.0). For old clusters, please try

- add options `--exec-opt native.cgroupdriver=systemd` to docker.service
- reboot the node

## Kubelet is reporting FailedNodeAllocatableEnforcement

When `--cgroups-per-qos` is disabled, kubelet will report `Failed to update Node Allocatable Limits` warning events every minutes:

```sh
$ kubectl describe node node1
Events:
  Type     Reason                            Age                  From                               Message
  ----     ------                            ----                 ----                               -------
  Warning  FailedNodeAllocatableEnforcement  2m (x1001 over 16h)  kubelet, aks-agentpool-22604214-0  Failed to update Node Allocatable Limits "": failed to set supported cgroup subsystems for cgroup : Failed to set config for supported subsystems : failed to write 7285047296 to memory.limit_in_bytes: write /var/lib/docker/overlay2/5650a1aadf9c758946073fefa1558446ab582148ddd3ee7e7cb9d269fab20f72/merged/sys/fs/cgroup/memory/memory.limit_in_bytes: invalid argument
```

If NodeAllocatable is required in your cluster, then this warning could be omit safely. However, according to [Reserve Compute Resources for System Daemons](https://kubernetes.io/docs/tasks/administer-cluster/reserve-compute-resources/), it's better to turn it on:

> Kubernetes nodes can be scheduled to `Capacity`. Pods can consume all the available capacity on a node by default. This is an issue because nodes typically run quite a few system daemons that power the OS and Kubernetes itself. Unless resources are set aside for these system daemons, pods and system daemons compete for resources and lead to resource starvation issues on the node.
>
> The `kubelet` exposes a feature named `Node Allocatable` that helps to reserve compute resources for system daemons. Kubernetes recommends cluster administrators to configure `Node Allocatable` based on their workload density on each node.
>
> ```sh
>       Node Capacity
> ---------------------------
> |     kube-reserved       |
> |-------------------------|
> |     system-reserved     |
> |-------------------------|
> |    eviction-threshold   |
> |-------------------------|
> |                         |
> |      allocatable        |
> |   (available for pods)  |
> |                         |
> |                         |
> ---------------------------
> ```

To enable this feature, setup kubelet with options:

```sh
kubelet --cgroups-per-qos=true --enforce-node-allocatable=pods ...
```

## Kube-proxy: conntrack returned error: error looking for path of conntrack

This error message is usually happening when setup a new cluster. kube-proxy may not find the conntrack binary on the node:

```sh
kube-proxy[2241]: E0502 15:55:13.889842    2241 conntrack.go:42] conntrack returned error: error looking for path of conntrack: exec: "conntrack": executable file not found in $PATH
```

Install `conntrack-tools` and restart kube-proxy could fix the problem.

## No graphs shown in dashboard

Make sure Heapster is up and running and Dashboard was able to connect with it.

```sh
kubectl -n kube-system get pods -l k8s-app=heapster
NAME                        READY     STATUS    RESTARTS   AGE
heapster-86b59f68f6-h4vt6   2/2       Running   0          5d
```

## HPA doesn't scale Pods

Check HPA's events:

```sh
$ kubectl describe hpa php-apache
Name:                                                  php-apache
Namespace:                                             default
Labels:                                                <none>
Annotations:                                           <none>
CreationTimestamp:                                     Wed, 27 Dec 2017 14:36:38 +0800
Reference:                                             Deployment/php-apache
Metrics:                                               ( current / target )
  resource cpu on pods  (as a percentage of request):  <unknown> / 50%
Min replicas:                                          1
Max replicas:                                          10
Conditions:
  Type           Status  Reason                   Message
  ----           ------  ------                   -------
  AbleToScale    True    SucceededGetScale        the HPA controller was able to get the target's current scale
  ScalingActive  False   FailedGetResourceMetric  the HPA was unable to compute the replica count: unable to get metrics for resource cpu: unable to fetch metrics from API: the server could not find the requested resource (get pods.metrics.k8s.io)
Events:
  Type     Reason                   Age                  From                       Message
  ----     ------                   ----                 ----                       -------
  Warning  FailedGetResourceMetric  3m (x2231 over 18h)  horizontal-pod-autoscaler  unable to get metrics for resource cpu: unable to fetch metrics from API: the server could not find the requested resource (get pods.metrics.k8s.io)
```

Resource `pods.metrics.k8s.io` not found means [metrics-server](../addons/metrics.md) not deployed into cluster. Please refer [here](../addons/metrics.md) to deploy it.

## References

- [Troubleshoot Clusters](https://kubernetes.io/docs/tasks/debug-application-cluster/debug-cluster/)
- [SSH into Azure Container Service (AKS) cluster nodes](https://docs.microsoft.com/en-us/azure/aks/aks-ssh#configure-ssh-access)
- [Kubernetes dashboard FAQ](https://github.com/kubernetes/dashboard/wiki/FAQ)
