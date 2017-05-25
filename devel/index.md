# Kubernetes开发环境

## 配置开发环境

```sh
apt-get install -y gcc make socat git build-essential

# install docker
# latest version docker is not validated now, install an old version.
# curl -fsSL https://get.docker.com/ | sh
sh -c 'echo "deb https://apt.dockerproject.org/repo ubuntu-$(lsb_release -cs) main" > /etc/apt/sources.list.d/docker.list'
curl -fsSL https://apt.dockerproject.org/gpg | sudo apt-key add -
apt-key fingerprint 58118E89F3A912897C070ADBF76221572C52609D
apt-get update
apt-get -y install "docker-engine=1.13.1-0~ubuntu-$(lsb_release -cs)"

# install etcd
curl -L https://github.com/coreos/etcd/releases/download/v3.1.8/etcd-v3.1.8-linux-amd64.tar.gz -o etcd-v3.1.8-linux-amd64.tar.gz && tar xzvf etcd-v3.1.8-linux-amd64.tar.gz && /bin/cp -f etcd-v3.1.8-linux-amd64/{etcd,etcdctl} /usr/bin && rm -rf etcd-v3.1.8-linux-amd64*

# install golang
curl -sL https://storage.googleapis.com/golang/go1.8.1.linux-amd64.tar.gz | tar -C /usr/local -zxf -
export GOPATH=/gopath
export PATH=$PATH:$GOPATH/bin:/usr/local/bin:/usr/local/go/bin/

# Get kubernetes code
mkdir -p $GOPATH/src/k8s.io
git clone https://github.com/kubernetes/kubernetes $GOPATH/src/k8s.io/kubernetes
cd $GOPATH/src/k8s.io/kubernetes

# Start a local cluster
export KUBERNETES_PROVIDER=local
# export ALLOW_SECURITY_CONTEXT=yes
# set dockerd --selinux-enabled
# export NET_PLUGIN=kubenet
hack/local-up-cluster.sh
```

打开另外一个终端，配置kubectl:

```sh
export KUBECONFIG=/var/run/kubernetes/admin.kubeconfig
cluster/kubectl.sh
```

## 编译release版

```sh
make quick-release
```

## 单元测试

```sh
# unit test a special package
go test -v k8s.io/kubernetes/pkg/kubelet/kuberuntime
```

## e2e测试

```sh
make WHAT='test/e2e/e2e.test'
make ginkgo

export KUBERNETES_PROVIDER=local
go run hack/e2e.go -v -test --test_args='--ginkgo.focus=Port\sforwarding'
go run hack/e2e.go -v -test --test_args='--ginkgo.focus=Feature:SecurityContext'
```

## Node e2e测试

```sh
export KUBERNETES_PROVIDER=local
make test-e2e-node FOCUS="InitContainer"
```

## Bot命令

- Jenkins verification: `@k8s-bot verify test this`
- GCE E2E: `@k8s-bot cvm gce e2e test this`
- Test all: `@k8s-bot test this please`
- **LGTM (only applied if you are one of assignees):**: `/lgtm`
- LGTM cancel: `/lgtm cancel`

更多命令见[kubernetes test-infra](https://github.com/kubernetes/test-infra/blob/master/prow/commands.md)。

## 有用的git命令

拉取pull request到本地：

```sh
git fetch upstream pull/365/merge:branch-fix-1
git checkout branch-fix-1
```

或者配置`.git/config`并运行`git fetch`拉取所有的pull requests:

```
    fetch = +refs/pull/*:refs/remotes/origin/pull/*
```

## Minikube启动本地cluster

```sh
# install minikube
$ brew cask install minikube
$ brew install docker-machine-driver-xhyve
# docker-machine-driver-xhyve need root owner and uid
$ sudo chown root:wheel $(brew --prefix)/opt/docker-machine-driver-xhyve/bin/docker-machine-driver-xhyve
$ sudo chmod u+s $(brew --prefix)/opt/docker-machine-driver-xhyve/bin/docker-machine-driver-xhyve

# start minikube.
# http proxy is required in China
$ minikube start --docker-env HTTP_PROXY=http://proxy-ip:port --docker-env HTTPS_PROXY=http://proxy-ip:port --vm-driver=xhyve
```

## 容器集成开发环境

```sh
hyper run -it feisky/kubernetes-dev bash
# /hack/start-docker.sh
# /hack/start-kubernetes.sh
# /hack/setup-kubectl.sh
# cluster/kubectl.sh
```

## 常用链接

- [Kubernetes TestGrid](https://k8s-testgrid.appspot.com/)，包含所有的测试历史
- [Kuberentes Submit Queue Status](https://submit-queue.k8s.io/#/queue)，包含所有的PR状态以及正在合并的PR队列
- [Node Performance Dashboard](http://146.148.52.109/#/builds)，包含Node组性能测试报告
- [Kubernetes Performance Dashboard](http://perf-dash.k8s.io/)，包含Density和Load测试报告
- [Kubernetes PR Dashboard](https://k8s-gubernator.appspot.com/pr)，包含主要关注的PR列表（需要github登录）
- [Jenkins Logs](https://k8s-gubernator.appspot.com/)和[Prow Status](http://prow.k8s.io/?type=presubmit)，包含所有PR的jenkins测试日志

