# LinuxKit

LinuxKit offers a minimal, immutable Linux framework built on containers. To get a taste of what it can do, check out the simple introduction on [LinuxKit's GitHub page](https://github.com/linuxkit/linuxkit). In this discussion, we'll be using LinuxKit to build a Kubernetes image and deploy a simple Kubernetes cluster.

![](<../../.gitbook/assets/moby+kubernetes (1) (4).png>)

This step-by-step guide operates in the `Mac OS X` environment. The components we'll use are:

* Kubernetes v1.7.2
* Etcd v3
* Weave
* Docker v17.06.0-ce

## Preliminary Needs

Before we begin, we need to ensure that:

* `Docker` has been installed and activated on the host system.
* `Git` has been installed on the host.
* The LinuxKit project has been downloaded on the host, we have built Moby and LinuxKit tools.

Here are the commands for creating Moby and LinuxKit:

```bash
$ git clone https://github.com/linuxkit/linuxkit.git
$ cd linuxkit
$ make
$ ./bin/moby version
moby version 0.0
commit: c2b081ed8a9f690820cc0c0568238e641848f58f

$ ./bin/linuxkit version
linuxkit version 0.0
commit: 0e3ca695d07d1c9870eca71fb7dd9ede31a38380
```

## Building a Kubernetes System Image

First, we need to create a Linux system that comes pre-packaged with Kubernetes. Luckily there's already an example provided by the authorities. The following steps will guide you through the building process:

```bash
$ cd linuxkit/projects/kubernetes/
$ make build-vm-images
...
Create outputs:
  kube-node-kernel kube-node-initrd.img kube-node-cmdline
```

## Deploying a Kubernetes Cluster

Once the image is ready, we can use the following command to start the Master OS and fetch its IP address:

```bash
$ ./boot.sh

(ns: getty) linuxkit-025000000002:~\# ip addr show dev eth0
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP qlen 1000
    link/ether 02:50:00:00:00:02 brd ff:ff:ff:ff:ff:ff
    inet 192.168.65.3/24 brd 192.168.65.255 scope global eth0
       valid_lft forever preferred_lft forever
    inet6 fe80::abf0:9fa4:d0f4:8da2/64 scope link
       valid_lft forever preferred_lft forever
```

After it has started, open a new console to SSH into the Master and initialize it with kubeadm:

```bash
$ cd linuxkit/projects/kubernetes/
$ ./ssh_into_kubelet.sh 192.168.65.3
linuxkit-025000000002:/\# kubeadm-init.sh
...
kubeadm join --token 4236d3.29f61af661c49dbf 192.168.65.3:6443
```

Once kubeadm is finished, you will see a Token. Please remember this Token information. Next, open another console and run the command to initiate the Node:

```bash
console1>$ ./boot.sh 1 --token 4236d3.29f61af661c49dbf 192.168.65.3:6443
```

Note: To initialize nodes, follow the format `./boot.sh <n> [<join_args> ...]`.

Next, open two additional consoles to join the cluster:

```bash
console2> $ ./boot.sh 2 --token 4236d3.29f61af661c49dbf 192.168.65.3:6443
console3> $ ./boot.sh 3 --token 4236d3.29f61af661c49dbf 192.168.65.3:6443
```

After completing the above, go back to the Master node and run the following command to check the status of the nodes:

```bash
$ kubectl get no
NAME                    STATUS    AGE       VERSION
linuxkit-025000000002   Ready     16m       v1.7.2
linuxkit-025000000003   Ready     6m        v1.7.2
linuxkit-025000000004   Ready     1m        v1.7.2
linuxkit-025000000005   Ready     1m        v1.7.2
```

## Deploying a Simple Nginx Service

Kubernetes lets you build applications and services directly using instructions, or design app deployment configurations using YAML and JSON files. Let's spin up a simple Nginx service:

```bash
$ kubectl run nginx --image=nginx --replicas=1 --port=80
$ kubectl get pods -o wide
NAME                     READY     STATUS    RESTARTS   AGE       IP          NODE
nginx-1423793266-v0hpb   1/1       Running   0          38s       10.42.0.1   linuxkit-025000000004
```

After that, we will create a Service(svc) to provide external network access to the app:

```bash
$ kubectl expose deploy nginx --port=80 --type=NodePort
$ kubectl get svc
NAME         CLUSTER-IP      EXTERNAL-IP   PORT(S)        AGE
kubernetes   10.96.0.1       <none>        443/TCP        19m
nginx        10.108.41.230   <nodes>       80:31773/TCP   5s
```

Since our deployment isn't on physical machines but uses Docker namespace networking, we will need to use `ubuntu-desktop-lxde-vnc` to view the Nginx app:

```bash
$ docker run -it --rm -p 6080:80 dorowu/ubuntu-desktop-lxde-vnc
```

After that, connect to HTML VNC via the browser at `http://localhost:6080`.

![](<../../.gitbook/assets/docker-desktop (3).png>)

Finally, to shut down nodes just execute the following:

```bash
$ halt
[1503.034689] reboot: Power down
```

If you've followed these steps, congratulations! You've built and deployed your own Kubernetes cluster with LinuxKit!
