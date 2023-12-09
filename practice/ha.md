# High Availability Cluster

Since version 1.5, Kubernetes has supported the automatic deployment of a high-availability system for clusters set up with `kops` or `kube-up.sh`. This includes:

* Etcd in cluster mode
* Load balancing for the kube-apiserver
* Automatic leader election for kube-controller-manager, kube-scheduler, and cluster-autoscaler (ensuring only one instance is running at any time)

The system is illustrated in the following figure:

![ha](../.gitbook/assets/ha%20%285%29.png)

Note: The steps below assume that Kubelet and Docker are configured and running normally on each machine.

## Etcd Cluster

Installing cfssl:

```bash
# On all etcd nodes
curl -o /usr/local/bin/cfssl https://pkg.cfssl.org/R1.2/cfssl_linux-amd64
curl -o /usr/local/bin/cfssljson https://pkg.cfssl.org/R1.2/cfssljson_linux-amd64
chmod +x /usr/local/bin/cfssl*
```

Generate CA certs:

```bash
# SSH etcd0
mkdir -p /etc/kubernetes/pki/etcd
cd /etc/kubernetes/pki/etcd
cat >ca-config.json <<EOF
{
    "signing": {
        "default": {
            "expiry": "43800h"
        },
        "profiles": {
            "server": {
                "expiry": "43800h",
                "usages": [
                    "signing",
                    "key encipherment",
                    "server auth",
                    "client auth"
                ]
            },
            "client": {
                "expiry": "43800h",
                "usages": [
                    "signing",
                    "key encipherment",
                    "client auth"
                ]
            },
            "peer": {
                "expiry": "43800h",
                "usages": [
                    "signing",
                    "key encipherment",
                    "server auth",
                    "client auth"
                ]
            }
        }
    }
}
EOF
cat >ca-csr.json <<EOF
{
    "CN": "etcd",
    "key": {
        "algo": "rsa",
        "size": 2048
    }
}
EOF
cfssl gencert -initca ca-csr.json | cfssljson -bare ca -

# generate client certs
cat >client.json <<EOF
{
    "CN": "client",
    "key": {
        "algo": "ecdsa",
        "size": 256
    }
}
EOF
cfssl gencert -ca=ca.pem -ca-key=ca-key.pem -config=ca-config.json -profile=client client.json | cfssljson -bare client
```

Generate etcd server/peer certs:

```bash
# Copy files to other etcd nodes
mkdir -p /etc/kubernetes/pki/etcd
cd /etc/kubernetes/pki/etcd
scp root@<etcd0-ip-address>:/etc/kubernetes/pki/etcd/ca.pem .
scp root@<etcd0-ip-address>:/etc/kubernetes/pki/etcd/ca-key.pem .
scp root@<etcd0-ip-address>:/etc/kubernetes/pki/etcd/client.pem .
scp root@<etcd0-ip-address>:/etc/kubernetes/pki/etcd/client-key.pem .
scp root@<etcd0-ip-address>:/etc/kubernetes/pki/etcd/ca-config.json .

# Run on all etcd nodes
cfssl print-defaults csr > config.json
sed -i '0,/CN/{s/example\.net/'"$PEER_NAME"'/}' config.json
sed -i 's/www\.example\.net/'"$PRIVATE_IP"'/' config.json
sed -i 's/example\.net/'"$PUBLIC_IP"'/' config.json
cfssl gencert -ca=ca.pem -ca-key=ca-key.pem -config=ca-config.json -profile=server config.json | cfssljson -bare server
cfssl gencert -ca=ca.pem -ca-key=ca-key.pem -config=ca-config.json -profile=peer config.json | cfssljson -bare peer
```

Lastly, run etcd by writing the yaml configuration below to the `/etc/kubernetes/manifests/etcd.yaml` file on each etcd node. Remember to replace:

* `<podname>` with the etcd node name (e.g., `etcd0`, `etcd1`, and `etcd2`)
* `<etcd0-ip-address>`, `<etcd1-ip-address>` and `<etcd2-ip-address>` with the internal IP addresses of the etcd nodes

```bash
# Continue etcd setup on each node
```

> Note: The above method requires that every etcd node runs kubelet. If you don't want to use kubelet, you can also start etcd through systemd:
>
> ```bash
> # Additional systemd setup for etcd
> ```

## kube-apiserver

Place the `kube-apiserver.yaml` in the `/etc/kubernetes/manifests/` directory on each master node and store related configurations in `/srv/kubernetes/`. Kubelet will then automatically create and start the apiserver. Configurations include:

* basic_auth.csv - basic auth user and password
* ca.crt - Certificate Authority cert
* known_tokens.csv - tokens that entities (e.g., the kubelet) can use to talk to the apiserver
* kubecfg.crt - Client certificate, public key
* kubecfg.key - Client certificate, private key
* server.cert - Server certificate, public key
* server.key - Server certificate, private key

> Note: Ensure that the kube-apiserver configuration includes `--etcd-quorum-read=true` (set to true by default as of v1.9).

### kubeadm

If you're using kubeadm to deploy the cluster, you can follow these steps:

```bash
# kubeadm setup on master0 and other master nodes
```

After kube-apiserver is up, it will need to be load-balanced. You could use a cloud platform's load balancing service or configure load balancing for the master nodes with haproxy/lvs.

## kube-controller-manager and kube-scheduler

kube-controller-manager and kube-scheduler must ensure that only one instance is running at any time. This requires a leader election process, so they should be started with `--leader-elect=true`, for example:

```text
# Command-line examples for controller manager and scheduler
```

Place the `kube-scheduler.yaml` and `kube-controller-manager.yaml` files in the `/etc/kubernetes/manifests/` directory on each master node.

## kube-dns

kube-dns can be deployed via a Deployment, which is automatically created by kubeadm by default. However, in large-scale clusters, resource limits need to be relaxed, such as:

```text
# Settings for scaling kube-dns
```

In addition, resources for dnsmasq should be increased, for example by increasing the cache size to 10000 and increasing the concurrent processing number with `--dns-forward-max=1000`.

## kube-proxy

By default, kube-proxy uses iptables for load balancing Services, which can introduce significant latency at scale. An alternative method using [IPVS](https://docs.google.com/presentation/d/1BaIAywY2qqeHtyGZtlyAp89JIZs59MZLKcFLxKE6LyM/edit#slide=id.p3) might be considered (note that IPVS was still in beta as of v1.9).

Moreover, it's important to configure kube-proxy to use the IP address of kube-apiserver's load balancer:

```bash
# Configure kube-proxy to use load balancer IP
```

## kubelet

kubelet also needs to be configured with the IP address of kube-apiserver's load balancer.

```bash
# Configure kubelet with the load balancer IP
```

## Data Persistence

In addition to the configurations mentioned above, persistent storage is also a must for highly available Kubernetes clusters.

* For clusters deployed on public clouds, consider using the cloud platform's persistent storage solutions, such as AWS EBS or GCE Persistent Disk.
* For clusters deployed on physical machines, network storage solutions such as iSCSI, NFS, Gluster, or Ceph could be used, as well as RAID configurations.

## Reference Documents

* Links to official Kubernetes documentation and related resources

Now let's rephrase this in a more accessible manner, maintaining the original format and transforming it into the style of a popular science magazine.