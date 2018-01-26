# 排错工具

本章主要介绍在 Kubernetes 排错中常用的工具。

### 必备工具

* kubectl：用于查看 Kubernetes 集群状态
* journalctl：用于查看 Kubernetes 组件日志
* iptables：用于排查 Service 是否工作
* tcpdump：用于排查容器网络问题

### sysdig

sysdig 是一个容器排错工具，提供了开源和商业版本。对于常规排错来说，使用开源版本即可。

除了 sysdig，还可以使用其他两个辅助工具

* csysdig：与 sysdig 一起自动安装，提供了一个命令行界面


* [sysdig-inspect](https://github.com/draios/sysdig-inspect)：为 sysdig 保存的跟踪问题提供了一个图形界面

#### 安装

```sh
# on Linux
curl -s https://s3.amazonaws.com/download.draios.com/stable/install-sysdig | sudo bash

# on MacOS
brew install sysdig
```

#### 示例

```sh
# Refer https://www.sysdig.org/wiki/sysdig-examples/.
# View the top network connections for a single container
sysdig -pc -c topconns

# Show the network data exchanged with the host 192.168.0.1
sysdig -s2000 -A -c echo_fds fd.cip=192.168.0.1
 
# List all the incoming connections that are not served by apache.
sysdig -p"%proc.name %fd.name" "evt.type=accept and proc.name!=httpd"

# View the CPU/Network/IO usage of the processes running inside the container.
sysdig -pc -c topprocs_cpu container.id=2e854c4525b8
sysdig -pc -c topprocs_net container.id=2e854c4525b8
sysdig -pc -c topfiles_bytes container.id=2e854c4525b8

# See the files where apache spends the most time doing I/O
sysdig -c topfiles_time proc.name=httpd

# Show all the interactive commands executed inside a given container.
sysdig -pc -c spy_users 

# Show every time a file is opened under /etc.
sysdig evt.type=open and fd.name 
```

