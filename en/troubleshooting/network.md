# Troubleshooting Network

Network issues comes up frequently for new installations of Kubernetes or increasing Kubernetes load. This chapter introduces various network problems and troubleshooting method when using kubernetes.

## Overview

Kubernetes "IP-per-pod" model solves 4 distinct networking problems:

- Highly-coupled container-to-container communications: this is solved by pods and localhost communications.
- Pod-to-Pod communications: this is solved by CNI network plugin
- Pod-to-Service communications: this is solved by services
- External-to-Service communications: this is solved by services

And these are exactly the direction of what we should do when encountering network issues. Reasons include:

- CNI network plugin configure error
  - CIDR conflicts with existing ones
  - using protocols not supported by underlying network (e.g. multicast may be disabled for clusters on public cloud)
  - IP forward is not enabled
    - `sysctl net.ipv4.ip_forward`
    - `sysctl net.bridge.bridge-nf-call-iptables`
- Missing route tables
  - default kubenet plugin requires a network route for each podCIDR to node IP
  - kube-controller-manager should configure the route table for all nodes, but if something is wrong (e.g. not authorized, exceed quota, etc), route may be missing
- Forbidden by security groups or firewall rules
  - iptables not managed by kubernetes may forbid kubernetes network connections
  - security groups on public cloud may forbid kubernetes network connections
  - ACL on switches or routers may also forbid kubernetes network connections

## Pod failed to allocate IP address

Pod stuck on ContainerCreating state and its events report `Failed to allocate address` error:

```sh
  Normal   SandboxChanged          5m (x74 over 8m)    kubelet, k8s-agentpool-66825246-0  Pod sandbox changed, it will be killed and re-created.
  Warning  FailedCreatePodSandBox  21s (x204 over 8m)  kubelet, k8s-agentpool-66825246-0  Failed create pod sandbox: rpc error: code = Unknown desc = NetworkPlugin cni failed to set up pod "deployment-azuredisk6-56d8dcb746-487td_default" network: Failed to allocate address: Failed to delegate: Failed to allocate address: No available addresses
```

Check the allocated IP addresses in plugin IPAM store, you may find that all IP addresses have been allocated, but the number is much less that running Pods:

```sh
# Kubenet for example. The real path of IPAM store file depends on network plugin implementation.
$ cd /var/lib/cni/networks/kubenet
$ ls -al|wc -l
258

$ docker ps | grep POD | wc -l
7
```

There are two possible reasons for such case, which include

* Bugs in network plugin, which forgets deallocating the IP address when Pod terminated
* Pods creation is much more faster than garbage collection of terminated Pods

For the first reason, contacting author of plugin for workaround or fixes is first choice. But you can also deallocate IP addresses manually if you are sure about what you are doing:

* Stop Kubelet
* Find the IPAM store file for the CNI plugin and get a list of all allocated IP addresses, e.g.  `/var/lib/cni/networks/cbr0` (flannel) and `/var/run/azure-vnet-ipam.json` (Azure CNI)

- Get list of using IP addresses, e.g. by  `kubectl get pod -o wide --all-namespaces | grep <node-name>`
- Compare the two list, remove the unused IP addresses from the store file, and then delete related netns or virtual nics (this requires deep understand of the network plugin)
- Finally restart kubelet

```sh
# Take kubenet for example to delete the unused IPs
$ for hash in $(tail -n +1 * | grep '^[A-Za-z0-9]*$' | cut -c 1-8); do if [ -z $(docker ps -a | grep $hash | awk '{print $1}') ]; then grep -ilr $hash ./; fi; done | xargs rm
```

For the second reason, a fast garbage collection could be configured for kubelet, e.g.

```sh
--minimum-container-ttl-duration=15s
--maximum-dead-containers-per-container=1
--maximum-dead-containers=100
```

## Flannel Pods stuck in `Init:CrashLoopBackOff`

When using Flannel network plugin, it is very easy to install for a fresh setup

```sh
kubectl apply -f https://raw.githubusercontent.com/coreos/flannel/master/Documentation/kube-flannel.yml
```

However, after a while, Flannel Pods may be stuck in `Init:CrashLoopBackOff` state and also result in not able to create other pods (because network ready is a requirement).

```sh
$ kubectl -n kube-system get pod
NAME                            READY     STATUS                  RESTARTS   AGE
kube-flannel-ds-ckfdc           0/1       Init:CrashLoopBackOff   4          2m
kube-flannel-ds-jpp96           0/1       Init:CrashLoopBackOff   4          2m
```

Check logs of Pod `kube-flannel-ds-jpp96`

```sh
$ kubectl -n kube-system logs kube-flannel-ds-jpp96 -c install-cni
cp: can't create '/etc/cni/net.d/10-flannel.conflist': Permission denied
```

This issue is usually caused by SELinux, close SELinux should solve the problem. There are two ways to do this:

- Set `SELINUX=disabled` in file `/etc/selinux/config` (persistent even after reboot)
- Execute command `setenforce 0` (not persistent after reboot)

