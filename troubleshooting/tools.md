# 排錯工具

本章主要介紹在 Kubernetes 排錯中常用的工具。

## 必備工具

* `kubectl`：用於查看 Kubernetes 集群以及容器的狀態，如 `kubectl describe pod <pod-name>`
* `journalctl`：用於查看 Kubernetes 組件日誌，如 `journalctl -u kubelet -l`
* `iptables`和`ebtables`：用於排查 Service 是否工作，如 `iptables -t nat -nL` 查看 kube-proxy 配置的 iptables 規則是否正常
* `tcpdump`：用於排查容器網絡問題，如 `tcpdump -nn host 10.240.0.8`
* `perf`：Linux 內核自帶的性能分析工具，常用來排查性能問題，如 [Container Isolation Gone Wrong](https://dzone.com/articles/container-isolation-gone-wrong) 問題的排查

## sysdig

sysdig 是一個容器排錯工具，提供了開源和商業版本。對於常規排錯來說，使用開源版本即可。

除了 sysdig，還可以使用其他兩個輔助工具

* csysdig：與 sysdig 一起自動安裝，提供了一個命令行界面


* [sysdig-inspect](https://github.com/draios/sysdig-inspect)：為 sysdig 保存的跟蹤文件（如 `sudo sysdig -w filename.scap`）提供了一個圖形界面（非實時）

### 安裝

```sh
# on Ubuntu
curl -s https://s3.amazonaws.com/download.draios.com/DRAIOS-GPG-KEY.public | apt-key add -
curl -s -o /etc/apt/sources.list.d/draios.list http://download.draios.com/stable/deb/draios.list
apt-get update
apt-get -y install linux-headers-$(uname -r)
apt-get -y install sysdig

# on REHL
rpm --import https://s3.amazonaws.com/download.draios.com/DRAIOS-GPG-KEY.public
curl -s -o /etc/yum.repos.d/draios.repo http://download.draios.com/stable/rpm/draios.repo
rpm -i http://mirror.us.leaseweb.net/epel/6/i386/epel-release-6-8.noarch.rpm
yum -y install kernel-devel-$(uname -r)
yum -y install sysdig

# on MacOS
brew install sysdig
```

### 示例

```sh
# Refer https://www.sysdig.org/wiki/sysdig-examples/.
# View the top network connections
sudo sysdig -pc -c topconns
# View the top network connections inside the wordpress1 container
sudo sysdig -pc -c topconns container.name=wordpress1

# Show the network data exchanged with the host 192.168.0.1
sudo sysdig fd.ip=192.168.0.1
sudo sysdig -s2000 -A -c echo_fds fd.cip=192.168.0.1
 
# List all the incoming connections that are not served by apache.
sudo sysdig -p"%proc.name %fd.name" "evt.type=accept and proc.name!=httpd"

# View the CPU/Network/IO usage of the processes running inside the container.
sudo sysdig -pc -c topprocs_cpu container.id=2e854c4525b8
sudo sysdig -pc -c topprocs_net container.id=2e854c4525b8
sudo sysdig -pc -c topfiles_bytes container.id=2e854c4525b8

# See the files where apache spends the most time doing I/O
sudo sysdig -c topfiles_time proc.name=httpd

# Show all the interactive commands executed inside a given container.
sudo sysdig -pc -c spy_users 

# Show every time a file is opened under /etc.
sudo sysdig evt.type=open and fd.name

# View the list of processes with container context
sudo csysdig -pc
```

更多示例和使用方法可以參考 [Sysdig User Guide](https://github.com/draios/sysdig/wiki/Sysdig-User-Guide)。

## Weave Scope

Weave Scope 是另外一款可視化容器監控和排錯工具。與 sysdig 相比，它沒有強大的命令行工具，但提供了一個簡單易用的交互界面，自動描繪了整個集群的拓撲，並可以通過插件擴展其功能。從其官網的介紹來看，其提供的功能包括

- [交互式拓撲界面](https://www.weave.works/docs/scope/latest/features/#topology-mapping)
- [圖形模式和表格模式](https://www.weave.works/docs/scope/latest/features/#mode)
- [過濾功能](https://www.weave.works/docs/scope/latest/features/#flexible-filtering)
- [搜索功能](https://www.weave.works/docs/scope/latest/features/#powerful-search)
- [實時度量](https://www.weave.works/docs/scope/latest/features/#real-time-app-and-container-metrics)
- [容器排錯](https://www.weave.works/docs/scope/latest/features/#interact-with-and-manage-containers)
- [插件擴展](https://www.weave.works/docs/scope/latest/features/#custom-plugins)

Weave Scope 由 [App 和 Probe 兩部分](https://www.weave.works/docs/scope/latest/how-it-works)組成，它們

- Probe 負責收集容器和宿主的信息，併發送給 App
- App 負責處理這些信息，並生成相應的報告，並以交互界面的形式展示

```sh
                    +--Docker host----------+      +--Docker host----------+
.---------------.   |  +--Container------+  |      |  +--Container------+  |
| Browser       |   |  |                 |  |      |  |                 |  |
|---------------|   |  |  +-----------+  |  |      |  |  +-----------+  |  |
|               |----->|  | scope-app |<-----.    .----->| scope-app |  |  |
|               |   |  |  +-----------+  |  | \  / |  |  +-----------+  |  |
|               |   |  |        ^        |  |  \/  |  |        ^        |  |
'---------------'   |  |        |        |  |  /\  |  |        |        |  |
                    |  | +-------------+ |  | /  \ |  | +-------------+ |  |
                    |  | | scope-probe |-----'    '-----| scope-probe | |  |
                    |  | +-------------+ |  |      |  | +-------------+ |  |
                    |  |                 |  |      |  |                 |  |
                    |  +-----------------+  |      |  +-----------------+  |
                    +-----------------------+      +-----------------------+
```

### 安裝

```sh
kubectl apply -f "https://cloud.weave.works/k8s/scope.yaml?k8s-version=$(kubectl version | base64 | tr -d '\n')&k8s-service-type=LoadBalancer"
```

### 查看界面

安裝完成後，可以通過 weave-scope-app 來訪問交互界面

```sh
kubectl -n weave get service weave-scope-app
kubectl -n weave port-forward service/weave-scope-app :80
```

![](images/weave-scope.png)

點擊 Pod，還可以查看該 Pod 所有容器的實時狀態和度量數據：

![](images/scope-pod.png)

### 已知問題

在 Ubuntu 內核 4.4.0 上面開啟 `--probe.ebpf.connections` 時（默認開啟），Node 有可能會因為[內核問題而不停重啟](https://github.com/weaveworks/scope/issues/3131)：

```sh
[ 263.736006] CPU: 0 PID: 6309 Comm: scope Not tainted 4.4.0-119-generic #143-Ubuntu
[ 263.736006] Hardware name: Microsoft Corporation Virtual Machine/Virtual Machine, BIOS 090007 06/02/2017
[ 263.736006] task: ffff88011cef5400 ti: ffff88000a0e4000 task.ti: ffff88000a0e4000
[ 263.736006] RIP: 0010:[] [] bpf_map_lookup_elem+0x6/0x20
[ 263.736006] RSP: 0018:ffff88000a0e7a70 EFLAGS: 00010082
[ 263.736006] RAX: ffffffff8117cd70 RBX: ffffc90000762068 RCX: 0000000000000000
[ 263.736006] RDX: 0000000000000000 RSI: ffff88000a0e7cd8 RDI: 000000001cdee380
[ 263.736006] RBP: ffff88000a0e7cf8 R08: 0000000005080021 R09: 0000000000000000
[ 263.736006] R10: 0000000000000020 R11: ffff880159e1c700 R12: 0000000000000000
[ 263.736006] R13: ffff88011cfaf400 R14: ffff88000a0e7e38 R15: ffff88000a0f8800
[ 263.736006] FS: 00007f5b0cd79700(0000) GS:ffff88015b600000(0000) knlGS:0000000000000000
[ 263.736006] CS: 0010 DS: 0000 ES: 0000 CR0: 0000000080050033
[ 263.736006] CR2: 000000001cdee3a8 CR3: 000000011ce04000 CR4: 0000000000040670
[ 263.736006] Stack:
[ 263.736006] ffff88000a0e7cf8 ffffffff81177411 0000000000000000 00001887000018a5
[ 263.736006] 000000001cdee380 ffff88000a0e7cd8 0000000000000000 0000000000000000
[ 263.736006] 0000000005080021 ffff88000a0e7e38 0000000000000000 0000000000000046
[ 263.736006] Call Trace:
[ 263.736006] [] ? __bpf_prog_run+0x7a1/0x1360
[ 263.736006] [] ? update_curr+0x79/0x170
[ 263.736006] [] ? update_cfs_shares+0xbc/0x100
[ 263.736006] [] ? update_curr+0x79/0x170
[ 263.736006] [] ? dput+0xb8/0x230
[ 263.736006] [] ? follow_managed+0x265/0x300
[ 263.736006] [] ? kmem_cache_alloc_trace+0x1d4/0x1f0
[ 263.736006] [] ? seq_open+0x5a/0xa0
[ 263.736006] [] ? probes_open+0x33/0x100
[ 263.736006] [] ? dput+0x34/0x230
[ 263.736006] [] ? mntput+0x24/0x40
[ 263.736006] [] trace_call_bpf+0x37/0x50
[ 263.736006] [] kretprobe_perf_func+0x3d/0x250
[ 263.736006] [] ? pre_handler_kretprobe+0x135/0x1b0
[ 263.736006] [] kretprobe_dispatcher+0x3d/0x60
[ 263.736006] [] ? do_sys_open+0x1b2/0x2a0
[ 263.736006] [] ? kretprobe_trampoline_holder+0x9/0x9
[ 263.736006] [] trampoline_handler+0x133/0x210
[ 263.736006] [] ? do_sys_open+0x1b2/0x2a0
[ 263.736006] [] kretprobe_trampoline+0x25/0x57
[ 263.736006] [] ? kretprobe_trampoline_holder+0x9/0x9
[ 263.736006] [] SyS_openat+0x14/0x20
[ 263.736006] [] entry_SYSCALL_64_fastpath+0x1c/0xbb
```

解決方法有兩種

- 禁止 eBPF 探測，如 `--probe.ebpf.connections=false`
- 升級內核，如升級到 4.13.0

## 參考文檔

- [Overview of kubectl](https://kubernetes.io/docs/reference/kubectl/overview/)
- [Monitoring Kuberietes with sysdig](https://sysdig.com/blog/kubernetes-service-discovery-docker/)