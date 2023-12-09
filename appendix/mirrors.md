# Accessing Data Mirrors within China

## Docker Hub Mirrors

* The 163 Mirror: `hub-mirror.c.163.com`
* The Opensource Community Mirror: [mirror.azure.cn/help/docker-registry-proxy-cache.html](http://mirror.azure.cn/help/docker-registry-proxy-cache.html)

> Keep in mind: The Opensource Community mirror proxy is only open to Azure China IP addresses.

How to use it

```bash
docker pull hub-mirror.c.163.com/library/busybox
docker pull dockerhub.azk8s.cn/library/nginx

docker pull quay.mirrors.ustc.edu.cn/coreos/kube-state-metrics:v1.5.0
```

## GCR(Google Container Registry) Mirrors

* The Opensource Community Mirror(Azure China): [mirror.azure.cn/help/gcr-proxy-cache.html](http://mirror.azure.cn/help/gcr-proxy-cache.html)
* The Alibaba Cloud Mirror: Either registry.cn-hangzhou.aliyuncs.com/google_containers or registry.aliyuncs.com/google_containers will work.

> Remember: The Opensource Community mirror proxy is solely available to Azure China IP addresses.

How to use it

```bash
docker pull registry.cn-hangzhou.aliyuncs.com/google_containers/kube-apiserver:v1.18.0
docker pull registry.aliyuncs.com/google_containers/kube-apiserver:v1.18.0

docker pull gcr.azk8s.cn/google_containers/hyperkube:v1.12.1
docker pull gcr.azk8s.cn/google_containers/pause-amd64:3.1
```

## Kubernetes RPM/DEB Mirrors

* [The Opensource Community Mirror](http://mirror.azure.cn/kubernetes/packages/)

Here's how

```bash
# For Ubuntu
cat <<EOF >/etc/apt/sources.list.d/kubernetes.list
deb http://mirror.azure.cn/kubernetes/packages/apt/ kubernetes-xenial main
EOF
```

### Helm Charts Mirrors

* Helm: [mirror.azure.cn/kubernetes/helm/](http://mirror.azure.cn/kubernetes/helm/)
* Stable Charts: [mirror.azure.cn/kubernetes/charts/](http://mirror.azure.cn/kubernetes/charts/)
* Incubator Charts: [mirror.azure.cn/kubernetes/charts-incubator/](http://mirror.azure.cn/kubernetes/charts-incubator/)

Here's how

```bash
helm repo add stable http://mirror.azure.cn/kubernetes/charts/
helm repo add incubator http://mirror.azure.cn/kubernetes/charts-incubator/
```

## Operating System Mirrors

* [Opensource Community's Open Source Mirror](http://mirror.azure.cn/)
* [NetEase's Open Source Mirror](https://mirrors.163.com/)

As an example, here's how you would set up Ubuntu 18.04(Bionic). You'll need to modify the content of your /etc/apt/sources.list file as follows:

```bash
deb http://azure.archive.ubuntu.com/ubuntu/ bionic main restricted universe multiverse
deb http://azure.archive.ubuntu.com/ubuntu/ bionic-security main restricted universe multiverse
deb http://azure.archive.ubuntu.com/ubuntu/ bionic-updates main restricted universe multiverse
deb http://azure.archive.ubuntu.com/ubuntu/ bionic-proposed main restricted universe multiverse
deb http://azure.archive.ubuntu.com/ubuntu/ bionic-backports main restricted universe multiverse
deb-src http://azure.archive.ubuntu.com/ubuntu/ bionic main restricted universe multiverse
deb-src http://azure.archive.ubuntu.com/ubuntu/ bionic-security main restricted universe multiverse
deb-src http://azure.archive.ubuntu.com/ubuntu/ bionic-updates main restricted universe multiverse
deb-src http://azure.archive.ubuntu.com/ubuntu/ bionic-proposed main restricted universe multiverse
deb-src http://azure.archive.ubuntu.com/ubuntu/ bionic-backports main restricted universe multiverse
```
