# Kubeadm - Your one-click gateway to Kubernetes deployment

Are you looking to deploy Kubernetes using Docker runtime? Then look no further, as kubeadm is your go-to solution. It streamlines the process of setting up a Kubernetes cluster by using automation scripts. Let's walk through it together.

To kick off with the process, clone the ops repository from GitHub [1]. From the cloned repo, run the installation script for Kubernetes. Remember to set `USE_MIRROR=true` if you're setting this up in mainland China. Make sure to note down the console output of TOKEN and MASTER IP address, you will need these for installation on other nodes.

So far so good, right? Now, let's move to the nodes, repeating the above process for each of them. Don't forget to set up the TOKEN, MASTER_IP, and CONTAINER_CIDR (Container Network Interface, part of the Kubernetes ecosystem that assigns IP addresses to Kubernetes objects) specific to your setup.

Next, we will cover detailed steps on deploying a Kubernetes cluster using kubeadm.

## System initialization

Whether you're running on Ubuntu or CentOS, you first need to initialize Docker and kubelet (the primary "node agent" that runs on each worker node in Kubernetes) on all your machines. Then you run commands to install Docker and Kubernetes.

## Setting up the Master

Having done the initial setup, now is the time to initiate the master node. If you want to customize your Kubernetes service options (and you're the type of user who likes to refine things), you can do that too! We use a YAML file that lists all the configuration options to achieve this.

If you choose to create kubeadm configuration file, specify the path of this YAML file while initializing the master:

```bash
kubeadm init --config ./kubeadm.yaml
```

## Network Plugin Configuration

We offer configuration details for multiple options: CNI bridge, Flannel, Weave and Calico. Remember to set `--pod-network-cidr` according to the network plugin.

## Adding the Node

To add a node to your cluster, run the `kubeadm join` command. Remember to replace `<token>`, `<master-ip>`, and `<master-port>` with your setup values.

Just as with the Master, when adding a Node you have the option of customizing your Kubernetes service options. You can specify the NodeConfiguration configuration file path when you're adding the Node to the cluster:

```bash
kubeadm join --config ./nodeconfig.yml --token $token ${master_ip}
```

## Cloud Provider

By default, kubeadm doesn’t include the Cloud Provider configuration. Therefore, when running on cloud platforms like Azure or AWS, you'll need to configure the Cloud Provider.

## Uninstalling

To uninstall, you first need to drain and delete the respective node and then reset kubeadm.

## Upgrading

Moving on to the dynamic upgrade, with support starting from kubeadm v1.8. The process involves uploading the kubeadm configuration, checking for newer versions on the master, and then issuing an upgrade command. For example, if a newer version v1.8.0 is available, execute `kubeadm upgrade apply v1.8.0` to upgrade the control plane. 

With manual upgrading, note that versions prior to kubeadm v1.7 don't support dynamic upgrading. 

## Security Options

By default, kubeadm enables automatic approval for Node client certificates. If you don't need them, you can opt to turn this off.

## References

1. [Kubeadm Reference Guide](https://kubernetes.io/docs/admin/kubeadm/)
2. [Upgrading kubeadm clusters from v1.14 to v1.15](https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-upgrade-1-15/)