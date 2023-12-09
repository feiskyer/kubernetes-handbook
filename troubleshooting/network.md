# Network Troubleshooting

This chapter primarily introduces various common network problems and their troubleshooting methods, including Pod access anomalies, Service access exceptions, and network security policy exceptions, and so on.

When we talk about Kubernetes’ network, it usually falls into one of the following three situations:

* Pod accessing the network outside the container
* Accessing the Pod network from outside the container
* Inter-Pod access

Of course, each of the above scenarios also includes local access and cross-host access. In most cases, Pods are accessed indirectly through Services.

Locating network problems is basically done from these scenarios, pinning down the specific network anomaly points, and then seeking solutions. There are many possible reasons for network anomalies, common ones include:

* Misconfiguration of CNI network plugins resulting in multiple hosts not being accessible. For example,
  * IP segment conflicts with the existing network
  * The used plugin employs a protocol that is not supported by the underlying network
  * Forgetting to enable IP forwarding, etc.
    * `sysctl net.ipv4.ip_forward`
    * `sysctl net.bridge.bridge-nf-call-iptables`
* Pod network routing loss. For instance,
  * kubenet requires a route from podCIDR to the host IP address in the network. If these routes are not properly configured, problems with Pod network communication can arise.
  * On public cloud platforms, the kube-controller-manager will automatically configure routes for all Nodes, but incorrect configurations (such as authentication authorization failures and exceeding quotas) may also prevent route configuration.
