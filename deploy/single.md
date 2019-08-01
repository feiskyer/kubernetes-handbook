# 單機部署

## minikube

創建 Kubernetes cluster（單機版）最簡單的方法是 [minikube](https://github.com/kubernetes/minikube)。國內網絡環境下也可以考慮使用 [kubeasz](https://github.com/gjmzj/kubeasz) 的 AllInOne 部署。

首先下載 kubectl

```sh
curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/amd64/kubectl
chmod +x kubectl
```

安裝 minikube（以 MacOS 為例）

```sh
# install minikube
$ brew cask install minikube
$ curl -LO https://storage.googleapis.com/minikube/releases/latest/docker-machine-driver-hyperkit
$ sudo install -o root -g wheel -m 4755 docker-machine-driver-hyperkit /usr/local/bin/
```

在 Windows 上面

```sh
choco install minikube
choco install kubernetes-cli
```



最後啟動 minikube

```sh
# start minikube.
# http proxy is required in China
$ minikube start --docker-env HTTP_PROXY=http://proxy-ip:port --docker-env HTTPS_PROXY=http://proxy-ip:port --vm-driver=hyperkit
```

### 使用 calico

minikube 支持配置使用 CNI 插件，這樣可以方便的使用社區提供的各種網絡插件，比如使用 calico 還可以支持 Network Policy。

首先使用下面的命令啟動 minikube：

```sh
minikube start --docker-env HTTP_PROXY=http://proxy-ip:port \
    --docker-env HTTPS_PROXY=http://proxy-ip:port \
    --network-plugin=cni \
    --host-only-cidr 172.17.17.1/24 \
    --extra-config=kubelet.ClusterCIDR=192.168.0.0/16 \
    --extra-config=proxy.ClusterCIDR=192.168.0.0/16 \
    --extra-config=controller-manager.ClusterCIDR=192.168.0.0/16
```

安裝 calico 網絡插件：

```sh
kubectl apply -f https://docs.projectcalico.org/v3.1/getting-started/kubernetes/installation/hosted/rbac-kdd.yaml
curl -O -L https://docs.projectcalico.org/v3.1/getting-started/kubernetes/installation/hosted/kubernetes-datastore/calico-networking/1.7/calico.yaml
sed -i -e '/nodeSelector/d' calico.yaml
sed -i -e '/node-role.kubernetes.io\/master:""/d' calico.yaml
sed -i -e 's/10\.96\.232/10.0.0/' calico.yaml
kubectl apply -f calico.yaml
```

## 開發版

minikube/localkube 只提供了正式 release 版本，而如果想要部署 master 或者開發版的話，則可以用 `hack/local-up-cluster.sh` 來啟動一個本地集群：

```sh
cd $GOPATH/src/k8s.io/kubernetes

export KUBERNETES_PROVIDER=local
hack/install-etcd.sh
export PATH=$GOPATH/src/k8s.io/kubernetes/third_party/etcd:$PATH
hack/local-up-cluster.sh
```

打開另外一個終端，配置 kubectl：

```sh
cd $GOPATH/src/k8s.io/kubernetes
export KUBECONFIG=/var/run/kubernetes/admin.kubeconfig
cluster/kubectl.sh
```

或者，使用 [kind](https://github.com/kubernetes-sigs/kind)，以 Docker 容器的方式運行 Kubernetes 集群：

```sh
$ go get sigs.k8s.io/kind
# ensure that Kubernetes is cloned in $(go env GOPATH)/src/k8s.io/kubernetes
# build a node image
$ kind build node-image
# create a cluster with kind build node-image
$ kind create cluster --image kindest/node:latest
```

## 參考文檔

- [Running Kubernetes Locally via Minikube](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/install-kubeadm/)
- <https://github.com/kubernetes-sigs/kind>
