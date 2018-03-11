# 部署 Kubernetes Workers 节点

本部分将会部署三个 Kubernetes Worker 节点。每个节点上将会安装以下服务：

* [runc](https://github.com/opencontainers/runc)
* [container networking plugins](https://github.com/containernetworking/cni)
* [cri-containerd](https://github.com/kubernetes-incubator/cri-containerd)
* [kubelet](https://kubernetes.io/docs/admin/kubelet)
* [kube-proxy](https://kubernetes.io/docs/concepts/cluster-administration/proxies)

## 事前準备

以下命令需要在所有 worker 节点上面都运行一遍，包括 `worker-0`, `worker-1` 和 `worker-2`。可以使用 `gcloud` 命令登录到 worker 节点上，比如

```sh
gcloud compute ssh worker-0
```

## 部署 Kubernetes Worker 节点

安装 OS 依赖组件：

```sh
sudo apt-get -y install socat
```

> socat 命令用于支持 `kubectl port-forward` 命令。

### 下载并安装 worker 二进制文件

```sh
wget -q --show-progress --https-only --timestamping \
  https://github.com/containernetworking/plugins/releases/download/v0.6.0/cni-plugins-amd64-v0.6.0.tgz \
  https://github.com/kubernetes-incubator/cri-containerd/releases/download/v1.0.0-beta.0/cri-containerd-1.0.0-beta.0.linux-amd64.tar.gz \
  https://storage.googleapis.com/kubernetes-release/release/v1.9.0/bin/linux/amd64/kubectl \
  https://storage.googleapis.com/kubernetes-release/release/v1.9.0/bin/linux/amd64/kube-proxy \
  https://storage.googleapis.com/kubernetes-release/release/v1.9.0/bin/linux/amd64/kubelet
```

创建安装目录：

```sh
sudo mkdir -p \
  /etc/cni/net.d \
  /opt/cni/bin \
  /var/lib/kubelet \
  /var/lib/kube-proxy \
  /var/lib/kubernetes \
  /var/run/kubernetes
```

安装 worker 二进制文件

```sh
sudo tar -xvf cni-plugins-amd64-v0.6.0.tgz -C /opt/cni/bin/
sudo tar -xvf cri-containerd-1.0.0-beta.0.linux-amd64.tar.gz -C /
chmod +x kubectl kube-proxy kubelet
sudo mv kubectl kube-proxy kubelet /usr/local/bin/
```

### 配置 CNI 网路

查询当前计算节点的 Pod CIDR 范围：

```sh
POD_CIDR=$(curl -s -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/instance/attributes/pod-cidr)
```

生成 `bridge` 网络插件配置文件

```sh
cat > 10-bridge.conf <<EOF
{
    "cniVersion": "0.3.1",
    "name": "bridge",
    "type": "bridge",
    "bridge": "cnio0",
    "isGateway": true,
    "ipMasq": true,
    "ipam": {
        "type": "host-local",
        "ranges": [
          [{"subnet": "${POD_CIDR}"}]
        ],
        "routes": [{"dst": "0.0.0.0/0"}]
    }
}
EOF
```

生成 `loopback` 网络插件配置文件

```sh
cat > 99-loopback.conf <<EOF
{
    "cniVersion": "0.3.1",
    "type": "loopback"
}
EOF
```

将网络插件配置文件移动到 CNI 配置目录中：

```sh
sudo mv 10-bridge.conf 99-loopback.conf /etc/cni/net.d/
```

### 配置 Kubelet

```sh
sudo mv ${HOSTNAME}-key.pem ${HOSTNAME}.pem /var/lib/kubelet/
sudo mv ${HOSTNAME}.kubeconfig /var/lib/kubelet/kubeconfig
sudo mv ca.pem /var/lib/kubernetes/
```

生成 `kubelet.service` systemd 配置文件：

```sh
cat > kubelet.service <<EOF
[Unit]
Description=Kubernetes Kubelet
Documentation=https://github.com/kubernetes/kubernetes
After=cri-containerd.service
Requires=cri-containerd.service

[Service]
ExecStart=/usr/local/bin/kubelet \\
  --allow-privileged=true \\
  --anonymous-auth=false \\
  --authorization-mode=Webhook \\
  --client-ca-file=/var/lib/kubernetes/ca.pem \\
  --cloud-provider= \\
  --cluster-dns=10.32.0.10 \\
  --cluster-domain=cluster.local \\
  --container-runtime=remote \\
  --container-runtime-endpoint=unix:///var/run/cri-containerd.sock \\
  --image-pull-progress-deadline=2m \\
  --kubeconfig=/var/lib/kubelet/kubeconfig \\
  --network-plugin=cni \\
  --pod-cidr=${POD_CIDR} \\
  --register-node=true \\
  --runtime-request-timeout=15m \\
  --tls-cert-file=/var/lib/kubelet/${HOSTNAME}.pem \\
  --tls-private-key-file=/var/lib/kubelet/${HOSTNAME}-key.pem \\
  --v=2
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

### 配置 Kube-Proxy

```sh
sudo mv kube-proxy.kubeconfig /var/lib/kube-proxy/kubeconfig

```

生成 `kube-proxy.service` systemd 配置文件：

```sh
cat > kube-proxy.service <<EOF
[Unit]
Description=Kubernetes Kube Proxy
Documentation=https://github.com/kubernetes/kubernetes

[Service]
ExecStart=/usr/local/bin/kube-proxy \\
  --cluster-cidr=10.200.0.0/16 \\
  --kubeconfig=/var/lib/kube-proxy/kubeconfig \\
  --proxy-mode=iptables \\
  --v=2
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

### 启动 worker 服务

```sh
sudo mv kubelet.service kube-proxy.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable containerd cri-containerd kubelet kube-proxy
sudo systemctl start containerd cri-containerd kubelet kube-proxy
```

> 记得在所有 worker 节点上面都运行一遍，包括 `worker-0`, `worker-1` 和 `worker-2`。

## 验证

登入任意一台控制节点：

```sh
gcloud compute ssh controller-0
```

列出目前已注册的 Kubernetes 节点:

```sh
kubectl get nodes
```

输出为

```sh
NAME       STATUS    ROLES     AGE       VERSION
worker-0   Ready     <none>    18s       v1.9.0
worker-1   Ready     <none>    18s       v1.9.0
worker-2   Ready     <none>    18s       v1.9.0
```

下一步：[配置 Kubectl](10-configuring-kubectl.md)。
