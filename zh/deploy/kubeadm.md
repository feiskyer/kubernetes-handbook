# kubeadm

> Kubernetes 一键部署脚本（使用 docker 运行时）

```sh
# on master
export USE_MIRROR=true
git clone https://github.com/feiskyer/ops
cd ops
kubernetes/install-kubernetes.sh
# 记住控制台输出的 TOEKN 和 MASTER 地址，在其他 Node 安装时会用到

# on all nodes
git clone https://github.com/feiskyer/ops
cd ops
# Setup token and CIDR first.
# replace this with yours.
export TOKEN="xxxx"
export MASTER_IP="x.x.x.x"
export CONTAINER_CIDR="10.244.2.0/24"

# Setup and join the new node.
./kubernetes/add-node.sh
```

注意：** 国内用户需要在执行上述命令前设置使用国内镜像 `export USE_MIRROR=true`**。

以下是详细的 kubeadm 部署集群步骤。

## 初始化系统

所有机器都需要初始化 docker 和 kubelet。

### ubuntu

```sh
# for ubuntu 16.04
apt-get update
apt-get install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
add-apt-repository "deb https://download.docker.com/linux/$(. /etc/os-release; echo "$ID") $(lsb_release -cs) stable"
apt-get update && apt-get install -y docker-ce=$(apt-cache madison docker-ce | grep 17.03 | head -1 | awk '{print $3}')

apt-get update && apt-get install -y apt-transport-https curl
curl -s https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key add -
cat <<EOF >/etc/apt/sources.list.d/kubernetes.list
deb http://apt.kubernetes.io/ kubernetes-xenial main
EOF
apt-get update
apt-get install -y kubelet kubeadm kubectl
```

> 国内用户可以使用阿里云的镜像来安装
>
> ```sh
> cat <<EOF >/etc/apt/sources.list.d/kubernetes.list
> deb https://mirrors.aliyun.com/kubernetes/apt/ kubernetes-xenial main
> EOF
> ```

### CentOS

```sh
yum install -y docker
systemctl enable docker && systemctl start docker

cat <<EOF > /etc/yum.repos.d/kubernetes.repo
[kubernetes]
name=Kubernetes
baseurl=https://packages.cloud.google.com/yum/repos/kubernetes-el7-x86_64
enabled=1
gpgcheck=1
repo_gpgcheck=1
gpgkey=https://packages.cloud.google.com/yum/doc/yum-key.gpg https://packages.cloud.google.com/yum/doc/rpm-package-key.gpg
EOF
setenforce 0
yum install -y kubelet kubeadm kubectl
systemctl enable kubelet && systemctl start kubelet

cat <<EOF >  /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-ip6tables = 1
net.bridge.bridge-nf-call-iptables = 1
EOF
sysctl --system
```

> 国内用户可以使用阿里云的镜像来安装
>
> ```sh
> cat <<EOF> /etc/yum.repos.d/kubernetes.repo
> [kubernetes]
> name=Kubernetes
> baseurl=https://mirrors.aliyun.com/kubernetes/yum/repos/kubernetes-el7-x86_64
> enabled=1
> gpgcheck=0
> EOF
> ```

## 安装 master

```sh
# --api-advertise-addresses <ip-address>
# for flannel, setup --pod-network-cidr 10.244.0.0/16
kubeadm init --pod-network-cidr 10.244.0.0/16 --kubernetes-version latest

# enable schedule pods on the master
export KUBECONFIG=/etc/kubernetes/admin.conf
# for v1.5-, use kubectl taint nodes --all dedicated-
kubectl taint nodes --all node-role.kubernetes.io/master:NoSchedule-
```

如果需要修改 kubernetes 服务的配置选项，则需要创建一个 MasterConfiguration 配置文件，其格式为

