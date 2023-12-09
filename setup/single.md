# Deployment on a Single Machine

## minikube

The simplest way to create a Kubernetes cluster (single machine version) is by using [minikube](https://github.com/kubernetes/minikube). If you are operating in China's network environment, you can also consider utilizing AllInOne deployment from [kubeasz](https://github.com/gjmzj/kubeasz).

Begin by downloading kubectl:

```bash
curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/amd64/kubectl
chmod +x kubectl
```

Next, install minikube (for MacOS as an example):

```bash
# install minikube
$ brew cask install minikube
$ curl -LO https://storage.googleapis.com/minikube/releases/latest/docker-machine-driver-hyperkit
$ sudo install -o root -g wheel -m 4755 docker-machine-driver-hyperkit /usr/local/bin/
```

For Windows users:

```bash
choco install minikube
choco install kubernetes-cli
```

Finally, launch minikube:

```bash
# start minikube.
# HTTP proxy needed in China
$ minikube start --docker-env HTTP_PROXY=http://proxy-ip:port --docker-env HTTPS_PROXY=http://proxy-ip:port --vm-driver=hyperkit
```

### Utilizing calico

Minikube supports configuration using the CNI (Container Network Interface) plugins, which enables an easy access to a variety of community-provided network plugins, like calico which also supports Network Policy.

Start minikube with the command below:

```bash
minikube start --docker-env HTTP_PROXY=http://proxy-ip:port \
    --docker-env HTTPS_PROXY=http://proxy-ip:port \
    --network-plugin=cni \
    --host-only-cidr 172.17.17.1/24 \
    --extra-config=kubelet.ClusterCIDR=192.168.0.0/16 \
    --extra-config=proxy.ClusterCIDR=192.168.0.0/16 \
    --extra-config=controller-manager.ClusterCIDR=192.168.0.0/16
```

Then, install the calico network plugin:

```bash
kubectl apply -f https://docs.projectcalico.org/v3.1/getting-started/kubernetes/installation/hosted/rbac-kdd.yaml
curl -O -L https://docs.projectcalico.org/v3.1/getting-started/kubernetes/installation/hosted/kubernetes-datastore/calico-networking/1.7/calico.yaml
sed -i -e '/nodeSelector/d' calico.yaml
sed -i -e '/node-role.kubernetes.io\/master:""/d' calico.yaml
sed -i -e 's/10\.96\.232/10.0.0/' calico.yaml
kubectl apply -f calico.yaml
```

## Developer Mode

### local-up-cluster.sh

Minikube/localkube only offers the formal release versions.

However, if you're looking to deploy a master or developer version, you can start a local cluster using `hack/local-up-cluster.sh`:

```bash
cd $GOPATH/src/k8s.io/kubernetes
hack/local-up-cluster.sh
```

Then, open another terminal to configure kubectl:

```bash
cd $GOPATH/src/k8s.io/kubernetes
cluster/kubectl.sh get pods
cluster/kubectl.sh get services
cluster/kubectl.sh get replicationcontrollers
cluster/kubectl.sh run my-nginx --image=nginx --port=80
```

### Kind

Use [kind](https://github.com/kubernetes-sigs/kind) to operate a Kubernetes cluster via Docker containers:

```bash
$ go get sigs.k8s.io/kind
# ensure that Kubernetes is cloned in $(go env GOPATH)/src/k8s.io/kubernetes
# build a node image
$ kind build node-image
# create a cluster with kind build node-image
$ kind create cluster --image kindest/node:latest
```

## Reference Documents

* [Running Kubernetes Locally via Minikube](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/install-kubeadm/)
* [https://github.com/kubernetes-sigs/kind](https://github.com/kubernetes-sigs/kind)
