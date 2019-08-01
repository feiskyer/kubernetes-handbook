# Cilium

[Cilium ](https://github.com/cilium/cilium)是一個基於 eBPF 和 XDP 的高性能容器網絡方案，代碼開源在 <https://github.com/cilium/cilium>。其主要功能特性包括

- 安全上，支持 L3/L4/L7 安全策略，這些策略按照使用方法又可以分為
  - 基於身份的安全策略（security identity）
  - 基於 CIDR 的安全策略
  - 基於標籤的安全策略
- 網絡上，支持三層平面網絡（flat layer 3 network），如
  - 覆蓋網絡（Overlay），包括 VXLAN 和 Geneve 等
  - Linux 路由網絡，包括原生的 Linux 路由和雲服務商的高級網絡路由等
- 提供基於 BPF 的負載均衡
- 提供便利的監控和排錯能力

![](cilium.png)

## eBPF 和 XDP

eBPF（extended Berkeley Packet Filter）起源於BPF，它提供了內核的數據包過濾機制。BPF的基本思想是對用戶提供兩種SOCKET選項：`SO_ATTACH_FILTER`和`SO_ATTACH_BPF`，允許用戶在sokcet上添加自定義的filter，只有滿足該filter指定條件的數據包才會上發到用戶空間。`SO_ATTACH_FILTER`插入的是cBPF代碼，`SO_ATTACH_BPF`插入的是eBPF代碼。eBPF是對cBPF的增強，目前用戶端的tcpdump等程序還是用的cBPF版本，其加載到內核中後會被內核自動的轉變為eBPF。Linux 3.15 開始引入 eBPF。其擴充了 BPF 的功能，豐富了指令集。它在內核提供了一個虛擬機，用戶態將過濾規則以虛擬機指令的形式傳遞到內核，由內核根據這些指令來過濾網絡數據包。

![](bpf.png)

XDP（eXpress Data Path）為Linux內核提供了高性能、可編程的網絡數據路徑。由於網絡包在還未進入網絡協議棧之前就處理，它給Linux網絡帶來了巨大的性能提升。XDP 看起來跟 DPDK 比較像，但它比 DPDK 有更多的優點，如

- 無需第三方代碼庫和許可
- 同時支持輪詢式和中斷式網絡
- 無需分配大頁
- 無需專用的CPU
- 無需定義新的安全網絡模型

當然，XDP的性能提升是有代價的，它犧牲了通用型和公平性：（1）不提供緩存隊列（qdisc），TX設備太慢時直接丟包，因而不要在RX比TX快的設備上使用XDP；（2）XDP程序是專用的，不具備網絡協議棧的通用性。

## 部署

版本要求

- Linux Kernel >= 4.8 （推薦 4.9.17 LTS）
- KV 存儲（etcd >= 3.1.0 或 consul >= 0.6.4）

### Kubernetes Cluster

```sh
# mount BPF filesystem on all nodes
$ mount bpffs /sys/fs/bpf -t bpf

$ wget https://raw.githubusercontent.com/cilium/cilium/doc-1.0/examples/kubernetes/1.10/cilium.yaml
$ vim cilium.yaml
[adjust the etcd address]

$ kubectl create -f ./cilium.yaml
```

### minikube

```sh
minikube start --network-plugin=cni --bootstrapper=localkube --memory=4096 --extra-config=apiserver.Authorization.Mode=RBAC
kubectl create clusterrolebinding kube-system-default-binding-cluster-admin --clusterrole=cluster-admin --serviceaccount=kube-system:default
kubectl create -f https://raw.githubusercontent.com/cilium/cilium/HEAD/examples/kubernetes/addons/etcd/standalone-etcd.yaml
kubectl create -f https://raw.githubusercontent.com/cilium/cilium/HEAD/examples/kubernetes/1.10/cilium.yaml
```

### Istio

```sh
# cluster clusterrolebindings
kubectl create clusterrolebinding kube-system-default-binding-cluster-admin --clusterrole=cluster-admin --serviceaccount=kube-system:default
# etcd
kubectl create -f https://raw.githubusercontent.com/cilium/cilium/HEAD/examples/kubernetes/addons/etcd/standalone-etcd.yaml

# cilium
curl -s https://raw.githubusercontent.com/cilium/cilium/HEAD/examples/kubernetes/1.10/cilium.yaml | \
  sed -e 's/sidecar-http-proxy: "false"/sidecar-http-proxy: "true"/' | \
  kubectl create -f -

# Istio
curl -L https://git.io/getLatestIstio | sh -
ISTIO_VERSION=$(curl -L -s https://api.github.com/repos/istio/istio/releases/latest | jq -r .tag_name)
cd istio-${ISTIO_VERSION}
cp bin/istioctl /usr/local/bin

# Patch with cilium pilot
sed -e 's,docker\.io/istio/pilot:,docker.io/cilium/istio_pilot:,' \
      < install/kubernetes/istio.yaml | \
      kubectl create -f -

# Configure Istio’s sidecar injection to use Cilium’s Docker images for the sidecar proxies
kubectl create -f https://raw.githubusercontent.com/cilium/cilium/HEAD/examples/kubernetes-istio/istio-sidecar-injector-configmap-release.yaml
```

## 安全策略

TCP 策略：

```yaml
apiVersion: "cilium.io/v2"
kind: CiliumNetworkPolicy
description: "L3-L4 policy to restrict deathstar access to empire ships only"
metadata:
  name: "rule1"
spec:
  endpointSelector:
    matchLabels:
      org: empire
      class: deathstar
  ingress:
  - fromEndpoints:
    - matchLabels:
        org: empire
    toPorts:
    - ports:
      - port: "80"
        protocol: TCP
```

CIDR 策略

```yaml
apiVersion: "cilium.io/v2"
kind: CiliumNetworkPolicy
metadata:
  name: "cidr-rule"
spec:
  endpointSelector:
    matchLabels:
      app: myService
  egress:
  - toCIDR:
    - 20.1.1.1/32
  - toCIDRSet:
    - cidr: 10.0.0.0/8
      except:
      - 10.96.0.0/12
```

L7 HTTP 策略：

```sh
apiVersion: "cilium.io/v2"
kind: CiliumNetworkPolicy
description: "L7 policy to restrict access to specific HTTP call"
metadata:
  name: "rule1"
spec:
  endpointSelector:
    matchLabels:
      org: empire
      class: deathstar
  ingress:
  - fromEndpoints:
    - matchLabels:
        org: empire
    toPorts:
    - ports:
      - port: "80"
        protocol: TCP
      rules:
        http:
        - method: "POST"
          path: "/v1/request-landing"
```

## 監控

[microscope](https://github.com/cilium/microscope) 彙集了所有 Nodes 的監控數據（從 `cilium monitor` 獲取）。使用方法為：

```sh
$ kubectl apply -f
https://github.com/cilium/microscope/blob/master/docs/microscope.yaml
$ kubectl exec -n kube-system microscope -- microscope -h
```

## 參考資料

- [Cilium documentation](http://cilium.readthedocs.io/)

