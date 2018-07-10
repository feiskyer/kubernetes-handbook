# Kuryr

Kuryr 是 OpenStack Neutron 的子项目，其主要目标是透过该项目来集成 OpenStack 与 Kubernetes 的网络。该项目在 Kubernetes 中实作了原生 Neutron-based 的网络，因此使用 Kuryr-Kubernetes 可以让 OpenStack VM 与 Kubernetes Pods 能够选择在同一个子网络上运作，并且能够使用 Neutron L3 与 Security Group 来对网络进行路由，以及阻挡特定来源 Port，并且也提供基于 Neutron LBaaS 的 Service 集成。

![](https://i.imgur.com/2XfP3vb.png)

Kuryr-Kubernetes 有以两个主要部分组成：

1. **Kuryr Controller**: Controller 主要目的是监控 Kubernetes API 的来获取 Kubernetes 资源的变化，然后依据 Kubernetes 资源的需求来运行子资源的分配和资源管理。
2. **Kuryr CNI**：主要是依据 Kuryr Controller 分配的资源来绑定网络至 Pods 上。

## devstack 部署

最简单的方式是使用 devstack 部署一个单机环境：

```sh
$ git clone https://git.openstack.org/openstack-dev/devstack
$ ./devstack/tools/create-stack-user.sh
$ sudo su stack

$ git clone https://git.openstack.org/openstack-dev/devstack
$ git clone https://git.openstack.org/openstack/kuryr-kubernetes
$ cp kuryr-kubernetes/devstack/local.conf.sample devstack/local.conf

# start install
$ ./devstack/stack.sh
```

部署完成后，验证安装成功

```sh
$ source /devstack/openrc admin admin
$ openstack service list
+----------------------------------+------------------+------------------+
| ID                               | Name             | Type             |
+----------------------------------+------------------+------------------+
| 091e3e2813cc4904b74b60c41e8a98b3 | kuryr-kubernetes | kuryr-kubernetes |
| 2b6076dd5fc04bf180e935f78c12d431 | neutron          | network          |
| b598216086944714aed2c233123fc22d | keystone         | identity         |
+----------------------------------+------------------+------------------+

$ kubectl get nodes
NAME        STATUS    AGE       VERSION
localhost   Ready     2m        v1.6.2
```

## 多机部署

本篇我們將說明如何利用 `DevStack` 與 `Kubespray` 建立一個簡單的測試環境。

### 环境资源与事前准备
准备两台实体机器，这边测试的作业系统为 `CentOS 7.x`，该环境将在平面的网络下进行。

| IP Address 1 | Role                   |
| ------------ | ---------------------- |
| 172.24.0.34  | controller, k8s-master |
| 172.24.0.80  | compute1, k8s-node1    |
| 172.24.0.81  | compute2, k8s-node2    |

更新每台节点的 CentOS 7.x 包:
```shell=
$ sudo yum --enablerepo=cr update -y
```

然后关闭 firewalld 以及 SELinux 来避免实现发生问题：
```shell=
$ sudo setenforce 0
$ sudo systemctl disable firewalld && sudo systemctl stop firewalld
```

### OpenStack Controller 安裝
首先进入 `172.24.0.34（controller）`，并且运行以下命令。

然后运行以下命令来建立 DevStack 专用用户：
```shell=
$ sudo useradd -s /bin/bash -d /opt/stack -m stack
$ echo "stack ALL=(ALL) NOPASSWD: ALL" | sudo tee /etc/sudoers.d/stack
```

接着切换至该用户环境来创建 OpenStack：
```shell=
$ sudo su - stack
```

下载 DevStack：
```shell=
$ git clone https://git.openstack.org/openstack-dev/devstack
$ cd devstack
```

新增 `local.conf` 文档，来描述部署资讯：
```
[[local|localrc]]
HOST_IP=172.24.0.34
GIT_BASE=https://github.com

ADMIN_PASSWORD=passwd
DATABASE_PASSWORD=passwd
RABBIT_PASSWORD=passwd
SERVICE_PASSWORD=passwd
SERVICE_TOKEN=passwd
MULTI_HOST=1
```
> 修改 HOST_IP 为自己的 IP 。

完成后，运行以下命令开始部署：
```shell=
$ ./stack.sh
```

### Openstack Compute 安装
进入到 `172.24.0.80（compute）` 與 `172.24.0.81（node2）`，并且运行以下命令。

然后运行以下命令来建立 DevStack 专用用户：
```shell=
$ sudo useradd -s /bin/bash -d /opt/stack -m stack
$ echo "stack ALL=(ALL) NOPASSWD: ALL" | sudo tee /etc/sudoers.d/stack
```

接着切换至该用户环境来创建 OpenStack：
```shell=
$ sudo su - stack
```

下载 DevStack：
```shell=
$ git clone https://git.openstack.org/openstack-dev/devstack
$ cd devstack
```

新增 `local.conf` 文档，来描述部署资讯：
```
[[local|localrc]]
HOST_IP=172.24.0.80
GIT_BASE=https://github.com
MULTI_HOST=1
LOGFILE=/opt/stack/logs/stack.sh.log
ADMIN_PASSWORD=passwd
DATABASE_PASSWORD=passwd
RABBIT_PASSWORD=passwd
SERVICE_PASSWORD=passwd
DATABASE_TYPE=mysql

SERVICE_HOST=172.24.0.34
MYSQL_HOST=$SERVICE_HOST
RABBIT_HOST=$SERVICE_HOST
GLANCE_HOSTPORT=$SERVICE_HOST:9292
ENABLED_SERVICES=n-cpu,q-agt,n-api-meta,c-vol,placement-client
NOVA_VNC_ENABLED=True
NOVNCPROXY_URL="http://$SERVICE_HOST:6080/vnc_auto.html"
VNCSERVER_LISTEN=$HOST_IP
VNCSERVER_PROXYCLIENT_ADDRESS=$VNCSERVER_LISTEN
```
> 修改 HOST_IP 为自己的主机位置。
> 修改 SERVICE_HOST 为 Master 的 IP。

完成后，运行以下命令开始部署：
```shell=
$ ./stack.sh
```

### 创建 Kubernetes 集群环境
首先确认所有节点之间不需要 SSH 密码即可登入，接着进入到 `172.24.0.34（k8s-master）` 并且运行以下命令。

接着安装所需要的软件包：
```shell=
$ sudo yum -y install software-properties-common ansible git gcc python-pip python-devel libffi-devel openssl-devel
$ sudo pip install -U kubespray
```

完成后，创建 kubespray 配置档：
```shell=
$ cat <<EOF>  ~/.kubespray.yml
kubespray_git_repo: "https://github.com/kubernetes-incubator/kubespray.git"
# Logging options
loglevel: "info"
EOF
```

利用 kubespray-cli 快速产生环境的 `inventory` 文档，并修改部分内容：
```shell=
$ sudo -i
$ kubespray prepare --masters master --etcds master --nodes node1
```

编辑 `/root/.kubespray/inventory/inventory.cfg` 文档，修改以下内容：
```
[all]
master  ansible_host=172.24.0.34 ansible_user=root ip=172.24.0.34
node1    ansible_host=172.24.0.80 ansible_user=root ip=172.24.0.80
node2    ansible_host=172.24.0.81 ansible_user=root ip=172.24.0.81

[kube-master]
master

[kube-node]
master
node1
node2

[etcd]
master

[k8s-cluster:children]
kube-node
kube-master
```

完成后，即可利用 kubespray-cli 来进行部署：
```shell=
$ kubespray deploy --verbose -u root -k .ssh/id_rsa -n calico
```

经过一段时间后就会部署完成，这时候检查节点是否正常：
```shell=
$ kubectl get no
NAME      STATUS         AGE       VERSION
master    Ready,master   2m        v1.7.4
node1     Ready          2m        v1.7.4
node2     Ready          2m        v1.7.4
```

接着为了方便让 Kuryr Controller 简单取得 K8s API Server，这边修改 `/etc/kubernetes/manifests/kube-apiserver.yml` 文档，加入以下内容：
```
- "--insecure-bind-address=0.0.0.0"
- "--insecure-port=8080"
```
> 将 insecure 绑定到 0.0.0.0 之上，以及开启 8080 Port。

### 安装 Openstack Kuryr Controller
进入到 `172.24.0.34（controller）`，并且运行以下命令。

首先在节点安装所需要的软件包：
```shell=
$ sudo yum -y install  gcc libffi-devel python-devel openssl-devel install python-pip
```

下载 kuryr-kubernetes 并进行安装：
```shell=
$ git clone http://git.openstack.org/openstack/kuryr-kubernetes
$ pip install -e kuryr-kubernetes
```

创建 `kuryr.conf` 至 `/etc/kuryr` 目录
```shell=
$ cd kuryr-kubernetes
$ ./tools/generate_config_file_samples.sh
$ sudo mkdir -p /etc/kuryr/
$ sudo cp etc/kuryr.conf.sample /etc/kuryr/kuryr.conf
```

使用 OpenStack Dashboard 建立项目，在浏览器输入 `http://172.24.0.34`，并运行以下步骤。

1. 创建 k8s project。
2. 创建 kuryr-kubernetes service，并修改 k8s project member 加入到 service project。
3. 在该 Project 中新增 Security Groups，参考 [kuryr-kubernetes manually](https://docs.openstack.org/kuryr-kubernetes/latest/installation/manual.html)。
4. 在该 Project 中新增 pod_subnet 子网络。
5. 在该 Project 中新增 service_subnet 子网络。


完成后，修改 `/etc/kuryr/kuryr.conf` 文档，加入以下内容：
```
[DEFAULT]
use_stderr = true
bindir = /usr/local/libexec/kuryr

[kubernetes]
api_root = http://172.24.0.34:8080

[neutron]
auth_url = http://172.24.0.34/identity
username = admin
user_domain_name = Default
password = admin
project_name = service
project_domain_name = Default
auth_type = password

[neutron_defaults]
ovs_bridge = br-int
pod_security_groups = {id_of_secuirity_group_for_pods}
pod_subnet = {id_of_subnet_for_pods}
project = {id_of_project}
service_subnet = {id_of_subnet_for_k8s_services}
```

完成后运行 kuryr-k8s-controller：
```shell=
$ kuryr-k8s-controller --config-file /etc/kuryr/kuryr.conf&
```

### 安装 Kuryr-CNI
进入到 `172.24.0.80（node1）` 與 `172.24.0.81（node2）` 并运行以下命令。

首先在节点安装所需要的软件包
```shell=
$ sudo yum -y install  gcc libffi-devel python-devel openssl-devel python-pip
```

安装 Kuryr-CNI 来提供给 kubelet 使用：
```shell=
$ git clone http://git.openstack.org/openstack/kuryr-kubernetes
$ sudo pip install -e kuryr-kubernetes
```

创建 `kuryr.conf` 至 `/etc/kuryr` 目录：
```shell=
$ cd kuryr-kubernetes
$ ./tools/generate_config_file_samples.sh
$ sudo mkdir -p /etc/kuryr/
$ sudo cp etc/kuryr.conf.sample /etc/kuryr/kuryr.conf
```

修改 `/etc/kuryr/kuryr.conf` 文档，加入以下内容：
```
[DEFAULT]
use_stderr = true
bindir = /usr/local/libexec/kuryr
[kubernetes]
api_root = http://172.24.0.34:8080
```

创建 CNI bin 与 Conf 目录：
```shell=
$ sudo mkdir -p /opt/cni/bin
$ sudo ln -s $(which kuryr-cni) /opt/cni/bin/
$ sudo mkdir -p /etc/cni/net.d/
```

新增 `/etc/cni/net.d/10-kuryr.conf` CNI 配置档：
```
{
    "cniVersion": "0.3.0",
    "name": "kuryr",
    "type": "kuryr-cni",
    "kuryr_conf": "/etc/kuryr/kuryr.conf",
    "debug": true
}
```

完成后，更新 oslo 与 vif python 库：
```shell=
$ sudo pip install 'oslo.privsep>=1.20.0' 'os-vif>=1.5.0'
```

最后重新启动服务：
```
$ sudo systemctl daemon-reload && systemctl restart kubelet.service
```

## 测试结果

创建一个 Pod 与 OpenStack VM 来进行通信：
![](https://i.imgur.com/UYXdKud.png)

![](https://i.imgur.com/dwoEytW.png)

## 参考文档

- [Kuryr kubernetes documentation](https://docs.openstack.org/kuryr-kubernetes/latest/index.html)
