
# 启动 etcd 群集

Kubernetes 组件是属于无状态并且将群集状态储存到[etcd](https://github.com/coreos/etcd)

在这次实验中你将会启动三个节点的etcd群集, 并且做一些相关设定让群集高可用与建立远端安全连线

## 事前準备

这次的指令必须在每个控制节点上使用:`controller-0`, `controller-1`, 与 `controller-2`。使用 `gcloud` 的指令登入每个控制节点。

例如:

```
gcloud compute ssh controller-0
```

## 启动一个etcd群集的成员

### 下载并安装 etcd 的执行档

从[coreos/etcd](https://github.com/coreos/etcd) GitHub专案下载etcd开放的执行档:


```
wget -q --show-progress --https-only --timestamping \
  "https://github.com/coreos/etcd/releases/download/v3.2.8/etcd-v3.2.8-linux-amd64.tar.gz"
```

解压缩并安装`etcd` server 与 `etcdctl`指令工具 :

```
tar -xvf etcd-v3.2.8-linux-amd64.tar.gz
```

```
sudo mv etcd-v3.2.8-linux-amd64/etcd* /usr/local/bin/
```
### 设定etcd Server

```
sudo mkdir -p /etc/etcd /var/lib/etcd
```

```
sudo cp ca.pem kubernetes-key.pem kubernetes.pem /etc/etcd/
```

节点的内部IP address 将被用来接收 client 的请求并且联系整个etcd群集。 取得目前计算节点的内部IP address:


```
INTERNAL_IP=$(curl -s -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/ip)
```

每个 etcd 成员必须有一个特別的名字在整个 etcd 的群集里。 设定 etcd 名字去对应到目前计算节点的 hostname :

```
ETCD_NAME=$(hostname -s)
```

建立  `etcd.service`  的systemd unit file:



```
cat > etcd.service <<EOF
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
  --listen-client-urls https://${INTERNAL_IP}:2379,http://127.0.0.1:2379 \\
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


```
sudo mv etcd.service /etc/systemd/system/
```

```
sudo systemctl daemon-reload
```

```
sudo systemctl enable etcd
```

```
sudo systemctl start etcd
```

> 记得上述的指令都要执行每个控制节点上: `controller-0`, `controller-1`, and `controller-2`


## 验证

列出etcd的群集成员:


```
ETCDCTL_API=3 etcdctl member list
```

> 输出

```
3a57933972cb5131, started, controller-2, https://10.240.0.12:2380, https://10.240.0.12:2379
f98dc20bce6225a0, started, controller-0, https://10.240.0.10:2380, https://10.240.0.10:2379
ffed16798470cab5, started, controller-1, https://10.240.0.11:2380, https://10.240.0.11:2379
```
Next: [启动 Kubernetes 控制平台](08-bootstrapping-kubernetes-controllers.md)