## DNS not work

If your docker version is above 1.13+, then docker would change default iptables FORWARD policy to DROP (at each restart). This change may cause kube-dns not reaching upstream DNS servers. A solution is run `iptables -P FORWARD ACCEPT` on each nodes, e.g.

```sh
echo "ExecStartPost=/sbin/iptables -P FORWARD ACCEPT" >> /etc/systemd/system/docker.service.d/exec_start.conf
systemctl daemon-reload
systemctl restart docker
```

Or if you are using flannel or weave network plugin, upgrades to latest version could also solve the problem.

There is also possible that kube-dns is not running normally.

```sh
$ kubectl get pods --namespace=kube-system -l k8s-app=kube-dns
NAME                    READY     STATUS    RESTARTS   AGE
...
kube-dns-v19-ezo1y      3/3       Running   0           1h
...
```

If kube-dns pods are in CrashLoopBackOff state, refer to [Troubleshooting kube-dns/dashboard CrashLoopBackOff](cluster.md) for troubleshooting kube-dns problem.

Or else, check whether kube-dns service and endpoints are normal:

```sh
$ kubectl get svc kube-dns --namespace=kube-system
NAME          CLUSTER-IP     EXTERNAL-IP   PORT(S)             AGE
kube-dns      10.0.0.10      <none>        53/UDP,53/TCP        1h

$ kubectl get ep kube-dns --namespace=kube-system
NAME       ENDPOINTS                       AGE
kube-dns   10.180.3.17:53,10.180.3.17:53    1h
```

If kube-dns service doens't exist, or its endpoints are empty, then you should recreate [kube-dns service](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/dns), e.g.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: kube-dns
  namespace: kube-system
  labels:
    k8s-app: kube-dns
    kubernetes.io/cluster-service: "true"
    kubernetes.io/name: "KubeDNS"
spec:
  selector:
    k8s-app: kube-dns
  clusterIP: 10.0.0.10
  ports:
  - name: dns
    port: 53
    protocol: UDP
  - name: dns-tcp
    port: 53
    protocol: TCP
