# Kubernetes 开发环境

## 配置开发环境

以 Ubuntu 为例，配置一个 Kubernetes 的开发环境

```sh
apt-get install -y gcc make socat git build-essential

# 安装 Docker
sh -c 'echo"deb https://apt.dockerproject.org/repo ubuntu-$(lsb_release -cs) main"> /etc/apt/sources.list.d/docker.list'
curl -fsSL https://apt.dockerproject.org/gpg | sudo apt-key add -
apt-key fingerprint 58118E89F3A912897C070ADBF76221572C52609D
apt-get update
apt-get -y install "docker-engine=1.13.1-0~ubuntu-$(lsb_release -cs)"

# 安装 etcd
ETCD_VER=v3.2.18
DOWNLOAD_URL="https://github.com/coreos/etcd/releases/download"
curl -L ${DOWNLOAD_URL}/${ETCD_VER}/etcd-${ETCD_VER}-linux-amd64.tar.gz -o /tmp/etcd-${ETCD_VER}-linux-amd64.tar.gz
tar xzvf /tmp/etcd-${ETCD_VER}-linux-amd64.tar.gz
sudo /bin/cp -f etcd-${ETCD_VER}-linux-amd64/{etcd,etcdctl} /usr/bin
rm -rf /tmp/etcd-${ETCD_VER}-linux-amd64.tar.gz etcd-${ETCD_VER}-linux-amd64

# 安装 Go
curl -sL https://storage.googleapis.com/golang/go1.10.2.linux-amd64.tar.gz | tar -C /usr/local -zxf -
export GOPATH=/gopath
export PATH=$PATH:$GOPATH/bin:/usr/local/bin:/usr/local/go/bin/

# 下载 Kubernetes 代码
mkdir -p $GOPATH/src/k8s.io
git clone https://github.com/kubernetes/kubernetes $GOPATH/src/k8s.io/kubernetes
cd $GOPATH/src/k8s.io/kubernetes

# 启动一个本地集群
export KUBERNETES_PROVIDER=local
hack/local-up-cluster.sh
```

打开另外一个终端，配置 kubectl 之后就可以开始使用了:

```sh
cd $GOPATH/src/k8s.io/kubernetes
export KUBECONFIG=/var/run/kubernetes/admin.kubeconfig
cluster/kubectl.sh
```

## 单元测试

单元测试是 Kubernetes 开发中不可缺少的，一般在代码修改的同时还要更新或添加对应的单元测试。这些单元测试大都支持在不同的系统上直接运行，比如 OSX、Linux 等。

比如，加入修改了 `pkg/kubelet/kuberuntime` 的代码后，

```sh
# 可以加上 Go package 的全路径来测试
go test -v k8s.io/kubernetes/pkg/kubelet/kuberuntime
# 也可以用相对目录
go test -v ./pkg/kubelet/kuberuntime
```

## 端到端测试

端到端（e2e）测试需要启动一个 Kubernetes 集群，仅支持在 Linux 系统上运行。

本地运行方法示例：

```sh
make WHAT='test/e2e/e2e.test'
make ginkgo

export KUBERNETES_PROVIDER=local
go run hack/e2e.go -v -test --test_args='--ginkgo.focus=Port\sforwarding'
go run hack/e2e.go -v -test --test_args='--ginkgo.focus=Feature:SecurityContext'
```

> 注：Kubernetes 的每个 PR 都会自动运行一系列的 e2e 测试。

## Node e2e 测试

Node e2e 测试需要启动 Kubelet，目前仅支持在 Linux 系统上运行。

```sh
export KUBERNETES_PROVIDER=local
make test-e2e-node FOCUS="InitContainer"
```

> 注：Kubernetes 的每个 PR 都会自动运行 node e2e 测试。

## 有用的 git 命令

很多时候，我们需要把 Pull Request 拉取到本地来测试，比如拉取 Pull Request #365 的方法为

```sh
git fetch upstream pull/365/merge:branch-fix-1
git checkout branch-fix-1
```

当然，也可以配置 `.git/config` 并运行 `git fetch` 拉取所有的 Pull Requests（注意 Kubernetes 的 Pull Requests 非常多，这个过程可能会很慢）:

```
fetch = +refs/pull/*:refs/remotes/origin/pull/*
```

## 其他参考

- 编译 release 版：`make quick-release`
- 机器人命令：[命令列表](https://prow.k8s.io/command-help) 和 [使用文档](https://prow.k8s.io/plugins)。
- [Kubernetes TestGrid](https://k8s-testgrid.appspot.com/)，包含所有的测试历史
- [Kuberentes Submit Queue Status](https://submit-queue.k8s.io/#/queue)，包含所有的 Pull Request 状态以及合并队列
- [Node Performance Dashboard](http://node-perf-dash.k8s.io/#/builds)，包含 Node 组性能测试报告
- [Kubernetes Performance Dashboard](http://perf-dash.k8s.io/)，包含 Density 和 Load 测试报告
- [Kubernetes PR Dashboard](https://k8s-gubernator.appspot.com/pr)，包含主要关注的 Pull Request 列表（需要以 Github 登录）
- [Jenkins Logs](https://k8s-gubernator.appspot.com/) 和 [Prow Status](http://prow.k8s.io/?type=presubmit)，包含所有 Pull Request 的 Jenkins 测试日志
