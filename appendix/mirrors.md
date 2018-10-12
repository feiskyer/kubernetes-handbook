# 国内镜像列表

## Docker Hub 镜像

- Docker 中国镜像：https://registry.docker-cn.com
- 开源社镜像：https://dockerhub.akscn.io

示例

```sh
docker pull registry.docker-cn.com/library/nginx
```

## GCR（Google Container Registry）镜像

- 开源社镜像：https://gcr.akscn.io/google_containers
- 阿里云镜像：https://dev.aliyun.com/list.html?namePrefix=google-containers

示例

```sh
docker pull gcr.akscn.io/google_containers/hyperkube:v1.12.1
docker pull gcr.akscn.io/google_containers/pause-amd64:3.1
docker pull registry.cn-hangzhou.aliyuncs.com/google-containers/kubernetes-dashboard-amd64:v1.7.1
```

## Kubernetes RPM/DEB镜像

- [开源社镜像](http://mirror.azure.cn/kubernetes/packages/)
- [阿里云镜像](https://mirrors.aliyun.com/kubernetes/)

示例：

```sh
# CentOS
cat <<EOF > /etc/yum.repos.d/kubernetes.repo
[kubernetes]
name=Kubernetes
baseurl=https://mirrors.aliyun.com/kubernetes/yum/repos/kubernetes-el7-x86_64/
enabled=1
gpgcheck=1
repo_gpgcheck=1
gpgkey=https://mirrors.aliyun.com/kubernetes/yum/doc/yum-key.gpg https://mirrors.aliyun.com/kubernetes/yum/doc/rpm-package-key.gpg
EOF

# Ubuntu
cat <<EOF >/etc/apt/sources.list.d/kubernetes.list
deb https://mirrors.aliyun.com/kubernetes/apt/ kubernetes-xenial main
EOF
```

### Helm Charts 镜像

- Helm: http://mirror.azure.cn/kubernetes/helm/
- Stable Charts: http://mirror.azure.cn/kubernetes/charts/
- Incubator Charts: http://mirror.azure.cn/kubernetes/charts-incubator/

示例

```sh
helm repo add stable http://mirror.azure.cn/kubernetes/charts/
helm repo add incubator http://mirror.azure.cn/kubernetes/charts-incubator/
```

## 操作系统镜像

- [开源社开源镜像](http://mirror.azure.cn/)

- [网易开源镜像](https://mirrors.163.com/)

- [阿里云镜像](https://opsx.alibaba.com/mirror)

以 Ubuntu 18.04（Bionic）为例，修改 /etc/apt/sources.list 文件的内容为

```sh
deb http://mirrors.aliyun.com/ubuntu/ bionic main restricted universe multiverse
deb-src http://mirrors.aliyun.com/ubuntu/ bionic main restricted universe multiverse

deb http://mirrors.aliyun.com/ubuntu/ bionic-security main restricted universe multiverse
deb-src http://mirrors.aliyun.com/ubuntu/ bionic-security main restricted universe multiverse

deb http://mirrors.aliyun.com/ubuntu/ bionic-updates main restricted universe multiverse
deb-src http://mirrors.aliyun.com/ubuntu/ bionic-updates main restricted universe multiverse

deb http://mirrors.aliyun.com/ubuntu/ bionic-proposed main restricted universe multiverse
deb-src http://mirrors.aliyun.com/ubuntu/ bionic-proposed main restricted universe multiverse

deb http://mirrors.aliyun.com/ubuntu/ bionic-backports main restricted universe multiverse
deb-src http://mirrors.aliyun.com/ubuntu/ bionic-backports main restricted universe multiverse
```

