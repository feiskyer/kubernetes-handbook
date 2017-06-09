# Kargo 集群安裝
[Kargo](https://github.com/kubernetes-incubator/kargo) 是 Kubernetes incubator 中的專案，目標是提供 Production Ready Kubernetes 部署方案，該專案基礎是透過 Ansible Playbook 來定義系統與 Kubernetes 叢集部署的任務，目前 Kargo 有以下幾個特點：

* 可以部署在 AWS, GCE, Azure, OpenStack 或者 Baremetal.
* 部署 High Available Kubernetes 叢集.
* 可組合性(Composable)，可自行選擇 Network Plugin (flannel, calico, canal, weave) 來部署.
* 支援多種 Linux distributions(CoreOS, Debian Jessie, Ubuntu 16.04, CentOS/RHEL7).

本篇將說明如何透過 Kargo 部署 Kubernetes 至實體機器節點，安裝版本如下所示：

* Kubernetes v1.6.1
* Etcd v3.1.6
* Flannel v0.7.1
* Docker v17.04.0-ce

## 節點資訊
本次安裝測試環境的作業系統採用`Ubuntu 16.04 Server`，其他細節內容如下：

| IP Address      |   Role           |   CPU    |   Memory   |
|-----------------|------------------|----------|------------|
| 192.168.121.179 | master1 + deploy |    2     |     4G     |
| 192.168.121.106 | node1            |    2     |     4G     |
| 192.168.121.197 | node2            |    2     |     4G     |
| 192.168.121.123 | node3            |    2     |     4G     |

> 這邊 master 為主要控制節點，node 為工作節點。

## 預先準備資訊
* 所有節點的網路之間可以互相溝通。
* `部署節點(這邊為 master1)`對其他節點不需要 SSH 密碼即可登入。
* 所有節點都擁有 Sudoer 權限，並且不需要輸入密碼。
* 所有節點需要安裝 `Python`。
* 所有節點需要設定`/etc/host`解析到所有主機。

* 修改所有節點`/etc/resolv.conf`：

```sh
$ echo "nameserver 8.8.8.8" | sudo tee /etc/resolv.conf
```

* `部署節點(這邊為 master1)`需要安裝 Ansible > 2.2.0。

Ubuntu 16.04 安裝最新版 Ansible:
```sh
$ sudo sed -i 's/us.archive.ubuntu.com/tw.archive.ubuntu.com/g' /etc/apt/sources.list
$ sudo apt-get install -y software-properties-common
$ sudo apt-add-repository -y ppa:ansible/ansible
$ sudo apt-get update && sudo apt-get install -y ansible git cowsay python-pip python-netaddr libssl-dev
```

## 安裝 Kargo 與準備部署資訊
首先透過 pypi 安裝 kargo-cli，雖然官方說已經改成 Go 語言版本的工具，但是根本沒在更新，所以目前暫時用 pypi 版本：
```sh
$ sudo pip install -U kargo
```

安裝完成後，新增設定檔`/etc/kargo/kargo.yml`，並加入以下內容：
```sh
$ mkdir /etc/kargo
$ cat <<EOF > /etc/kargo/kargo.yml
kargo_git_repo: "https://github.com/kubernetes-incubator/kargo.git"
# Logging options
loglevel: "info"
EOF
```

接著用 kargo cli 來產生 inventory 檔案：
```sh
$ kargo prepare --masters master1 --etcds master1 --nodes node1 node2 node3
$ cat ~/.kargo/inventory/inventory.cfg
```
> 也可以自己建立`inventory`來描述部署節點。

完成後就可以透過以下指令進行部署 Kubernetes 叢集：
```sh
$ time kargo deploy --verbose -u root -k .ssh/id_rsa -n flannel
Run kubernetes cluster deployment with the above command ? [Y/n]y
...
master1                    : ok=368  changed=89   unreachable=0    failed=0
node1                      : ok=305  changed=73   unreachable=0    failed=0
node2                      : ok=276  changed=62   unreachable=0    failed=0
node3                      : ok=276  changed=62   unreachable=0    failed=0

Kubernetes deployed successfuly
```
> 其中`-n`為部署的網路插件類型，目前支援 calico、flannel、weave 與 canal。

## 驗證叢集
當 Ansible 執行完成後，若沒發生錯誤就可以開始進行操作 Kubernetes，如取得版本資訊：
```sh
$ kubectl version
Client Version: version.Info{Major:"1", Minor:"6", GitVersion:"v1.6.1+coreos.0", GitCommit:"9212f77ed8c169a0afa02e58dce87913c6387b3e", GitTreeState:"clean", BuildDate:"2017-04-04T00:32:53Z", GoVersion:"go1.7.5", Compiler:"gc", Platform:"linux/amd64"}
Server Version: version.Info{Major:"1", Minor:"6", GitVersion:"v1.6.1+coreos.0", GitCommit:"9212f77ed8c169a0afa02e58dce87913c6387b3e", GitTreeState:"clean", BuildDate:"2017-04-04T00:32:53Z", GoVersion:"go1.7.5", Compiler:"gc", Platform:"linux/amd64"}
```

取得目前節點狀態：
```sh
$ kubectl get node
NAME      STATUS                     AGE       VERSION
master1   Ready,SchedulingDisabled   11m       v1.6.1+coreos.0
node1     Ready                      11m       v1.6.1+coreos.0
node2     Ready                      11m       v1.6.1+coreos.0
node3     Ready                      11m       v1.6.1+coreos.
```

查看目前系統 Pod 狀態：
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