```yaml
apiVersion: kubeadm.k8s.io/v1alpha2
kind: MasterConfiguration
kubernetesVersion: v1.11.0
api:
  advertiseAddress: 192.168.0.102
  bindPort: 6443
  controlPlaneEndpoint: ""
auditPolicy:
  logDir: /var/log/kubernetes/audit
  logMaxAge: 2
  path: ""
bootstrapTokens:
- groups:
  - system:bootstrappers:kubeadm:default-node-token
  token: abcdef.0123456789abcdef
  ttl: 24h0m0s
  usages:
  - signing
  - authentication
certificatesDir: /etc/kubernetes/pki
clusterName: kubernetes
etcd:
  local:
    dataDir: /var/lib/etcd
    image: ""
imageRepository: k8s.gcr.io
kubeProxy:
  config:
    bindAddress: 0.0.0.0
    clientConnection:
      acceptContentTypes: ""
      burst: 10
      contentType: application/vnd.kubernetes.protobuf
      kubeconfig: /var/lib/kube-proxy/kubeconfig.conf
      qps: 5
    clusterCIDR: ""
    configSyncPeriod: 15m0s
    conntrack:
      max: null
      maxPerCore: 32768
      min: 131072
      tcpCloseWaitTimeout: 1h0m0s
      tcpEstablishedTimeout: 24h0m0s
    enableProfiling: false
    healthzBindAddress: 0.0.0.0:10256
    hostnameOverride: ""
    iptables:
      masqueradeAll: false
      masqueradeBit: 14
      minSyncPeriod: 0s
      syncPeriod: 30s
    ipvs:
      ExcludeCIDRs: null
      minSyncPeriod: 0s
      scheduler: ""
      syncPeriod: 30s
    metricsBindAddress: 127.0.0.1:10249
    mode: ""
    nodePortAddresses: null
    oomScoreAdj: -999
    portRange: ""
    resourceContainer: /kube-proxy
    udpIdleTimeout: 250ms
kubeletConfiguration:
  baseConfig:
    address: 0.0.0.0
    authentication:
      anonymous:
        enabled: false
      webhook:
        cacheTTL: 2m0s
        enabled: true
      x509:
        clientCAFile: /etc/kubernetes/pki/ca.crt
    authorization:
      mode: Webhook
      webhook:
        cacheAuthorizedTTL: 5m0s
        cacheUnauthorizedTTL: 30s
    cgroupDriver: cgroupfs
    cgroupsPerQOS: true
    clusterDNS:
    - 10.96.0.10
    clusterDomain: cluster.local
    containerLogMaxFiles: 5
    containerLogMaxSize: 10Mi
    contentType: application/vnd.kubernetes.protobuf
    cpuCFSQuota: true
    cpuManagerPolicy: none
    cpuManagerReconcilePeriod: 10s
    enableControllerAttachDetach: true
    enableDebuggingHandlers: true
    enforceNodeAllocatable:
    - pods
    eventBurst: 10
    eventRecordQPS: 5
    evictionHard:
      imagefs.available: 15%
      memory.available: 100Mi
      nodefs.available: 10%
      nodefs.inodesFree: 5%
    evictionPressureTransitionPeriod: 5m0s
    failSwapOn: true
    fileCheckFrequency: 20s
    hairpinMode: promiscuous-bridge
    healthzBindAddress: 127.0.0.1
    healthzPort: 10248
    httpCheckFrequency: 20s
    imageGCHighThresholdPercent: 85
    imageGCLowThresholdPercent: 80
    imageMinimumGCAge: 2m0s
    iptablesDropBit: 15
    iptablesMasqueradeBit: 14
    kubeAPIBurst: 10
    kubeAPIQPS: 5
    makeIPTablesUtilChains: true
    maxOpenFiles: 1000000
    maxPods: 110
    nodeStatusUpdateFrequency: 10s
    oomScoreAdj: -999
    podPidsLimit: -1
    port: 10250
    registryBurst: 10
    registryPullQPS: 5
    resolvConf: /etc/resolv.conf
    rotateCertificates: true
    runtimeRequestTimeout: 2m0s
    serializeImagePulls: true
    staticPodPath: /etc/kubernetes/manifests
    streamingConnectionIdleTimeout: 4h0m0s
    syncFrequency: 1m0s
    volumeStatsAggPeriod: 1m0s
networking:
  dnsDomain: cluster.local
  podSubnet: ""
  serviceSubnet: 10.96.0.0/12
nodeRegistration:
  criSocket: /var/run/dockershim.sock
  name: your-host-name
  taints:
  - effect: NoSchedule
    key: node-role.kubernetes.io/master
unifiedControlPlaneImage: ""
```

然后，在初始化 master 的时候指定 kubeadm.yml 的路径：

```sh
kubeadm init --config ./kubeadm.yaml
```

## 配置 Network plugin

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
        "subnet": "10.244.0.0/16",
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

注意：需要 `kubeadm init` 时设置 `--pod-network-cidr=10.244.0.0/16`

```sh
kubectl apply -f https://raw.githubusercontent.com/coreos/flannel/v0.10.0/Documentation/kube-flannel.yml
```

### weave

```sh
sysctl net.bridge.bridge-nf-call-iptables=1
kubectl apply -f "https://cloud.weave.works/k8s/net?k8s-version=$(kubectl version | base64 | tr -d '\n')"
```

### calico

注意：需要 `kubeadm init` 时设置 `--pod-network-cidr=192.168.0.0/16`

```sh
kubectl apply -f https://docs.projectcalico.org/v3.1/getting-started/kubernetes/installation/hosted/rbac-kdd.yaml
kubectl apply -f https://docs.projectcalico.org/v3.1/getting-started/kubernetes/installation/hosted/kubernetes-datastore/calico-networking/1.7/calico.yaml
```

## 添加 Node

```sh
kubeadm join --token <token> <master-ip>:<master-port> --discovery-token-ca-cert-hash sha256:<hash>
```

跟 Master 一样，添加 Node 的时候也可以自定义 Kubernetes 服务的选项，格式为

