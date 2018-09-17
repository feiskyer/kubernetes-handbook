# kubeadm 工作原理

kubeadm 是 Kubernetes 主推的部署工具之一，正在快速迭代开发中。

## 初始化系统

所有机器都需要初始化容器执行引擎（如 docker 或 frakti 等）和 kubelet。这是因为 kubeadm 依赖 kubelet 来启动 Master 组件，比如 kube-apiserver、kube-manager-controller、kube-scheduler、kube-proxy 等。

## 安装 master

在初始化 master 时，只需要执行 kubeadm init 命令即可，比如

```sh
kubeadm init --pod-network-cidr 10.244.0.0/16 --kubernetes-version stable
```

这个命令会自动

- 系统状态检查
- 生成 token
- 生成自签名 CA 和 client 端证书
- 生成 kubeconfig 用于 kubelet 连接 API server
- 为 Master 组件生成 Static Pod manifests，并放到 `/etc/kubernetes/manifests` 目录中
- 配置 RBAC 并设置 Master node 只运行控制平面组件
- 创建附加服务，比如 kube-proxy 和 kube-dns

## 配置 Network plugin

kubeadm 在初始化时并不关心网络插件，默认情况下，kubelet 配置使用 CNI 插件，这样就需要用户来额外初始化网络插件。

### CNI bridge

```sh
mkdir -p /etc/cni/net.d
cat >/etc/cni/net.d/10-mynet.conf <<-EOF
{
    "cniVersion": "0.3.0",
    "name": "mynet",
    "type": "bridge",
    "bridge": "cni0",
    "isGateway": true,
    "ipMasq": true,
    "ipam": {
        "type": "host-local",
        "subnet": "10.244.1.0/24",
        "routes": [
            {"dst": "0.0.0.0/0"}
        ]
    }
}
EOF
cat >/etc/cni/net.d/99-loopback.conf <<-EOF
{
    "cniVersion": "0.3.0",
    "type": "loopback"
}
EOF
```

### flannel

```sh
kubectl create -f https://github.com/coreos/flannel/raw/master/Documentation/kube-flannel-rbac.yml
kubectl create -f https://github.com/coreos/flannel/raw/master/Documentation/kube-flannel.yml
```

### weave

```sh
kubectl apply -f "https://cloud.weave.works/k8s/net?k8s-version=$(kubectl version | base64 | tr -d'\n')"
```

### calico

```sh
kubectl apply -f https://docs.projectcalico.org/v3.1/getting-started/kubernetes/installation/hosted/rbac-kdd.yaml
kubectl apply -f https://docs.projectcalico.org/v3.1/getting-started/kubernetes/installation/hosted/kubernetes-datastore/calico-networking/1.7/calico.yaml
```

## 添加 Node

```sh
token=$(kubeadm token list | grep authentication,signing | awk '{print $1}')
kubeadm join --token $token ${master_ip}
```

这包括以下几个步骤

- 从 API server 下载 CA
- 创建本地证书，并请求 API Server 签名
- 最后配置 kubelet 连接到 API Server

## 删除安装

```sh
kubeadm reset
```

## 参考文档

- [kubeadm Setup Tool](https://kubernetes.io/docs/admin/kubeadm/)