* Service NodePort and health probe port conflict
  * In clusters before version 1.10.4, there may be instances where the NodePort and health probe ports of different Services overlap (this issue has been fixed in [kubernetes\#64468](https://github.com/kubernetes/kubernetes/pull/64468)).
* Security groups, firewalls, or security policies within the host or cloud platform could be blocking the Pod network. For example,
  * Non-Kubernetes managed iptables rules could be blocking the Pod network
  * Public cloud platform security groups blocking the Pod network (note that the Pod network may not be in the same network segment as the Node network)
  * Switch or router ACL blocking the Pod network

## Flannel Pods Constantly in Init:CrashLoopBackOff State

Deploying the Flannel network plugin is effortless, requiring only one command:

```bash
kubectl apply -f https://raw.githubusercontent.com/coreos/flannel/master/Documentation/kube-flannel.yml
```

However, after deployment, the Flannel Pod might encounter an initialization failure error.

```bash
$ kubectl -n kube-system get pod
NAME                            READY     STATUS                  RESTARTS   AGE
kube-flannel-ds-ckfdc           0/1       Init:CrashLoopBackOff   4          2m
kube-flannel-ds-jpp96           0/1       Init:CrashLoopBackOff   4          2m
```

Looking at the logs, you will find:

```bash
$ kubectl -n kube-system logs kube-flannel-ds-jpp96 -c install-cni
cp: can't create '/etc/cni/net.d/10-flannel.conflist': Permission denied
```

This is generally due to SELinux being enabled. It can be resolved by disabling SELinux. There are two ways to do this:

* Modify the `/etc/selinux/config` file: `SELINUX=disabled`
* Temporarily modify it using the command (these changes would be lost after a reboot): `setenforce 0`

## Pod Unable to Allocate IP

The Pod is constantly in the ContainerCreating state. Examining events reveal that the network plugin cannot assign it an IP:

```bash
  Normal   SandboxChanged          5m (x74 over 8m)    kubelet, k8s-agentpool-66825246-0  Pod sandbox changed, it will be killed and re-created.
  Warning  FailedCreatePodSandBox  21s (x204 over 8m)  kubelet, k8s-agentpool-66825246-0  Failed create pod sandbox: rpc error: code = Unknown desc = NetworkPlugin cni failed to set up pod "deployment-azuredisk6-56d8dcb746-487td_default" network: Failed to allocate address: Failed to delegate: Failed to allocate address: No available addresses
```

Checking the status of the network plugin's IP allocation, it turns out the IP addresses have indeed all been allocated, but the number of Pods truly in Running state is minimal:

```bash
# The detailed path depends on the specific network plugin. When using the host-local IPAM plugin, the path is under /var/lib/cni/networks
$ cd /var/lib/cni/networks/kubenet
$ ls -al|wc -l
258

$ docker ps | grep POD | wc -l
7
```

There are two possible reasons for this:

* It could be an issue with the network plugin itself whereby the IP is not released after the Pod is stopped.
* The speed at which the Pod is recreated could be faster than the rate at which the Kubelet calls the CNI plugin to recycle the network (when garbage collecting, it will first call CNI to clean up the network before deleting the stopped Pod).

For the first problem, it is best to contact the plugin developer to inquire about the fix or a temporary resolution. Of course, if you are well-versed with the working principle of the network plugin, you can consider manually releasing unused IP addresses, such as:

* Stop the Kubelet
* Locate the file where the IPAM plugin stores the assigned IP addresses, such as `/var/lib/cni/networks/cbr0` (flannel) or `/var/run/azure-vnet-ipam.json` (Azure CNI), etc.
* Query the IPs currently used by the container, such as `kubectl get pod -o wide --all-namespaces | grep <node-name>`
* Compare the two lists, delete unused IP addresses from the IPAM file, and manually delete related virtual network cards and network namespaces (if any).
* Restart the Kubelet

```bash
# Take kubenet for example to delete the unused IPs
$ for hash in $(tail -n +1 * | grep '^[A-Za-z0-9]*$' | cut -c 1-8); do if [ -z $(docker ps -a | grep $hash | awk '{print $1}') ]; then grep -ilr $hash ./; fi; done | xargs rm
```

For the second issue, you can configure faster garbage collection for the Kubelet, such as:

```bash
--minimum-container-ttl-duration=15s
--maximum-dead-containers-per-container=1
--maximum-dead-containers=100
```

## Pod Unable to Resolve DNS

If the Docker version installed on the Node is higher than 1.12, Docker will change the default iptables FORWARD policy to DROP. This will create problems for Pod network access. The solution is to run `iptables -P FORWARD ACCEPT` on each Node, such as:

```bash
echo "ExecStartPost=/sbin/iptables -P FORWARD ACCEPT" >> /etc/systemd/system/docker.service.d/exec_start.conf
systemctl daemon-reload
systemctl restart docker
```

If you are using the flannel/weave network plugins, upgrading to the latest version can also solve this problem.

Aside from this, there are many other reasons causing DNS resolution failure:

(1) DNS resolution failure may also be caused by kube-dns service anomalies. The following command can be used to check if kube-dns is running normally:

```bash
$ kubectl get pods --namespace=kube-system -l k8s-app=kube-dns
NAME                    READY     STATUS    RESTARTS   AGE
...
kube-dns-v19-ezo1y      3/3       Running   0           1h
...
```

If kube-dns is in the CrashLoopBackOff state, you can refer to [Kube-dns/Dashboard CrashLoopBackOff Troubleshooting](cluster.md) to view specific troubleshooting methods.

(2) If the kube-dns Pod is in a normal Running state, you need to check further if the kube-dns service has been correctly configured:

```bash
$ kubectl get svc kube-dns --namespace=kube-system
NAME          CLUSTER-IP     EXTERNAL-IP   PORT(S)             AGE
kube-dns      10.0.0.10      <none>        53/UDP,53/TCP        1h

$ kubectl get ep kube-dns --namespace=kube-system
NAME       ENDPOINTS                       AGE
kube-dns   10.180.3.17:53,10.180.3.17:53    1h
```

If the kube-dns service is absent or the endpoints list is empty, it indicates that the kube-dns service configuration is erroneous. You can recreate the [kube-dns service](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/dns), such as:

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

(3) If you have recently upgraded CoreDNS and are using the proxy plugin of CoreDNS, please note that versions [1.5.0 and above](https://coredns.io/2019/04/06/coredns-1.5.0-release/) require replacing the proxy plugin with the forward plugin. For example:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: coredns-custom
  namespace: kube-system
data:
  test.server: |
    abc.com:53 {
        errors
        cache 30
        forward . 1.2.3.4
    }
    my.cluster.local:53 {
        errors
        cache 30
        forward . 2.3.4.5
    }
    azurestack.local:53 {
        forward . tls://1.1.1.1 tls://1.0.0.1 {
          tls_servername cloudflare-dns.com
          health_check 5s
        }
    }
```

(4) If the kube-dns Pod and Service are both functioning properly, then it is necessary to check whether kube-proxy has correctly configured load balancing iptables rules for kube-dns. The specific troubleshooting methods can be referred to in the section "Service cannot be accessed" below.

## Slow DNS resolution

Due to a bug in the kernel, the connection tracking module experiences competition, resulting in slow DNS resolution. The community is tracking the issue at [https://github.com/kubernetes/kubernetes/issues/56903](https://github.com/kubernetes/kubernetes/issues/56903).

Temporary solution: Configure `options single-request-reopen` for containers to avoid concurrent DNS requests with the same five-tuple:

```yaml
lifecycle:
  postStart:
    exec:
      command:
        - /bin/sh
        - -c
        - "/bin/echo 'options single-request-reopen' >> /etc/resolv.conf"
```

Alternatively, configure dnsConfig for Pods:

```yaml
template:
  spec:
    dnsConfig:
      options:
        - name: single-request-reopen
```

Note: The `single-request-reopen` option is ineffective on Alpine. Please use other base images like Debian or refer to the fix methods below.

Repair method: Upgrade the kernel and ensure that the following two patches are included.

1. [netfilter: nf_nat: skip nat clash resolution for same-origin entries](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/commit/?id=4e35c1cb9460240e983a01745b5f29fe3a4d8e39) (included since kernel v5.0)

2. [netfilter: nf_conntrack: resolve clash for matching conntracks](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/commit/?id=ed07d9a021df6da53456663a76999189badc432a) (included since kernel v4.19)

> For Azure, this issue has been fixed in [v4.15.0-1030.31/v4.18.0-1006.6](https://bugs.launchpad.net/ubuntu/+source/linux-azure/+bug/1795493) ([patch1](https://git.launchpad.net/~canonical-kernel/ubuntu/+source/linux-azure/commit/?id=6f4fe585e573d7edd4122e45f58ca3da5b478265), [patch2](https://git.launchpad.net/~canonical-kernel/ubuntu/+source/linux-azure/commit/?id=4c7917876cf9560492d6bc2732365cbbfecfe623)).

Other possible reasons and fixes include:

* Having both Kube-dns and CoreDNS present at the same time can cause issues, so only keep one.

* Slow DNS resolution may occur if the resource limits for kube-dns or CoreDNS are too low. In this case, increase the resource limits.

* Configure the DNS option `use-vc` to force using TCP protocol for sending DNS queries.

* Run a DNS caching service on each node and set all container's DNS nameservers to point to that cache.

It is recommended to deploy Nodelocal DNS Cache extension to solve this problem and improve DNS resolution performance. Please refer to [https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/dns/nodelocaldns](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/dns/nodelocaldns) for deployment steps of Nodelocal DNS Cache.

> For more methods of customizing DNS configuration, please refer to [Customizing DNS Service](https://kubernetes.io/docs/tasks/administer-cluster/dns-custom-nameservers/).

## Service cannot be accessed

When accessing the Service ClusterIP fails, you can first confirm if there are corresponding Endpoints.

```bash

kubectl get endpoints <service-name>

```

If the list is empty, it may be due to an incorrect LabelSelector configuration for this Service. You can use the following method to confirm:

```bash

# Query the LabelSelector of the Service

kubectl get svc <service-name> -o jsonpath='{.spec.selector}'

# Query Pods that match the LabelSelector

kubectl get pods -l key1=value1,key2=value2

```

If the Endpoints are normal, you can further check:

* Whether Pod's containerPort corresponds to Service's containerPort.

* Whether direct access to `podIP:containerPort` is normal.

Furthermore, even if all of the above configurations are correct and error-free, there may be other reasons causing issues with accessing the Service, such as:

* The containers inside Pods may not be running properly or not listening on the specified containerPort.

* CNI network or host routing abnormalities can also cause similar problems.

* The kube-proxy service may not have started or configured corresponding iptables rules correctly. For example, under normal circumstances, a service named `hostnames` will configure the following iptables rules.

```bash
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

## Pod cannot access itself through Service

This is usually caused by hairpin configuration errors, which can be configured through the `--hairpin-mode` option of Kubelet. Optional parameters include "promiscuous-bridge", "hairpin-veth", and "none" (default is "promiscuous-bridge").

For the hairpin-veth mode, you can confirm if it takes effect with the following command:

```bash

for intf in /sys/devices/virtual/net/cbr0/brif/*; do cat $intf/hairpin_mode; done

```

And for the promiscuous-bridge mode, you can confirm if it takes effect with the following command:

```bash

$ ifconfig cbr0 |grep PROMISC

UP BROADCAST RUNNING PROMISC MULTICAST MTU:1460 Metric:1

```

## Unable to access Kubernetes API

Many extension services need to access the Kubernetes API to query the required data (such as kube-dns, Operator, etc.). Usually, when unable to access the Kubernetes API, you can first verify that the Kubernetes API is functioning properly using the following command:

```bash
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

If a timeout error occurs, further confirmation is needed to ensure that the service named `kubernetes` and the list of endpoints are normal.

```bash
$ kubectl get service kubernetes
NAME         TYPE        CLUSTER-IP   EXTERNAL-IP   PORT(S)   AGE
kubernetes   ClusterIP   10.96.0.1    <none>        443/TCP   25m
$ kubectl get endpoints kubernetes
NAME         ENDPOINTS          AGE
kubernetes   172.17.0.62:6443   25m
```

Then you can directly access the endpoints to check if kube-apiserver can be accessed normally. If it cannot be accessed, it usually means that kube-apiserver is not started properly or there are firewall rules blocking the access.

However, if a `403 - Forbidden` error occurs, it indicates that the Kubernetes cluster has enabled access authorization control (such as RBAC). In this case, you need to create roles and role bindings for the ServiceAccount used by Pods to authorize access to the required resources. For example, CoreDNS needs to create the following ServiceAccount and role binding:

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

## Kernel Problems

In addition to the above issues, there may also be errors in accessing services or timeouts caused by kernel problems, such as:

* [Failure to allocate ports for SNAT due to not setting `--random-fully`, resulting in service access timeout](https://tech.xing.com/a-reason-for-unexplained-connection-timeouts-on-kubernetes-docker-abd041cf7e02). Note that Kubernetes currently does not have the `--random-fully` option set for SNAT. If you encounter this issue, you can refer to [here](https://gist.github.com/maxlaverse/1fb3bfdd2509e317194280f530158c98) for configuration.

## References

* [Troubleshoot Applications](https://kubernetes.io/docs/tasks/debug-application-cluster/debug-application/)
* [Debug Services](https://kubernetes.io/docs/tasks/debug-application-cluster/debug-service/)