```yaml
apiVersion: kubeadm.k8s.io/v1alpha2
caCertPath: /etc/kubernetes/pki/ca.crt
clusterName: kubernetes
discoveryFile: ""
discoveryTimeout: 5m0s
discoveryToken: abcdef.0123456789abcdef
discoveryTokenAPIServers:
- kube-apiserver:6443
discoveryTokenUnsafeSkipCAVerification: true
kind: NodeConfiguration
nodeRegistration:
  criSocket: /var/run/dockershim.sock
  name: thegopher
tlsBootstrapToken: abcdef.0123456789abcdef
token: abcdef.0123456789abcdef
```

在把 Node 加入集群的时候，指定 NodeConfiguration 配置文件的路径

```sh
kubeadm join --config ./nodeconfig.yml --token $token ${master_ip}
```

## Cloud Provider

默认情况下，kubeadm 不包括 Cloud Provider 的配置，在 Azure 或者 AWS 等云平台上运行时，还需要配置 Cloud Provider。如

```yaml
kind: MasterConfiguration
apiVersion: kubeadm.k8s.io/v1alpha2
apiServerExtraArgs:
  cloud-provider: "{cloud}"
  cloud-config: "{cloud-config-path}"
apiServerExtraVolumes:
- name: cloud
  hostPath: "{cloud-config-path}"
  mountPath: "{cloud-config-path}"
controllerManagerExtraArgs:
  cloud-provider: "{cloud}"
  cloud-config: "{cloud-config-path}"
controllerManagerExtraVolumes:
- name: cloud
  hostPath: "{cloud-config-path}"
  mountPath: "{cloud-config-path}"
```

## 删除安装

```sh
# drain and delete the node first
kubectl drain <node name> --delete-local-data --force --ignore-daemonsets
kubectl delete node <node name>

# then reset kubeadm
kubeadm reset
```

## 动态升级

kubeadm v1.8 开始支持动态升级，升级步骤为

* 首先上传 kubeadm 配置，如 `kubeadm config upload from-flags [flags]`（使用命令行参数）或 `kubeadm config upload from-file --config [config]`（使用配置文件）
* 在 master 上检查新版本 `kubeadm upgrade plan`， 当有新版本（如 v1.8.0）时，执行 `kubeadm upgrade apply v1.8.0` 升级控制平面
* ** 手动 ** 升级 CNI 插件（如果有新版本的话）
* 添加自动证书回滚的 RBAC 策略 `kubectl create clusterrolebinding kubeadm:node-autoapprove-certificate-rotation --clusterrole=system:certificates.k8s.io:certificatesigningrequests:selfnodeclient --group=system:nodes`
* 最后升级 kubelet

```sh
$ kubectl drain $HOST --ignore-daemonsets

# 升级软件包
$ apt-get update
$ apt-get upgrade
# CentOS 上面执行 yum 升级
# $ yum update

$ kubectl uncordon $HOST
```

### 手动升级

kubeadm v1.7 以及以前的版本不支持动态升级，但可以手动升级。

#### 升级 Master

假设你已经有一个使用 kubeadm 部署的 Kubernetes v1.6 集群，那么升级到 v1.7 的方法为：

1. 升级安装包 `apt-get upgrade && apt-get update`
2. 重启 kubelet `systemctl restart kubelet`
3. 删除 kube-proxy DaemonSet `KUBECONFIG=/etc/kubernetes/admin.conf kubectl delete daemonset kube-proxy -n kube-system`
4. kubeadm init --skip-preflight-checks --kubernetes-version v1.7.1
5. 更新 CNI 插件

#### 升级 Node

1. 升级安装包 `apt-get upgrade && apt-get update`
2. 重启 kubelet `systemctl restart kubelet`

## 安全选项

默认情况下，kubeadm 会开启 Node 客户端证书的自动批准，如果不需要的话可以选择关闭，关闭方法为

```sh
$ kubectl delete clusterrole kubeadm:node-autoapprove-bootstrap
```

关闭后，增加新的 Node 时，`kubeadm join` 会阻塞等待管理员手动批准，匹配方法为

```sh
$ kubectl get csr
NAME                                                   AGE       REQUESTOR                 CONDITION
node-csr-c69HXe7aYcqkS1bKmH4faEnHAWxn6i2bHZ2mD04jZyQ   18s       system:bootstrap:878f07   Pending

$ kubectl certificate approve node-csr-c69HXe7aYcqkS1bKmH4faEnHAWxn6i2bHZ2mD04jZyQ
certificatesigningrequest "node-csr-c69HXe7aYcqkS1bKmH4faEnHAWxn6i2bHZ2mD04jZyQ" approved

$ kubectl get csr
NAME                                                   AGE       REQUESTOR                 CONDITION
node-csr-c69HXe7aYcqkS1bKmH4faEnHAWxn6i2bHZ2mD04jZyQ   1m        system:bootstrap:878f07   Approved,Issued
```

## 参考文档

* [kubeadm 参考指南](https://kubernetes.io/docs/admin/kubeadm/)
* [Upgrading kubeadm clusters from 1.7 to 1.8](https://kubernetes.io/docs/tasks/administer-cluster/kubeadm-upgrade-1-8/)
* [Upgrading kubeadm clusters from 1.6 to 1.7](https://kubernetes.io/docs/tasks/administer-cluster/kubeadm-upgrade-1-7/)
