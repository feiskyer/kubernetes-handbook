# Kubernetes开发环境

## 配置开发环境

以Ubuntu为例，配置一个Kubernetes的开发环境

```sh
apt-get install -y gcc make socat git build-essential

# 安装Docker
# 由于社区还没有验证最新版本的Docker，因而这里安装一个较老一点的版本
sh -c 'echo "deb https://apt.dockerproject.org/repo ubuntu-$(lsb_release -cs) main" > /etc/apt/sources.list.d/docker.list'
curl -fsSL https://apt.dockerproject.org/gpg | sudo apt-key add -
apt-key fingerprint 58118E89F3A912897C070ADBF76221572C52609D
apt-get update
apt-get -y install "docker-engine=1.13.1-0~ubuntu-$(lsb_release -cs)"

# 安装etcd
curl -L https://github.com/coreos/etcd/releases/download/v3.1.8/etcd-v3.1.8-linux-amd64.tar.gz -o etcd-v3.1.8-linux-amd64.tar.gz && tar xzvf etcd-v3.1.8-linux-amd64.tar.gz && /bin/cp -f etcd-v3.1.8-linux-amd64/{etcd,etcdctl} /usr/bin && rm -rf etcd-v3.1.8-linux-amd64*

# 安装Go
curl -sL https://storage.googleapis.com/golang/go1.8.3.linux-amd64.tar.gz | tar -C /usr/local -zxf -
export GOPATH=/gopath
export PATH=$PATH:$GOPATH/bin:/usr/local/bin:/usr/local/go/bin/

# 下载Kubernetes代码
mkdir -p $GOPATH/src/k8s.io
git clone https://github.com/kubernetes/kubernetes $GOPATH/src/k8s.io/kubernetes
cd $GOPATH/src/k8s.io/kubernetes

# 启动一个本地集群
export KUBERNETES_PROVIDER=local
hack/local-up-cluster.sh
```

打开另外一个终端，配置kubectl之后就可以开始使用了:

```sh
export KUBECONFIG=/var/run/kubernetes/admin.kubeconfig
cluster/kubectl.sh
```

## 单元测试

单元测试是Kubernetes开发中不可缺少的，一般在代码修改的同时还要更新或添加对应的单元测试。这些单元测试大都支持在不同的系统上直接运行，比如OSX、Linux等。

比如，加入修改了`pkg/kubelet/kuberuntime`的代码后，

```sh
# 可以加上Go package的全路径来测试
go test -v k8s.io/kubernetes/pkg/kubelet/kuberuntime
# 也可以用相对目录
go test -v ./pkg/kubelet/kuberuntime
```

## e2e测试

e2e测试需要启动一个Kubernetes集群，仅支持在Linux系统上运行。

本地运行方法示例：

```sh
make WHAT='test/e2e/e2e.test'
make ginkgo

export KUBERNETES_PROVIDER=local
go run hack/e2e.go -v -test --test_args='--ginkgo.focus=Port\sforwarding'
go run hack/e2e.go -v -test --test_args='--ginkgo.focus=Feature:SecurityContext'
```

> 注：Kubernetes的每个PR都会自动运行一系列的e2e测试。

## Node e2e测试

Node e2e测试需要启动Kubelet，仅支持在Linux系统上运行。

```sh
export KUBERNETES_PROVIDER=local
make test-e2e-node FOCUS="InitContainer"
```

> 注：Kubernetes的每个PR都会自动运行node e2e测试。

## 有用的git命令

很多时候，我们需要把PR拉取到本地来测试，比如拉取PR #365的方法为

```sh
git fetch upstream pull/365/merge:branch-fix-1
git checkout branch-fix-1
```

当然，也可以配置`.git/config`并运行`git fetch`拉取所有的pull requests（注意kubernetes的PR非常多，这个课程可能会很慢）:

```
    fetch = +refs/pull/*:refs/remotes/origin/pull/*
```

## 其他参考

- 编译release版：`make quick-release`
- 测试命令：[kubernetes test-infra](https://github.com/kubernetes/test-infra/blob/master/prow/commands.md)。
- [Kubernetes TestGrid](https://k8s-testgrid.appspot.com/)，包含所有的测试历史
- [Kuberentes Submit Queue Status](https://submit-queue.k8s.io/#/queue)，包含所有的PR状态以及正在合并的PR队列
- [Node Performance Dashboard](http://146.148.52.109/#/builds)，包含Node组性能测试报告
- [Kubernetes Performance Dashboard](http://perf-dash.k8s.io/)，包含Density和Load测试报告
- [Kubernetes PR Dashboard](https://k8s-gubernator.appspot.com/pr)，包含主要关注的PR列表（需要github登录）
- [Jenkins Logs](https://k8s-gubernator.appspot.com/)和[Prow Status](http://prow.k8s.io/?type=presubmit)，包含所有PR的jenkins测试日志

