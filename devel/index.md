# Kubernetes 開發環境

## 配置開發環境

以 Ubuntu 為例，配置一個 Kubernetes 的開發環境

```sh
apt-get install -y gcc make socat git build-essential

# 安裝 Docker
sh -c 'echo"deb https://apt.dockerproject.org/repo ubuntu-$(lsb_release -cs) main"> /etc/apt/sources.list.d/docker.list'
curl -fsSL https://apt.dockerproject.org/gpg | sudo apt-key add -
apt-key fingerprint 58118E89F3A912897C070ADBF76221572C52609D
apt-get update
apt-get -y install "docker-engine=1.13.1-0~ubuntu-$(lsb_release -cs)"

# 安裝 etcd
ETCD_VER=v3.2.18
DOWNLOAD_URL="https://github.com/coreos/etcd/releases/download"
curl -L ${DOWNLOAD_URL}/${ETCD_VER}/etcd-${ETCD_VER}-linux-amd64.tar.gz -o /tmp/etcd-${ETCD_VER}-linux-amd64.tar.gz
tar xzvf /tmp/etcd-${ETCD_VER}-linux-amd64.tar.gz
sudo /bin/cp -f etcd-${ETCD_VER}-linux-amd64/{etcd,etcdctl} /usr/bin
rm -rf /tmp/etcd-${ETCD_VER}-linux-amd64.tar.gz etcd-${ETCD_VER}-linux-amd64

# 安裝 Go
curl -sL https://storage.googleapis.com/golang/go1.10.2.linux-amd64.tar.gz | tar -C /usr/local -zxf -
export GOPATH=/gopath
export PATH=$PATH:$GOPATH/bin:/usr/local/bin:/usr/local/go/bin/

# 下載 Kubernetes 代碼
mkdir -p $GOPATH/src/k8s.io
git clone https://github.com/kubernetes/kubernetes $GOPATH/src/k8s.io/kubernetes
cd $GOPATH/src/k8s.io/kubernetes

# 啟動一個本地集群
export KUBERNETES_PROVIDER=local
hack/local-up-cluster.sh
```

打開另外一個終端，配置 kubectl 之後就可以開始使用了:

```sh
cd $GOPATH/src/k8s.io/kubernetes
export KUBECONFIG=/var/run/kubernetes/admin.kubeconfig
cluster/kubectl.sh
```

## 單元測試

單元測試是 Kubernetes 開發中不可缺少的，一般在代碼修改的同時還要更新或添加對應的單元測試。這些單元測試大都支持在不同的系統上直接運行，比如 OSX、Linux 等。

比如，加入修改了 `pkg/kubelet/kuberuntime` 的代碼後，

```sh
# 可以加上 Go package 的全路徑來測試
go test -v k8s.io/kubernetes/pkg/kubelet/kuberuntime
# 也可以用相對目錄
go test -v ./pkg/kubelet/kuberuntime
```

## 端到端測試

端到端（e2e）測試需要啟動一個 Kubernetes 集群，僅支持在 Linux 系統上運行。

本地運行方法示例：

```sh
make WHAT='test/e2e/e2e.test'
make ginkgo

export KUBERNETES_PROVIDER=local
go run hack/e2e.go -v -test --test_args='--ginkgo.focus=Port\sforwarding'
go run hack/e2e.go -v -test --test_args='--ginkgo.focus=Feature:SecurityContext'
```

> 注：Kubernetes 的每個 PR 都會自動運行一系列的 e2e 測試。

## Node e2e 測試

Node e2e 測試需要啟動 Kubelet，目前僅支持在 Linux 系統上運行。

```sh
export KUBERNETES_PROVIDER=local
make test-e2e-node FOCUS="InitContainer"
```

> 注：Kubernetes 的每個 PR 都會自動運行 node e2e 測試。

## 有用的 git 命令

很多時候，我們需要把 Pull Request 拉取到本地來測試，比如拉取 Pull Request #365 的方法為

```sh
git fetch upstream pull/365/merge:branch-fix-1
git checkout branch-fix-1
```

當然，也可以配置 `.git/config` 並運行 `git fetch` 拉取所有的 Pull Requests（注意 Kubernetes 的 Pull Requests 非常多，這個過程可能會很慢）:

```
fetch = +refs/pull/*:refs/remotes/origin/pull/*
```

## 其他參考

- 編譯 release 版：`make quick-release`
- 機器人命令：[命令列表](https://prow.k8s.io/command-help) 和 [使用文檔](https://prow.k8s.io/plugins)。
- [Kubernetes TestGrid](https://k8s-testgrid.appspot.com/)，包含所有的測試歷史
- [Kuberentes Submit Queue Status](https://submit-queue.k8s.io/#/queue)，包含所有的 Pull Request 狀態以及合併隊列
- [Node Performance Dashboard](http://node-perf-dash.k8s.io/#/builds)，包含 Node 組性能測試報告
- [Kubernetes Performance Dashboard](http://perf-dash.k8s.io/)，包含 Density 和 Load 測試報告
- [Kubernetes PR Dashboard](https://k8s-gubernator.appspot.com/pr)，包含主要關注的 Pull Request 列表（需要以 Github 登錄）
- [Jenkins Logs](https://k8s-gubernator.appspot.com/) 和 [Prow Status](http://prow.k8s.io/?type=presubmit)，包含所有 Pull Request 的 Jenkins 測試日誌
