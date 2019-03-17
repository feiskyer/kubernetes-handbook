# Kubespray 集群安裝

[Kubespray](https://github.com/kubernetes-incubator/kubespray) 是 Kubernetes incubator 中的项目，目标是提供 Production Ready Kubernetes 部署方案，该项目基础是通过 Ansible Playbook 来定义系统与 Kubernetes 集群部署的任务，具有以下几个特点：

* 可以部署在 AWS, GCE, Azure, OpenStack 以及裸机上.
* 部署 High Available Kubernetes 集群.
* 可组合性 (Composable)，可自行选择 Network Plugin (flannel, calico, canal, weave) 来部署.
* 支持多种 Linux distributions(CoreOS, Debian Jessie, Ubuntu 16.04, CentOS/RHEL7).

本篇将说明如何通过 Kubespray 部署 Kubernetes 至裸机节点，安装版本如下所示：

* Kubernetes v1.7.3
* Etcd v3.2.4
* Flannel v0.8.0
* Docker v17.04.0-ce

## 节点资讯

本次安装测试环境的作业系统采用 `Ubuntu 16.04 Server`，其他细节内容如下：

| IP Address      | Role             | CPU  | Memory |
| --------------- | ---------------- | ---- | ------ |
| 192.168.121.179 | master1 + deploy | 2    | 4G     |
| 192.168.121.106 | node1            | 2    | 4G     |
| 192.168.121.197 | node2            | 2    | 4G     |
| 192.168.121.123 | node3            | 2    | 4G     |

> 这边 master 为主要控制节点，node 为工作节点。

## 预先准备资讯

* 所有节点的网路之间可以互相通信。
* ` 部署节点 (这边为 master1)` 对其他节点不需要 SSH 密码即可登入。
* 所有节点都拥有 Sudoer 权限，并且不需要输入密码。
* 所有节点需要安装 `Python`。
* 所有节点需要设定 `/etc/hosts` 解析到所有主机。

* 修改所有节点的 `/etc/resolv.conf`

```sh
$ echo "nameserver 8.8.8.8" | sudo tee /etc/resolv.conf
```

* ` 部署节点 (这边为 master1)` 安装 Ansible >= 2.3.0。

Ubuntu 16.04 安装 Ansible:
```sh
$ sudo sed -i 's/us.archive.ubuntu.com/tw.archive.ubuntu.com/g' /etc/apt/sources.list
$ sudo apt-get install -y software-properties-common
$ sudo apt-add-repository -y ppa:ansible/ansible
$ sudo apt-get update && sudo apt-get install -y ansible git cowsay python-pip python-netaddr libssl-dev
```

## 安装 Kubespray 与准备部署资讯
首先通过 pypi 安装 kubespray-cli，虽然官方说已经改成 Go 语言版本的工具，但是根本没在更新，所以目前暂时用 pypi 版本：
```sh
$ sudo pip install -U kubespray
```

安裝完成後，新增配置檔 `~/.kubespray.yml`，並加入以下內容：
```sh
$ cat <<EOF> ~/.kubespray.yml
kubespray_git_repo: "https://github.com/kubernetes-incubator/kubespray.git"
# Logging options
loglevel: "info"
EOF
```

接着用 kubespray cli 来产生 inventory 文件：
```sh
$ kubespray prepare --masters master1 --etcds master1 --nodes node1 node2 node3
```

在 inventory.cfg，添加部分內容：
```
$ vim ~/.kubespray/inventory/inventory.cfg

[all]
master1  ansible_host=192.168.121.179   ansible_user=root ip=192.168.121.179
node1    ansible_host=192.168.121.106 ansible_user=root ip=192.168.121.106
node2    ansible_host=192.168.121.197 ansible_user=root ip=192.168.121.197
node3    ansible_host=192.168.121.123 ansible_user=root ip=192.168.121.123

[kube-master]
master1

[kube-node]
node1
node2
node3

[etcd]
master1

[k8s-cluster:children]
kube-node
kube-master
```
> 也可以自己新建 `inventory` 来描述部署节点。

完成后通过以下指令进行部署 Kubernetes 集群：
```sh
$ time kubespray deploy --verbose -u root -k .ssh/id_rsa -n flannel
Run kubernetes cluster deployment with the above command ? [Y/n]y
...
master1                    : ok=368  changed=89   unreachable=0    failed=0
node1                      : ok=305  changed=73   unreachable=0    failed=0
node2                      : ok=276  changed=62   unreachable=0    failed=0
node3                      : ok=276  changed=62   unreachable=0    failed=0

Kubernetes deployed successfully
```
> 其中 `-n` 为部署的网络插件类型，目前支持 calico、flannel、weave 与 canal。

## 验证集群
当 Ansible 运行完成后，若没发生错误就可以开始进行操作 Kubernetes，如取得版本资讯：
```sh
$ kubectl version
Client Version: version.Info{Major:"1", Minor:"6", GitVersion:"v1.7.3+coreos.0", GitCommit:"9212f77ed8c169a0afa02e58dce87913c6387b3e", GitTreeState:"clean", BuildDate:"2017-04-04T00:32:53Z", GoVersion:"go1.8.3", Compiler:"gc", Platform:"linux/amd64"}
Server Version: version.Info{Major:"1", Minor:"6", GitVersion:"v1.7.3+coreos.0", GitCommit:"9212f77ed8c169a0afa02e58dce87913c6387b3e", GitTreeState:"clean", BuildDate:"2017-04-04T00:32:53Z", GoVersion:"go1.8.3", Compiler:"gc", Platform:"linux/amd64"}
```

取得当前集群节点状态：
```sh
$ kubectl get node
NAME      STATUS                     AGE       VERSION
master1   Ready,SchedulingDisabled   11m       v1.7.3+coreos.0
node1     Ready                      11m       v1.7.3+coreos.0
node2     Ready                      11m       v1.7.3+coreos.0
node3     Ready                      11m       v1.7.3+coreos.
```

查看当前集群 Pod 状态：
```sh
$ kubectl get po -n kube-system
NAME                                  READY     STATUS    RESTARTS   AGE
dnsmasq-975202658-6jj3n               1/1       Running   0          14m
dnsmasq-975202658-h4rn9               1/1       Running   0          14m
dnsmasq-autoscaler-2349860636-kfpx0   1/1       Running   0          14m
flannel-master1                       1/1       Running   1          14m
flannel-node1                         1/1       Running   1          14m
flannel-node2                         1/1       Running   1          14m
flannel-node3                         1/1       Running   1          14m
kube-apiserver-master1                1/1       Running   0          15m
kube-controller-manager-master1       1/1       Running   0          15m
kube-proxy-master1                    1/1       Running   1          14m
kube-proxy-node1                      1/1       Running   1          14m
kube-proxy-node2                      1/1       Running   1          14m
kube-proxy-node3                      1/1       Running   1          14m
kube-scheduler-master1                1/1       Running   0          15m
kubedns-1519522227-thmrh              3/3       Running   0          14m
kubedns-autoscaler-2999057513-tx14j   1/1       Running   0          14m
nginx-proxy-node1                     1/1       Running   1          14m
nginx-proxy-node2                     1/1       Running   1          14m
nginx-proxy-node3                     1/1       Running   1          14m
```
