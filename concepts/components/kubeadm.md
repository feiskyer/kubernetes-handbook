# An Introduction to Kubeadm

Kubeadm is among the tools that Kubernetes proudly recommends, and it's currently undergoing rapid iteration and development.

## System Initialization

All machines need to initialize their container execution engine (like Docker or Frakti) and also kubelet. These initializations are essential since kubeadm relies on kubelet to start up the Master components such as kube-apiserver, kube-manager-controller, kube-scheduler, and kube-proxy, among others.

## Connecting with Master

To initialize the master, all you have to do is run the command `kubeadm init`, like so:

```bash
kubeadm init --pod-network-cidr 10.244.0.0/16 --kubernetes-version stable
```

Executing this command will autonomously:

* Run a systematic status check,
* Generate a token,
* Launch a self-signed CA and client-side certificates,
* Create a kubeconfig for kubelet to connect to the API server,
* Produce Static Pod manifests for Master components and place them in the `/etc/kubernetes/manifests` directory,
* Configure RBAC and set the Master node to only run the control plane components,
* Establish additional services, like kube-proxy and kube-dns.

## Adjusting the Network Plugin

During initialization, kubeadm remains indifferent to the network plugin. On default, kubelet is configured to use CNI plugins, requiring users to initialize the network plugin separately.

### CNI Bridge

```bash
mkdir -p /etc/cni/net.d
cat >/etc/cni/net.d/10-mynet.conf <<-EOF
{
    "cniVersion": "0.3.0",
    "name": "mynet",
    "type": "bridge",
    "bridge": "cni0",
    "isGateway": true,
    "ipMasq": true,
    "ipam": {
        "type": "host-local",
        "subnet": "10.244.1.0/24",
        "routes": [
            {"dst": "0.0.0.0/0"}
        ]
    }
}
EOF
cat >/etc/cni/net.d/99-loopback.conf <<-EOF
{
    "cniVersion": "0.3.0",
    "type": "loopback"
}
EOF
```

### Flannel

```bash
kubectl create -f https://github.com/coreos/flannel/raw/master/Documentation/kube-flannel-rbac.yml
kubectl create -f https://github.com/coreos/flannel/raw/master/Documentation/kube-flannel.yml
```

### Weave

```bash
kubectl apply -f "https://cloud.weave.works/k8s/net?k8s-version=$(kubectl version | base64 | tr -d'\n')"
```

### Calico

```bash
kubectl apply -f https://docs.projectcalico.org/v3.1/getting-started/kubernetes/installation/hosted/rbac-kdd.yaml
kubectl apply -f https://docs.projectcalico.org/v3.1/getting-started/kubernetes/installation/hosted/kubernetes-datastore/calico-networking/1.7/calico.yaml
```

## Node Addition

```bash
token=$(kubeadm token list | grep authentication,signing | awk '{print $1}')
kubeadm join --token $token ${master_ip}
```

This step includes the following processes:

* Downloading the CA from the API server,
* Generating local certificates and requesting the API Server's signature,
* Finally, configuring kubelet to connect to the API Server.

## Installation Removal

```bash
kubeadm reset
```

## Helpful References

* [kubeadm Setup Tool](https://kubernetes.io/docs/admin/kubeadm/)