```

## Service not accessible within Pods

The first step is checking whether endpoints have been created automatically for the service

```sh
kubectl get endpoints <service-name>
```

If you got an empty result, there is possible your service's label selector is wrong. Confirm it as follows:

```sh
# Query Service LabelSelector
kubectl get svc <service-name> -o jsonpath='{.spec.selector}'
# Get Pods matching the LabelSelector and check whether they are running
kubectl get pods -l key1=value1,key2=value2
```

If all of above steps are still ok, confirm further by

- checking whether Pod containerPort is same with Service containerPort
- checking whether `podIP:containerPort` is working

Further, there are also other reasons could also cause service problems. Reasons include:

- container is not listening to specified containerPort (check pod description again)
- CNI plugin error or network route error
- kube-proxy is not running or iptables rules are not configured correctly

Normally, following iptables should be created for a service named `hostnames`:

```sh
$ iptables-save | grep hostnames
-A KUBE-SEP-57KPRZ3JQVENLNBR -s 10.244.3.6/32 -m comment --comment "default/hostnames:" -j MARK --set-xmark 0x00004000/0x00004000
-A KUBE-SEP-57KPRZ3JQVENLNBR -p tcp -m comment --comment "default/hostnames:" -m tcp -j DNAT --to-destination 10.244.3.6:9376
-A KUBE-SEP-WNBA2IHDGP2BOBGZ -s 10.244.1.7/32 -m comment --comment "default/hostnames:" -j MARK --set-xmark 0x00004000/0x00004000
-A KUBE-SEP-WNBA2IHDGP2BOBGZ -p tcp -m comment --comment "default/hostnames:" -m tcp -j DNAT --to-destination 10.244.1.7:9376
-A KUBE-SEP-X3P2623AGDH6CDF3 -s 10.244.2.3/32 -m comment --comment "default/hostnames:" -j MARK --set-xmark 0x00004000/0x00004000
-A KUBE-SEP-X3P2623AGDH6CDF3 -p tcp -m comment --comment "default/hostnames:" -m tcp -j DNAT --to-destination 10.244.2.3:9376
-A KUBE-SERVICES -d 10.0.1.175/32 -p tcp -m comment --comment "default/hostnames: cluster IP" -m tcp --dport 80 -j KUBE-SVC-NWV5X2332I4OT4T3
-A KUBE-SVC-NWV5X2332I4OT4T3 -m comment --comment "default/hostnames:" -m statistic --mode random --probability 0.33332999982 -j KUBE-SEP-WNBA2IHDGP2BOBGZ
-A KUBE-SVC-NWV5X2332I4OT4T3 -m comment --comment "default/hostnames:" -m statistic --mode random --probability 0.50000000000 -j KUBE-SEP-X3P2623AGDH6CDF3
-A KUBE-SVC-NWV5X2332I4OT4T3 -m comment --comment "default/hostnames:" -j KUBE-SEP-57KPRZ3JQVENLNBR
```

There should be 1 rule in KUBE-SERVICES, 1 or 2 rules per endpoint in KUBE-SVC-(hash) (depending on SessionAffinity), one KUBE-SEP-(hash) chain per endpoint, and a few rules in each KUBE-SEP-(hash) chain. The exact rules will vary based on your exact config (including node-ports and load-balancers).

## Pod cannot reach itself via Service IP

This can happen when the network is not properly configured for “hairpin” traffic, usually when kube-proxy is running in iptables mode and Pods are connected with bridge network.

Kubelet exposes a `--hairpin-mode` option, which should be configured as `promiscuous-bridge` or `hairpin-veth` instead of `none` (default is `promiscuous-bridge`).

Confirm `hairpin-veth` is working by:

```sh
$ for intf in /sys/devices/virtual/net/cbr0/brif/*; do cat $intf/hairpin_mode; done
1
1
1
1
```

Confirm `promiscuous-bridge` is working by:

```sh
$ ifconfig cbr0 |grep PROMISC
UP BROADCAST RUNNING PROMISC MULTICAST  MTU:1460  Metric:1
```

## Can't access Kubernetes API

Many addons and containers need to access Kubernetes API for various data (e.g. kube-dns and operator containers). If such errors happened, then confirm whether Kubernetes API is accessible within Pods first:

```sh
$ kubectl run curl  --image=appropriate/curl -i -t  --restart=Never --command -- sh
If you don't see a command prompt, try pressing enter.
/ #
/ # KUBE_TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
/ # curl -sSk -H "Authorization: Bearer $KUBE_TOKEN" https://$KUBERNETES_SERVICE_HOST:$KUBERNETES_SERVICE_PORT/api/v1/namespaces/default/pods
{
  "kind": "PodList",
  "apiVersion": "v1",
  "metadata": {
    "selfLink": "/api/v1/namespaces/default/pods",
    "resourceVersion": "2285"
  },
  "items": [
   ...
  ]
 }
```

If timeout error is reported, then confirm whether `kubernetes` service and its endpoints are normal or not:

```sh
$ kubectl get service kubernetes
NAME         TYPE        CLUSTER-IP   EXTERNAL-IP   PORT(S)   AGE
kubernetes   ClusterIP   10.96.0.1    <none>        443/TCP   25m
$ kubectl get endpoints kubernetes
NAME         ENDPOINTS          AGE
kubernetes   172.17.0.62:6443   25m
```

If both are still OK, then it's probably kube-apiserver is not start or it is blocked by firewall. Check kube-apiserver status and its logs

```sh
# Check kube-apiserver status
kubectl -n kube-system get pod -l component=kube-apiserver

# Get kube-apiserver logs
PODNAME=$(kubectl -n kube-system get pod -l component=kube-apiserver -o jsonpath='{.items[0].metadata.name}')
kubectl -n kube-system logs $PODNAME --tail 100
```

But if  `403 - Forbidden` error is reported, then it's probably kube-apiserver is configured with RBAC. And your container's serviceAccount is not authorized to resources. For such case, you should create proper RoleBindings and ClusterRoleBindings, e.g. to make CoreDNS container run, you need

```yaml
# 1. service account
apiVersion: v1
kind: ServiceAccount
metadata:
  name: coredns
  namespace: kube-system
  labels:
      kubernetes.io/cluster-service: "true"
      addonmanager.kubernetes.io/mode: Reconcile
---
# 2. cluster role
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  labels:
    kubernetes.io/bootstrapping: rbac-defaults
    addonmanager.kubernetes.io/mode: Reconcile
  name: system:coredns
rules:
- apiGroups:
  - ""
  resources:
  - endpoints
  - services
  - pods
  - namespaces
  verbs:
  - list
  - watch
---
# 3. cluster role binding
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  annotations:
    rbac.authorization.kubernetes.io/autoupdate: "true"
  labels:
    kubernetes.io/bootstrapping: rbac-defaults
    addonmanager.kubernetes.io/mode: EnsureExists
  name: system:coredns
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: system:coredns
subjects:
- kind: ServiceAccount
  name: coredns
  namespace: kube-system
---
# 4. use created service account
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: coredns
  namespace: kube-system
  labels:
    k8s-app: coredns
    kubernetes.io/cluster-service: "true"
    addonmanager.kubernetes.io/mode: Reconcile
    kubernetes.io/name: "CoreDNS"
spec:
  replicas: 2
  selector:
    matchLabels:
      k8s-app: coredns
  template:
    metadata:
      labels:
        k8s-app: coredns
    spec:
      serviceAccountName: coredns
      ...
```

## References

- [Troubleshoot Applications](https://kubernetes.io/docs/tasks/debug-application-cluster/debug-application/)
- [Debug Services](https://kubernetes.io/docs/tasks/debug-application-cluster/debug-service/)
- [Kubernetes Cluster Networking](https://kubernetes.io/docs/concepts/cluster-administration/networking/)
