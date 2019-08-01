# 部署 etcd 群集

Kubernetes 組件都是無狀態的，所有的群集狀態都儲存在 [etcd](https://github.com/coreos/etcd) 集群中。

本部分內容將部署一套三節點的 etcd 群集，並配置高可用以及遠程加密訪問。

## 事前準備

本部分的命令需要在每個控制節點上都運行一遍，包括 `controller-0`、`controller-1` 和 `controller-2`。可以使用 `gcloud` 命令登錄每個控制節點，比如

```sh
gcloud compute ssh controller-0
```

可以使用 tmux 同時登錄到三點控制節點上，加快部署步驟。

## 部署 etcd 集群成員

### 下載並安裝 etcd 二進制文件

從 [coreos/etcd](https://github.com/coreos/etcd) GitHub 中下載 etcd 發佈文件：

```sh
wget -q --show-progress --https-only --timestamping \
  "https://github.com/coreos/etcd/releases/download/v3.3.9/etcd-v3.3.9-linux-amd64.tar.gz"
```

解壓縮並安裝 `etcd` 服務與 `etcdctl` 命令行工具：

```sh
tar -xvf etcd-v3.3.9-linux-amd64.tar.gz
sudo mv etcd-v3.3.9-linux-amd64/etcd* /usr/local/bin/
```

### 配置 etcd Server

```sh
sudo mkdir -p /etc/etcd /var/lib/etcd
sudo cp ca.pem kubernetes-key.pem kubernetes.pem /etc/etcd/
```

使用虛擬機的內網 IP 地址來作為 etcd 集群的服務地址。查詢當前節點的內網 IP 地址：

```sh
INTERNAL_IP=$(curl -s -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/ip)
```

每個 etcd 成員必須有一個整集群中唯一的名字，使用 hostname 作為 etcd name：

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

### 啟動 etcd Server

```sh
sudo systemctl daemon-reload
sudo systemctl enable etcd
sudo systemctl start etcd
```

> 不要忘記在所有控制節點上都運行上述命令，包括 `controller-0`、`controller-1` 和 `controller-2` 等。

## 驗證

列出 etcd 的群集成員:

```sh
sudo ETCDCTL_API=3 etcdctl member list \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/etcd/ca.pem \
  --cert=/etc/etcd/kubernetes.pem \
  --key=/etc/etcd/kubernetes-key.pem
```

> 輸出

```sh
3a57933972cb5131, started, controller-2, https://10.240.0.12:2380, https://10.240.0.12:2379
f98dc20bce6225a0, started, controller-0, https://10.240.0.10:2380, https://10.240.0.10:2379
ffed16798470cab5, started, controller-1, https://10.240.0.11:2380, https://10.240.0.11:2379
```

下一步：[部署 Kubernetes 控制節點](08-bootstrapping-kubernetes-controllers.md)。
