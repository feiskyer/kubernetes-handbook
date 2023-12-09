# Kubespray

[Kubespray](https://github.com/kubernetes-incubator/kubespray) is a project under the Kubernetes incubator. Its mission is to provide a production-ready Kubernetes deployment solution. The project is based on Ansible Playbook to define system and Kubernetes cluster deployment tasks, with the following characteristics:

* It can be deployed on AWS, GCE, Azure, OpenStack, and bare metal.
* It allows for the deployment of highly available Kubernetes clusters.
* It is composable, allowing users to choose Network Plugin (flannel, calico, canal, weave) for deployment.
* It supports various Linux distributions (CoreOS, Debian Jessie, Ubuntu 16.04, CentOS/RHEL7).

This article will explain how to deploy Kubernetes to bare metal nodes using Kubespray. The versions will be as follows:

* Kubernetes v1.7.3
* Etcd v3.2.4
* Flannel v0.8.0
* Docker v17.04.0-ce

## Node Information

The operating system for the installation test environment will be Ubuntu 16.04 Server and the other details are as follows:

| IP Address | Role | CPU | Memory |
| :--- | :--- | :--- | :--- |
| 192.168.121.179 | master1 + deploy | 2 | 4G |
| 192.168.121.106 | node1 | 2 | 4G |
| 192.168.121.197 | node2 | 2 | 4G |
| 192.168.121.123 | node3 | 2 | 4G |

> Here, the master is the primary control node, and the node is the work node.

## Preparatory Information

* All nodes' networks can communicate with each other.
* The deployment node (here, master1) can log in to other nodes without needing SSH passwords.
* All nodes possess Sudoer permissions and don't require password input.
* All nodes need to have Python installed.
* All nodes need to set `/etc/hosts` to resolve all hosts.
* Modify all nodes' `/etc/resolv.conf` 

```bash
$ echo "nameserver 8.8.8.8" | sudo tee /etc/resolv.conf
```

* The deployment node (here, master1) installs Ansible >= 2.3.0.

The process for installing Ansible on Ubuntu 16.04 is as follows:

```bash
$ sudo sed -i 's/us.archive.ubuntu.com/tw.archive.ubuntu.com/g' /etc/apt/sources.list
$ sudo apt-get install -y software-properties-common
$ sudo apt-add-repository -y ppa:ansible/ansible
$ sudo apt-get update && sudo apt-get install -y ansible git cowsay python-pip python-netaddr libssl-dev
```

## Installing Kubespray and Preparing Deployment Information

First, install kubespray-cli through pypi. Although the official sources say they have switched to a Go language version of the tool, it hasn't been updated, so we'll use the pypi version for now:

```bash
$ sudo pip install -U kubespray
```

After installation, add a configuration file `~/.kubespray.yml` and include the following content:

```bash
$ cat <<EOF> ~/.kubespray.yml
kubespray_git_repo: "https://github.com/kubernetes-incubator/kubespray.git"
# Logging options
loglevel: "info"
EOF
```

Then use the kubespray cli to generate an inventory file:

```bash
$ kubespray prepare --masters master1 --etcds master1 --nodes node1 node2 node3
```

Add some content in the inventory.cfg:

```text
$ vim ~/.kubespray/inventory/inventory.cfg

[all]
master1  ansible_host=192.168.121.179   ansible_user=root ip=192.168.121.179
node1    ansible_host=192.168.121.106 ansible_user=root ip=192.168.121.106
node2    ansible_host=192.168.121.197 ansible_user=root ip=192.168.121.197
node3    ansible_host=192.168.121.123 ansible_user=root ip=192.168.121.123

[kube-master]
master1

[kube-node]
node1
node2
node3

[etcd]
master1

[k8s-cluster:children]
kube-node
kube-master
```

> You can also create a new `inventory` to describe the deployment nodes.

After completing the above, execute the following command to deploy the Kubernetes cluster:

```bash
$ time kubespray deploy --verbose -u root -k .ssh/id_rsa -n flannel
Run kubernetes cluster deployment with the above command ? [Y/n]y
...
master1                    : ok=368  changed=89   unreachable=0    failed=0
node1                      : ok=305  changed=73   unreachable=0    failed=0
node2                      : ok=276  changed=62   unreachable=0    failed=0
node3                      : ok=276  changed=62   unreachable=0    failed=0

Kubernetes deployed successfully
```

> The `-n` refers to the type of network plugin to be deployed, currently supporting calico, flannel, weave, and canal.

## Verifying the Cluster

After Ansible has run, if no errors have occurred, you can start operating the Kubernetes, such as obtaining version information:

```bash
$ kubectl version
Client Version: version.Info{Major:"1", Minor:"6", GitVersion:"v1.7.3+coreos.0", GitCommit:"9212f77ed8c169a0afa02e58dce87913c6387b3e", GitTreeState:"clean", BuildDate:"2017-04-04T00:32:53Z", GoVersion:"go1.8.3", Compiler:"gc", Platform:"linux/amd64"}
Server Version: version.Info{Major:"1", Minor:"6", GitVersion:"v1.7.3+coreos.0", GitCommit:"9212f77ed8c169a0afa02e58dce87913c6387b3e", GitTreeState:"clean", BuildDate:"2017-04-04T00:32:53Z", GoVersion:"go1.8.3", Compiler:"gc", Platform:"linux/amd64"}
```

Get the current cluster node status:

```bash
$ kubectl get node
NAME      STATUS                     AGE       VERSION
master1   Ready,SchedulingDisabled   11m       v1.7.3+coreos.0
node1     Ready                      11m       v1.7.3+coreos.0
node2     Ready                      11m       v1.7.3+coreos.0
node3     Ready                      11m       v1.7.3+coreos.
```

Check the current cluster Pod status:

```bash
$ kubectl get po -n kube-system
NAME                                  READY     STATUS    RESTARTS   AGE
dnsmasq-975202658-6jj3n               1/1       Running   0          14m
dnsmasq-975202658-h4rn9               1/1       Running   0          14m
dnsmasq-autoscaler-2349860636-kfpx0   1/1       Running   0          14m
flannel-master1                       1/1       Running   1          14m
flannel-node1                         1/1       Running   1          14m
flannel-node2                         1/1       Running   1          14m
flannel-node3                         1/1       Running   1          14m
kube-apiserver-master1                1/1       Running   0          15m
kube-controller-manager-master1       1/1       Running   0          15m
kube-proxy-master1                    1/1       Running   1          14m
kube-proxy-node1                      1/1       Running   1          14m
kube-proxy-node2                      1/1       Running   1          14m
kube-proxy-node3                      1/1       Running   1          14m
kube-scheduler-master1                1/1       Running   0          15m
kubedns-1519522227-thmrh              3/3       Running   0          14m
kubedns-autoscaler-2999057513-tx14j   1/1       Running   0          14m
nginx-proxy-node1                     1/1       Running   1          14m
nginx-proxy-node2                     1/1       Running   1          14m
nginx-proxy-node3                     1/1       Running   1          14m
```
