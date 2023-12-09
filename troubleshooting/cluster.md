# Troubleshooting Cluster Errors

This section introduces methods for troubleshooting abnormal cluster conditions, including key components of Kubernetes and essential extensions (like kube-dns). For issues related to network, please refer to the [network troubleshooting guide](network.md).

## Overview

Investigating abnormal cluster states generally begins with examining the status of Node and Kubernetes services, identifying the faulty service, and then seeking a solution. There could be many reasons for abnormal cluster states, including:

* Shutdown of virtual or physical machines
* Network partitions
* Failure of Kubernetes services to start properly
* Loss of data or unavailability of persistent storage (commonly on public or private clouds)
* Operational mistakes (like configuration errors)

Considering different components, the reasons might include:

* Failure to start kube-apiserver, leading to:
  * Inaccessible clusters
  * Normal operation of existing Pods and services (except those relying on Kubernetes API)
* Anomalies in the etcd cluster, leading to:
  * kube-apiserver being unable to read or write the cluster status, which leads to errors in accessing the Kubernetes API
  * kubelet failing to update its status periodically
* Erroneous kube-controller-manager/kube-scheduler, leading to:
  * Inoperative replication controllers, node controllers, cloud service controllers, etc, which leads to inoperative Deployments, Services, and inability to register new Nodes to the cluster
  * Newly created Pods cannot be scheduled (always in Pending state)
* Node itself crashing or failure of Kubelet to start, leading to:
  * Pods on the Node not operating as expected
  * Already running Pods unable to terminate properly
* Network partitions leading to communication anomalies between Kubelet and the control plane, as well as between Pods

To maintain the health of the cluster, consider the following when deploying a cluster:

* Enable VM's automatic restart feature on the cloud platform
* Configure a multi-node highly available cluster for Etcd, use persistent storage (like AWS EBS), and back up data regularly
* Configure high availability for the control plane, such as load balancing for multiple kube-apiservers, and running multiple nodes of kube-controller-manager, kube-scheduler, kube-dns, etc
* Prefer using replication controllers and Services rather than directly managing Pods
* Deploy multiple Kubernetes clusters across regions

## Checking Node Status

Generally, you can first check the status of the Node and confirm whether the Node is in Ready state.

```bash
kubectl get nodes
kubectl describe node <node-name>
```

If the state is NotReady, you can execute `kubectl describe node <node-name>` command to examine the current events of the Node. These events are typically helpful in troubleshooting issues on the Node.

## SSH Login to Node

During troubleshooting of Kubernetes issues, you usually need to SSH onto the specific Node to check the status and logs of kubelet, docker, iptables, etc. When using a cloud platform, you can bind a public IP to the corresponding VM; for physical deployments, you can access it via port mapping from the router. A simpler method is to use an SSH Pod (remember to replace with your nodeName):

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

```bash
$ kubectl create -f ssh.yaml
$ kubectl get svc ssh
NAME      TYPE           CLUSTER-IP    EXTERNAL-IP      PORT(S)        AGE
ssh       LoadBalancer   10.0.99.149   52.52.52.52   22:32008/TCP   5m
```

Next, you can log into the Node through the external IP of the ssh service, like `ssh user@52.52.52.52`.

After using it, don't forget to delete the SSH service with `kubectl delete -f ssh.yaml`.

## Viewing Logs

Generally, there are two deployment methods for the main components of Kubernetes:

* Utilize systemd etc. for booting control node services
* Use Static Pod for managing and booting control node services

When systemd etc. are user for managing control node services, to view logs, you must first SSH login to the machine and then view specific log files. For example:

```bash
journalctl -l -u kube-apiserver
journalctl -l -u kube-controller-manager
journalctl -l -u kube-scheduler
journalctl -l -u kubelet
journalctl -l -u kube-proxy
```

Or directly view log files:

* /var/log/kube-apiserver.log
* /var/log/kube-scheduler.log
* /var/log/kube-controller-manager.log
* /var/log/kubelet.log
* /var/log/kube-proxy.log

### kube-apiserver logs

```bash
PODNAME=$(kubectl -n kube-system get pod -l component=kube-apiserver -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100
```

### kube-controller-manager logs

```bash
PODNAME=$(kubectl -n kube-system get pod -l component=kube-controller-manager -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100
```

### kube-scheduler logs

```bash
PODNAME=$(kubectl -n kube-system get pod -l component=kube-scheduler -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100
```

### kube-dns logs

```bash
PODNAME=$(kubectl -n kube-system get pod -l k8s-app=kube-dns -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME -c kubedns
```

### Kubelet logs

To view Kubelet logs, you need to first SSH login to the Node.

```bash
journalctl -l -u kubelet
```

### Kube-proxy logs

Kube-proxy is usually deployed as a DaemonSet.

```bash
$ kubectl -n kube-system get pod -l component=kube-proxy
NAME               READY     STATUS    RESTARTS   AGE
kube-proxy-42zpn   1/1       Running   0          1d
kube-proxy-7gd4p   1/1       Running   0          3d
kube-proxy-87dbs   1/1       Running   0          4d
$ kubectl -n kube-system logs kube-proxy-42zpn
```
