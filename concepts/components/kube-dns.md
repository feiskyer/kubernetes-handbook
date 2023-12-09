# All About kube-dns

The DNS service is one of the essentials in the Kubernetes world, and it's facilitated through kube-dns or CoreDNS as crucial extensions of the Kubernetes cluster.

## CoreDNS: Efficiency at its best

Starting from version v1.11, [CoreDNS](https://coredns.io/) has been available to furnish the vital DNS services, and it took the mantle as the default DNS service from v1.13. CoreDNS checks off all the boxes when it comes to efficiency and less resource usage. Thus, the shift from using kube-dns to CoreDNS in delivering DNS services to the cluster is highly recommended.

Upgrading from kube-dns to CoreDNS: Here's how you can do it:

```bash
$ git clone https://github.com/coredns/deployment
$ cd deployment/kubernetes
$ ./deploy.sh | kubectl apply -f -
$ kubectl delete --namespace=kube-system deployment kube-dns
```

For a fresh deployment, you can follow the CoreDNS extension configuration method [right here](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/dns). 

## DNS formats supported

* Service
  * A record: Generates `my-svc.my-namespace.svc.cluster.local`. IP resolving takes two forms
    * For a standard service, it resolves to Cluster IP
    * For a headless service, it resolves to a list of specified Pod IPs 
  * SRV record: Generates `_my-port-name._my-port-protocol.my-svc.my-namespace.svc.cluster.local`
* Pod
  * A record: `pod-ip-address.my-namespace.pod.cluster.local`
  * Specified hostname and subdomain: `hostname.custom-subdomain.default.svc.cluster.local`. Check out an example shown below:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: busybox2
  labels:
    name: busybox
spec:
  hostname: busybox-2
  subdomain: default-subdomain
  containers:
  - image: busybox
    command:
      - sleep
      - "3600"
    name: busybox
```

![](../../.gitbook/assets/dns-demo%20%283%29.png)

## Configuring Private DNS Servers and Upstream DNS Servers

Beginning with Kubernetes 1.6, customization of stub domains and upstream name servers got easier by providing a ConfigMap for kube-dns. The configuration below introduces a standalone private root DNS server and two upstream DNS servers. 

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: kube-dns
  namespace: kube-system
data:
  stubDomains: |
    {“acme.local”: [“1.2.3.4”]}
  upstreamNameservers: |
    [“8.8.8.8”, “8.8.4.4”]
```

Upon using the above configuration, query requests will first be sent to the DNS cache layer of kube-dns (Dnsmasq server). The Dnsmasq server checks the suffix of the request first. Requests with a cluster suffix (such as: ”.cluster.local”) will be sent to kube-dns, names with a stub domain suffix (like: ”.acme.local”) will be dispatched to the configured private DNS server [“1.2.3.4”]. Finally, requests that do not satisfy any of these suffixes will be sent to the upstream DNS [“8.8.8.8”, “8.8.4.4”].

![](../../.gitbook/assets/kube-dns-upstream%20%282%29.png)

## kube-dns: At the heart of Kubernetes

### Starting a kube-dns example

Generally, the DNS service is deployed as an expansion. This can be done by adding the [kube-dns.yaml](https://github.com/feiskyer/kubernetes-handbook/raw/master/manifests/kubedns/kube-dns.yaml) to the `/etc/kubernetes/addons` directory of the Master node. Of course, manual deployment is also an option:

```bash
kubectl apply -f https://github.com/feiskyer/kubernetes-handbook/raw/master/manifests/kubedns/kube-dns.yaml
```

This will initiate a Pod containing three containers in Kubernetes, running three DNS-related services:

```bash
# kube-dns container
kube-dns --domain=cluster.local. --dns-port=10053 --config-dir=/kube-dns-config --v=2

# dnsmasq container
dnsmasq-nanny -v=2 -logtostderr -configDir=/etc/k8s/dns/dnsmasq-nanny -restartDnsmasq=true -- -k --cache-size=1000 --log-facility=- --server=127.0.0.1#10053

# sidecar container
sidecar --v=2 --logtostderr --probe=kubedns,127.0.0.1:10053,kubernetes.default.svc.cluster.local.,5,A --probe=dnsmasq,127.0.0.1:53,kubernetes.default.svc.cluster.local.,5,A
```

Kubernetes v1.10 also supports the Beta version of CoreDNS, which outperforms kube-dns. Deployment can be done via extension by adding [coredns.yaml](https://github.com/feiskyer/kubernetes-handbook/blob/master/manifests/kubedns/coredns.yaml) to the `/etc/kubernetes/addons` directory on the Master node. Of course, manual deployment is another option:

```bash
kubectl apply -f https://github.com/feiskyer/kubernetes-handbook/raw/master/manifests/kubedns/coredns.yaml
```

### kube-dns: Behind the scenes

As shown below, kube-dns consists of three main components:

* kube-dns: The heart of the DNS service, mainly composed of KubeDNS and SkyDNS
  * KubeDNS listens to the changes in Service and Endpoint and updates related information in SkyDNS
  * SkyDNS is responsible for DNS resolution, listening on ports 10053 (tcp/udp) and 10055 for metrics
  * kube-dns also listens on port 8081 for health checks
* dnsmasq-nanny: Manages dnsmasq and restarts it when the configuration changes 
  * The upstream of dnsmasq is SkyDNS, meaning the internal DNS resolution of the cluster is handled by SkyDNS 
* sidecar: Looks after health checks and provides DNS metrics (listening on port 10054)

![](../../.gitbook/assets/kube-dns%20%284%29.png)

### An introduction to the source code

The kube-dns code has been separated from Kubernetes and can now be found at [https://github.com/kubernetes/dns](https://github.com/kubernetes/dns).

The code for kube-dns, dnsmasq-nanny, and sidecar starts from `cmd/<cmd-name>/main.go` respectively and calls `pkg/dns`, `pkg/dnsmasq`, and `pkg/sidecar` to perform respective functions. The core DNS resolution directly refers to the code in `github.com/skynetservices/skydns/server`, the specific implementation can be seen at [skynetservices/skydns](https://github.com/skynetservices/skydns/tree/master/server).

## Frequently Asked Questions

**Issues with DNS Resolution in Ubuntu 18.04** 

Ubuntu 18.04 has been configured to activate systemd-resolved by default. This writes `nameserver 127.0.0.53` into the system's /etc/resolv.conf. As this is a local address, it can cause CoreDNS or kube-dns to fail when resolving external addresses.

To fix this issue, replace the resolv.conf file generated by systemd-resolved:

```bash
sudo rm /etc/resolv.conf
sudo ln -s /run/systemd/resolve/resolv.conf /etc/resolv.conf
```

Or, manually specify the path to the resolv.conf for the DNS service:

```bash
--resolv-conf=/run/systemd/resolve/resolv.conf
```

## References

* [Introduction to dns-pod-service](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/)
* [coredns/coredns](https://github.com/coredns/coredns)