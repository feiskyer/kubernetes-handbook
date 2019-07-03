# 部署 etcd 群集

Kubernetes 组件都是无状态的，所有的群集状态都储存在 [etcd](https://github.com/coreos/etcd) 集群中。

本部分内容将部署一套三节点的 etcd 群集，并配置高可用以及远程加密访问。

## 事前准备

本部分的命令需要在每个控制节点上都运行一遍，包括 `controller-0`、`controller-1` 和 `controller-2`。可以使用 `gcloud` 命令登录每个控制节点，比如

```sh
gcloud compute ssh controller-0
```

可以使用 tmux 同时登录到三点控制节点上，加快部署步骤。

## 部署 etcd 集群成员

### 下载并安装 etcd 二进制文件

从 [coreos/etcd](https://github.com/coreos/etcd) GitHub 中下载 etcd 发布文件：

```sh
wget -q --show-progress --https-only --timestamping \
  "https://github.com/coreos/etcd/releases/download/v3.3.9/etcd-v3.3.9-linux-amd64.tar.gz"
```

解压缩并安装 `etcd` 服务与 `etcdctl` 命令行工具：

```sh
tar -xvf etcd-v3.3.9-linux-amd64.tar.gz
sudo mv etcd-v3.3.9-linux-amd64/etcd* /usr/local/bin/
```

### 配置 etcd Server

```sh
sudo mkdir -p /etc/etcd /var/lib/etcd
sudo cp ca.pem kubernetes-key.pem kubernetes.pem /etc/etcd/
```

使用虚拟机的内网 IP 地址来作为 etcd 集群的服务地址。查询当前节点的内网 IP 地址：

```sh
INTERNAL_IP=$(curl -s -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/ip)
```

每个 etcd 成员必须有一个整集群中唯一的名字，使用 hostname 作为 etcd name：

```sh
ETCD_NAME=$(hostname -s)
```

生成 `etcd.service` 的 systemd 配置文件

```sh
cat <<EOF | sudo tee /etc/systemd/system/etcd.service
[Unit]
Description=etcd
Documentation=https://github.com/coreos

[Service]
ExecStart=/usr/local/bin/etcd \\
  --name ${ETCD_NAME} \\
  --cert-file=/etc/etcd/kubernetes.pem \\
  --key-file=/etc/etcd/kubernetes-key.pem \\
  --peer-cert-file=/etc/etcd/kubernetes.pem \\
  --peer-key-file=/etc/etcd/kubernetes-key.pem \\
  --trusted-ca-file=/etc/etcd/ca.pem \\
  --peer-trusted-ca-file=/etc/etcd/ca.pem \\
  --peer-client-cert-auth \\
  --client-cert-auth \\
  --initial-advertise-peer-urls https://${INTERNAL_IP}:2380 \\
  --listen-peer-urls https://${INTERNAL_IP}:2380 \\
  --listen-client-urls https://${INTERNAL_IP}:2379,https://127.0.0.1:2379 \\
  --advertise-client-urls https://${INTERNAL_IP}:2379 \\
  --initial-cluster-token etcd-cluster-0 \\
  --initial-cluster controller-0=https://10.240.0.10:2380,controller-1=https://10.240.0.11:2380,controller-2=https://10.240.0.12:2380 \\
  --initial-cluster-state new \\
  --data-dir=/var/lib/etcd
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

### 启动 etcd Server

```sh
sudo systemctl daemon-reload
sudo systemctl enable etcd
sudo systemctl start etcd
```

> 不要忘记在所有控制节点上都运行上述命令，包括 `controller-0`、`controller-1` 和 `controller-2` 等。

## 验证

列出 etcd 的群集成员:

```sh
sudo ETCDCTL_API=3 etcdctl member list \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/etcd/ca.pem \
  --cert=/etc/etcd/kubernetes.pem \
  --key=/etc/etcd/kubernetes-key.pem
```

> 输出

```sh
3a57933972cb5131, started, controller-2, https://10.240.0.12:2380, https://10.240.0.12:2379
f98dc20bce6225a0, started, controller-0, https://10.240.0.10:2380, https://10.240.0.10:2379
ffed16798470cab5, started, controller-1, https://10.240.0.11:2380, https://10.240.0.11:2379
```

下一步：[部署 Kubernetes 控制节点](08-bootstrapping-kubernetes-controllers.md)。
