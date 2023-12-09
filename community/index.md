# Developer's Guide

## Setting Up The Development Environment

Here's an example of how you'd configure a Kubernetes development environment on Ubuntu:

```bash
apt-get install -y gcc make socat git build-essential

# Install Docker
sh -c 'echo"deb https://apt.dockerproject.org/repo ubuntu-$(lsb_release -cs) main"> /etc/apt/sources.list.d/docker.list'
curl -fsSL https://apt.dockerproject.org/gpg | sudo apt-key add -
apt-key fingerprint 58118E89F3A912897C070ADBF76221572C52609D
apt-get update
apt-get -y install "docker-engine=1.13.1-0~ubuntu-$(lsb_release -cs)"

# Install etcd
ETCD_VER=v3.2.18
DOWNLOAD_URL="https://github.com/coreos/etcd/releases/download"
curl -L ${DOWNLOAD_URL}/${ETCD_VER}/etcd-${ETCD_VER}-linux-amd64.tar.gz -o /tmp/etcd-${ETCD_VER}-linux-amd64.tar.gz
tar xzvf /tmp/etcd-${ETCD_VER}-linux-amd64.tar.gz
sudo /bin/cp -f etcd-${ETCD_VER}-linux-amd64/{etcd,etcdctl} /usr/bin
rm -rf /tmp/etcd-${ETCD_VER}-linux-amd64.tar.gz etcd-${ETCD_VER}-linux-amd64

# Install Go
curl -sL https://storage.googleapis.com/golang/go1.10.2.linux-amd64.tar.gz | tar -C /usr/local -zxf -
export GOPATH=/gopath
export PATH=$PATH:$GOPATH/bin:/usr/local/bin:/usr/local/go/bin/

# Download Kubernetes code
mkdir -p $GOPATH/src/k8s.io
git clone https://github.com/kubernetes/kubernetes $GOPATH/src/k8s.io/kubernetes
cd $GOPATH/src/k8s.io/kubernetes

# Start a local cluster
export KUBERNETES_PROVIDER=local
hack/local-up-cluster.sh
```

Open another terminal, configure kubectl and you're all set:

```bash
cd $GOPATH/src/k8s.io/kubernetes
export KUBECONFIG=/var/run/kubernetes/admin.kubeconfig
cluster/kubectl.sh
```

## Unit Tests

Unit testing is an indispensable aspect of Kubernetes development. Code modifications generally come with corresponding unit tests update or addition. These tests can be run directly on different systems, such as OSX, Linux, etc.

For instance, after modifying the `pkg/kubelet/kuberuntime` code,

```bash
# Test with the Go package’s full path
go test -v k8s.io/kubernetes/pkg/kubelet/kuberuntime
# Or with the relative directory
go test -v ./pkg/kubelet/kuberuntime
```

## End-To-End (e2e) Tests

End-to-end (e2e) tests require the launch of a Kubernetes cluster and can only be run on a Linux system.

Here's an example of how to launch the tests locally:

```bash
make WHAT='test/e2e/e2e.test'
make ginkgo

export KUBERNETES_PROVIDER=local
go run hack/e2e.go -v -test --test_args='--ginkgo.focus=Port\sforwarding'
go run hack/e2e.go -v -test --test_args='--ginkgo.focus=Feature:SecurityContext'
```

> Note: Each PR in Kubernetes automatically triggers a series of e2e tests.

## Node e2e Tests

Node e2e tests involve starting the Kubelet and can currently only be run on Linux systems.

```bash
export KUBERNETES_PROVIDER=local
make test-e2e-node FOCUS="InitContainer"
```

> Note: Each PR in Kubernetes automatically triggers node e2e tests.

## Useful git Commands

Many times, PRs need to be fetched locally for testing. To pull PR \#365, for instance, you'd use

```bash
git fetch upstream pull/365/merge:branch-fix-1
git checkout branch-fix-1
```

You can also configure `.git/config` to fetch all PRs using `git fetch` (be warned, however, that Kubernetes has a large PR count, thus this process may take a while):

```text
fetch = +refs/pull/*:refs/remotes/origin/pull/*
```

## Additional Resources

* Compile a release version: `make quick-release`
* Robot commands: [command list](https://prow.k8s.io/command-help) and [usage documentation](https://prow.k8s.io/plugins).
* [Kubernetes TestGrid](https://k8s-testgrid.appspot.com/), showing all test history
* [Kuberentes Submit Queue Status](https://submit-queue.k8s.io/#/queue), showing the status of all Pull Requests as well as the merge queue
* [Node Performance Dashboard](http://node-perf-dash.k8s.io/#/builds), showing performance testing results for the Node group
* [Kubernetes Performance Dashboard](http://perf-dash.k8s.io/), displaying Density and Load test reports
* [Kubernetes PR Dashboard](https://k8s-gubernator.appspot.com/pr), listing critical Pull Requests (requires Github login)
* [Jenkins Logs](https://k8s-gubernator.appspot.com/) and [Prow Status](http://prow.k8s.io/?type=presubmit), comprising Jenkins test logs for all Pull Requests