# GlusterFS Brings High-Performance Storage to Kubernetes

Let’s leverage our existing three-node Kubernetes cluster to create a high-performance GlusterFS storage system.

## Setting Up GlusterFS

Setting up is straightforward on physical machines with `yum`. If you are integrating with Kubernetes, refer to the guidelines [here](https://github.com/gluster/gluster-kubernetes/blob/master/docs/setup-guide.md).

```bash
# First, install the Gluster repository
$ yum install centos-release-gluster -y

# Install various GlusterFS components
$ yum install -y glusterfs glusterfs-server glusterfs-fuse glusterfs-rdma glusterfs-geo-replication glusterfs-devel

## Create a GlusterFS directory
$ mkdir /opt/glusterd

## Update the GlusterFS directory path
$ sed -i 's/var\/lib/opt/g' /etc/glusterfs/glusterd.vol

# Start the GlusterFS service
$ systemctl start glusterd.service

# Set the service to launch on boot
$ systemctl enable glusterd.service

# Check its status
$ systemctl status glusterd.service
```

## Configuring GlusterFS

```bash
# Set up hosts

$ vi /etc/hosts
172.20.0.113   sz-pg-oam-docker-test-001.tendcloud.com
172.20.0.114   sz-pg-oam-docker-test-002.tendcloud.com
172.20.0.115   sz-pg-oam-docker-test-003.tendcloud.com
```

```bash
# Open necessary ports
$ iptables -I INPUT -p tcp --dport 24007 -j ACCEPT

# Create a storage directory
$ mkdir /opt/gfs_data
```

```bash
# Add nodes to the cluster
# Note: the current machine does not need to probe itself
[root@sz-pg-oam-docker-test-001 ~]#
gluster peer probe sz-pg-oam-docker-test-002.tendcloud.com
gluster peer probe sz-pg-oam-docker-test-003.tendcloud.com

# View the cluster status
$ gluster peer status
Number of Peers: 2

Hostname: sz-pg-oam-docker-test-002.tendcloud.com
Uuid: f25546cc-2011-457d-ba24-342554b51317
State: Peer in Cluster (Connected)

Hostname: sz-pg-oam-docker-test-003.tendcloud.com
Uuid: 42b6cad1-aa01-46d0-bbba-f7ec6821d66d
State: Peer in Cluster (Connected)
```

## Configuring Volumes

GlusterFS supports various volume configurations:

* **Distributed Volume (Default)**: Files are distributed across server nodes using a hash algorithm.
* **Replicated Volume**: Files are replicated across a certain number of nodes.
* **Striped Volume**: Files are split into blocks and spread out across nodes (similar to RAID 0).
* **Distributed Striped Volume**: Requires at least four servers and combines features of Distributed and Striped volumes.
* **Distributed Replicated Volume**: Requires at least four servers and combines features of Distributed and Replicated volumes.
* **Striped Replicated Volume**: Requires at least four servers and combines features of Striped and Replicated volumes.
* **Hybrid of all three modes**: Requires at least eight servers.

For visual examples, see [GlusterFS Documentation](https://docs.gluster.org/en/latest/Quick-Start-Guide/Architecture/#types-of-volumes).

Since we have only three hosts, we’ll use the **default Distributed Volume** mode, **but be warned—this mode should not be used in a production environment as it can lead to data loss**.

```bash
# Create a Distributed Volume
$ gluster volume create k8s-volume transport tcp sz-pg-oam-docker-test-001.tendcloud.com:/opt/gfs_data sz-pg-oam-docker-test-002.tendcloud.com:/opt/gfs_data sz-pg-oam-docker-test-003.tendcloud.com:/opt/gfs_data force

# Check the volume status
$ gluster volume info

# Start the Distributed Volume
$ gluster volume start k8s-volume
```

## Tuning GlusterFS

```bash
# Enable quota for a specific volume
$ gluster volume quota k8s-volume enable

# Set a usage limit for the volume
$ gluster volume quota k8s-volume limit-usage / 1TB

# Specify the cache size, default is 32MB
$ gluster volume set k8s-volume performance.cache-size 4GB

# Configure I/O threads, excessive numbers can cause crashes
$ gluster volume set k8s-volume performance.io-thread-count 16

# Set network ping timeout, default is 42 seconds
$ gluster volume set k8s-volume network.ping-timeout 10

# Configure write-behind buffer size, default is 1MB
$ gluster volume set k8s-volume performance.write-behind-window-size 1024MB
```

## Using GlusterFS in Kubernetes

Official documentation can be found [here](https://github.com/kubernetes/examples/tree/master/staging/volumes/glusterfs).

All necessary yaml and json configuration files to proceed are available in the [GlusterFS repository](https://github.com/feiskyer/kubernetes-handbook/tree/master/manifests/glusterfs). Remember to replace any private image URLs with your own.

## Installing the Client in Kubernetes

```bash
# Install the GlusterFS client on all k8s nodes
$ yum install -y glusterfs glusterfs-fuse

# Configure hosts again
$ vi /etc/hosts
172.20.0.113   sz-pg-oam-docker-test-001.tendcloud.com
172.20.0.114   sz-pg-oam-docker-test-002.tendcloud.com
172.20.0.115   sz-pg-oam-docker-test-003.tendcloud.com
```

Since our GlusterFS is sharing hosts with our Kubernetes cluster, this step can be skipped.

## Configuring Endpoints

```bash
$ curl -O https://raw.githubusercontent.com/kubernetes/kubernetes/master/examples/volumes/glusterfs/glusterfs-endpoints.json

# Edit endpoints.json to specify the Gluster cluster node IPs

# Import the glusterfs-endpoints.json
$ kubectl apply -f glusterfs-endpoints.json

# View endpoint info
$ kubectl get ep
```

## Configuring Services

```bash
$ curl -O https://raw.githubusercontent.com/kubernetes/kubernetes/master/examples/volumes/glusterfs/glusterfs-service.json

# The glusterfs-service.json seeks the name and port from the endpoints; I changed the default port to 1990.

# Import the glusterfs-service.json
$ kubectl apply -f glusterfs-service.json

# Check the service info
$ kubectl get svc
```

## Deploying a Test Pod

```bash
$ curl -O https://github.com/kubernetes/examples/raw/master/staging/volumes/glusterfs/glusterfs-pod.json

# Adjust the "path" in glusterfs-pod.json to the name of the volume you created

"path": "k8s-volume"

# Deploy the glusterfs-pod.json
$ kubectl apply -f glusterfs-pod.json

# Check the pods' status
$ kubectl get pods

# Confirm the mount from the node's physical machine
$ df -h
```

## Configuring Persistent Volume

PersistentVolume (PV) and PersistentVolumeClaim (PVC) abstract storage details, letting admins provide storage independently of user consumption. The PVC-PV relationship is analogous to pods consuming node resources.

**PV Attributes**

- Storage capacity
- Access modes: ReadWriteOnce (single node R/W), ReadOnlyMany (multi-node read), ReadWriteMany (multi-node R/W)

```bash
# Apply the PV configuration
$ kubectl apply -f glusterfs-pv.yaml

# Check the PV
$ kubectl get pv
```

PVC Attributes

- Access modes matching PV
- Requested capacity must be less than or equal to the PV capacity

## Configuring PVC

```bash
# Deploy the PVC configuration
$ kubectl apply -f glusterfs-pvc.yaml

# Check the PVC
$ kubectl get pvc
```

## Deploying an Nginx Deployment Using the Volume

```bash
# Apply the Nginx deployment configuration
$ kubectl apply -f nginx-deployment.yaml

# Check the deployment
$ kubectl get pods | grep nginx-dm

# Verify the mounts and test file creation
```

**References**

- [Installing GlusterFS on CentOS 7](http://www.cnblogs.com/jicki/p/5801712.html)
- [GlusterFS Kubernetes Integration](https://github.com/gluster/gluster-kubernetes)

---

**Rephrased for Popular Science Magazine Style:**

# Unleashing the Power of GlusterFS for Kubernetes Data Mastery

Imagine transforming your humble three-node Kubernetes playground into a powerhouse of data storage—a feat achievable through the magic of GlusterFS.

## GlusterFS: The Simple Install That Packs a Punch

Fear not the terminal window, for with a flick of the `yum` wand, GlusterFS rises on your machines. If you mean to weave it with Kubernetes, the spell books are laid out [here](https://github.com/gluster/gluster-kubernetes/blob/master/docs/setup-guide.md).

Installation is a few incantations away:

```bash
# Chant to conjure the Gluster repository
# More spells follow to breathe life into various components

# Commanding Gluster to start and wake up with the server
# Peeking into its wakefulness whenever you wish
```

## Gluster’s realm: A Cozy Cluster of Companions

Gluster thrives on friendship and communication among nodes. Name them, open paths for conversation and behold the growing list of peers in this circle of data trust.

## Crafting Volumes: Gluster's Variety of Secret Formulas

Choose wisely from Gluster's trove of volume concoctions – distributed, replicated, striped. Each with its own charm. Here we stick with the default brew – it’s simple, but beware of its fragile nature for anything but the lightest of duties.

Starting this volume is but a simple command:

```bash
# Create and witness the status of our data sanctum
# Embark upon the data-sharing journey
```

## GlusterFS: Sharpening Itself for Peak Performance

Yes, Gluster seeks to be more, through thresholds and caches, I/O threads and time-outs, buffs to its capabilities.

```bash
# Codes to mold Gluster into the speedy goblin we desire
# Experiment with your own mixtures for the best potion strength
```

## Onwards to Kubernetes: Uniting Kingdoms of Containers and Storage

The official scrolls provide insights [here](https://github.com/kubernetes/examples/tree/master/staging/volumes/glusterfs). The vessels for configuration await in the [repository](https://github.com/feiskyer/kubernetes-handbook/tree/master/manifests/glusterfs), ripe for personalization.

## Gluster's Tales in Kubernetes Lands

Since our tale intertwines Gluster with Kubernetes, some steps are taken care of by the story so far. Should you ever need them, the pages are right there.

## The Rituals to Summon Endpoints and Services

```
# Enchantments to connect the dots of our Gluster family
# Service oaths look for specific names and ports, so attention to detail is key
```

## Test Pods: The Pageant of Harmony

```
# Nodes welcoming the new volume's embrace, verifying it through the looking glass of `df`
```

## Building Persistency: The Lexicon of Kubernetes Storage Arts

Kubernetes offers PV and PVC, akin to vaults and keys, a system separating the responsibilities between those who hold storage powers and those who seek to fill their chambers with data.

**Ingredients for Everlasting Volumes:**

Volume capacity grows and access modes range from sole sovereign to a multitude's communal use:

```bash
# Evoke a persistent volume and confirm its existence
```

PVCs ask for storage up to the holds of the PVs:

## Crafting PVCs: The Other Half of Constancy

```bash
# Sow the seeds for a claim on the volumes
# Gaze upon your claims laid bare
```

## Nginx Deployment: The Grand Stage for Gluster’s Performance

```bash
# Align the stars for your Nginx deployment
# Behold the pods akin to loyal knights bearing the gluster flag
```

And there you have it—GlusterFS, not just a storage solution, but an epic saga of speed, versatility, and robustness, all within the mighty kingdom of Kubernetes.