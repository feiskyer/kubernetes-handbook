# kubeadm 工作原理

kubeadm 是 Kubernetes 主推的部署工具之一，正在快速迭代開發中。

## 初始化系統

所有機器都需要初始化容器執行引擎（如 docker 或 frakti 等）和 kubelet。這是因為 kubeadm 依賴 kubelet 來啟動 Master 組件，比如 kube-apiserver、kube-manager-controller、kube-scheduler、kube-proxy 等。

## 安裝 master

在初始化 master 時，只需要執行 kubeadm init 命令即可，比如

```sh
kubeadm init --pod-network-cidr 10.244.0.0/16 --kubernetes-version stable
```

這個命令會自動

- 系統狀態檢查
- 生成 token
- 生成自簽名 CA 和 client 端證書
- 生成 kubeconfig 用於 kubelet 連接 API server
- 為 Master 組件生成 Static Pod manifests，並放到 `/etc/kubernetes/manifests` 目錄中
- 配置 RBAC 並設置 Master node 只運行控制平面組件
- 創建附加服務，比如 kube-proxy 和 kube-dns

## 配置 Network plugin

kubeadm 在初始化時並不關心網絡插件，默認情況下，kubelet 配置使用 CNI 插件，這樣就需要用戶來額外初始化網絡插件。

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

這包括以下幾個步驟

- 從 API server 下載 CA
- 創建本地證書，並請求 API Server 簽名
- 最後配置 kubelet 連接到 API Server

## 刪除安裝

```sh
kubeadm reset
```

## 參考文檔

- [kubeadm Setup Tool](https://kubernetes.io/docs/admin/kubeadm/)
