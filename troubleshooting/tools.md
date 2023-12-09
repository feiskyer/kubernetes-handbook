# Trouble-shooting Tools Galore

The chapter mainly introduces the tools frequently used in troubleshooting in Kubernetes.

## Essential Tools

* `kubectl`: This is used to inspect the status of both Kubernetes clusters and containers, such as `kubectl describe pod <pod-name>`.
* `journalctl`: This tool is used to peruse logs of Kubernetes components, using commands like `journalctl -u kubelet -l`.
* `iptables` and `ebtables`: These are used to troubleshoot whether a Service is working, such as with `iptables -t nat -nL`, which checks if the iptables rules configured by kube-proxy are working properly.
* `tcpdump`: This is used to troubleshoot issues pertaining to container networks, using commands like `tcpdump -nn host 10.240.0.8`.
* `perf`: A performance analysis tool that comes with the Linux kernel, this is often used to troubleshoot performance issues, such as the issue mentioned in [Container Isolation Gone Wrong](https://dzone.com/articles/container-isolation-gone-wrong).

## kubectl-node-shell

To check the logs of system components like Kubelet, CNI, kernel, and so on, you need to first SSH into the Node. It is recommended to use the [kubectl-node-shell](https://github.com/kvaps/kubectl-node-shell) plugin instead of assigning a public IP address to every node.

```bash
curl -LO https://github.com/kvaps/kubectl-node-shell/raw/master/kubectl-node_shell
chmod +x ./kubectl-node_shell
sudo mv ./kubectl-node_shell /usr/local/bin/kubectl-node_shell

kubectl node-shell <node>
journalctl -l -u kubelet
```

## sysdig

sysdig is a troubleshooting tool for containers and comes in both open-source and commercial editions. For regular troubleshooting, the open-source version will suffice.

Aside from sysdig, two other auxiliary tools can be used:

* csysdig: This is automatically installed with sysdig and offers a Command Line Interface (CLI).
* [sysdig-inspect](https://github.com/draios/sysdig-inspect): This provides a graphical interface (non-real time) for trace files saved by sysdig, such as with `sudo sysdig -w filename.scap`.

### Installation

```bash
# On Ubuntu
curl -s https://s3.amazonaws.com/download.draios.com/DRAIOS-GPG-KEY.public | apt-key add -
curl -s -o /etc/apt/sources.list.d/draios.list http://download.draios.com/stable/deb/draios.list
apt-get update
apt-get -y install linux-headers-$(uname -r)
apt-get -y install sysdig

# On REHL
rpm --import https://s3.amazonaws.com/download.draios.com/DRAIOS-GPG-KEY.public
curl -s -o /etc/yum.repos.d/draios.repo http://download.draios.com/stable/rpm/draios.repo
rpm -i http://mirror.us.leaseweb.net/epel/6/i386/epel-release-6-8.noarch.rpm
yum -y install kernel-devel-$(uname -r)
yum -y install sysdig

# On MacOS
brew install sysdig
```

### Examples

```bash
# Refer to https://www.sysdig.org/wiki/sysdig-examples/.
# View the top network connections
sudo sysdig -pc -c topconns
# View the top network connections within the wordpress1 container
sudo sysdig -pc -c topconns container.name=wordpress1

# Show the network data exchanged with the host 192.168.0.1
sudo sysdig fd.ip=192.168.0.1
sudo sysdig -s2000 -A -c echo_fds fd.cip=192.168.0.1

# List all incoming connections that are not served by Apache.
sudo sysdig -p"%proc.name %fd.name" "evt.type=accept and proc.name!=httpd"

# View the CPU/Network/IO usage of processes running within a container.
sudo sysdig -pc -c topprocs_cpu container.id=2e854c4525b8
sudo sysdig -pc -c topprocs_net container.id=2e854c4525b8
sudo sysdig -pc -c topfiles_bytes container.id=2e854c4525b8

# See the files where Apache spends most of its I/O time
sudo sysdig -c topfiles_time proc.name=httpd

# Show all interactive commands executed within a certain container.
sudo sysdig -pc -c spy_users 

# Show every time a file is opened under /etc.
sudo sysdig evt.type=open and fd.name

# View the list of processes with container context
sudo csysdig -pc
```

For more samples and usage methods, check out the [Sysdig User Guide](https://github.com/draios/sysdig/wiki/Sysdig-User-Guide).

## Weave Scope

Weave Scope is another container monitoring and troubleshooting tool that offers visualization. It does not come with the powerful CLI that sysdig offers, but it does have a simple-to-use interactive interface. It automatically outlines the topology of the entire cluster and its functionality can be expanded using plugins. According to its official site, the features provided by Weave Scope include:

* [Interactive topology interface](https://www.weave.works/docs/scope/latest/features/#topology-mapping)
* [Graphical mode and table mode](https://www.weave.works/docs/scope/latest/features/#mode)
* [Filtering feature](https://www.weave.works/docs/scope/latest/features/#flexible-filtering)
* [Search feature](https://www.weave.works/docs/scope/latest/features/#powerful-search)
* [Real-time metrics](https://www.weave.works/docs/scope/latest/features/#real-time-app-and-container-metrics)
* [Container troubleshooting](https://www.weave.works/docs/scope/latest/features/#interact-with-and-manage-containers)
* [Custom plugins](https://www.weave.works/docs/scope/latest/features/#custom-plugins)

Weave Scope is made up of two parts - the [App and the Probe](https://www.weave.works/docs/scope/latest/how-it-works) - which carry out different tasks:

* The Probe collects information about the containers and hosts and sends it to the App.
* The App processes this information, generates reports accordingly and presents them in the form of an interactive UI.

### Installation

```bash
kubectl apply -f "https://cloud.weave.works/k8s/scope.yaml?k8s-version=$(kubectl version | base64 | tr -d '\n')&k8s-service-type=LoadBalancer"
```

### Viewing the UI

After installation is complete, you can use weave-scope-app to view the interactive UI:

```bash
kubectl -n weave get service weave-scope-app
kubectl -n weave port-forward service/weave-scope-app :80
```

![](../.gitbook/assets/weave-scope%20%2810%29.png)

Clicking on a Pod will permit you to see real-time statuses and metrics data for all the containers in the Pod:

![](../.gitbook/assets/scope-pod%20%287%29.png)

### Known Issues

When activating `--probe.ebpf.connections` on Ubuntu kernel 4.4.0 (it is activated by default), the Node might [repeatedly restart due to kernel issues](https://github.com/weaveworks/scope/issues/3131):

```bash
[ 263.736006] CPU: 0 PID: 6309 Comm: scope Not tainted 4.4.0-119-generic #143-Ubuntu
[ 263.736006] Hardware name: Microsoft Corporation Virtual Machine/Virtual Machine, BIOS 090007 06/02/2017
[...]
```

There are two solutions for this problem:

* Disable eBPF detection with `--probe.ebpf.connections=false`.
* Upgrade the kernel, for example, to 4.13.0.

## References

* [Overview of kubectl](https://kubernetes.io/docs/reference/kubectl/overview/)
* [Monitoring Kuberietes with sysdig](https://sysdig.com/blog/kubernetes-service-discovery-docker/)