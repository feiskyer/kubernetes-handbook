# 部署 Windows 節點

Kubernetes 從 v1.5 開始支持 alpha 版的 Windows 節點，並從 v1.9 開始升級為 beta 版。Windows 容器的主要特性包括

- Windows 容器支持 Pod（isolation=process）
- 基於 Virtual Filtering Platform (VFP) Hyper-v Switch Extension 的內核負載均衡
- 基於 Container Runtime Interface (CRI) 管理 Windows 容器
- 支持 kubeadm 命令將 Windows 節點加入到已有集群中
- 推薦使用 Windows Server Version 1803+ 和 Docker Version 17.06+

> 注意：
>
> 1. 控制平面的服務依然運行在 Linux 服務器中，而 Windows 節點上只運行 Kubelet、Kube-proxy、Docker 以及網絡插件等服務。
> 2. 推薦使用 Windows Server 1803（修復了 Windows 容器軟鏈接的問題，從而 ServiceAccount 和 ConfigMap 可以正常使用）

## 下載

可以從 <https://github.com/kubernetes/kubernetes/releases> 下載已發佈的用於 Windows 服務器的二進制文件，如

```sh
wget https://dl.k8s.io/v1.15.0/kubernetes-node-windows-amd64.tar.gz
```

或者從 Kubernetes 源碼編譯

```sh
go get -u k8s.io/kubernetes
cd $GOPATH/src/k8s.io/kubernetes

# Build the kubelet
KUBE_BUILD_PLATFORMS=windows/amd64 make WHAT=cmd/kubelet

# Build the kube-proxy
KUBE_BUILD_PLATFORMS=windows/amd64 make WHAT=cmd/kube-proxy

# You will find the output binaries under the folder _output/local/bin/windows/
```

## 網絡插件

Windows Server 中支持以下幾種網絡插件（注意 Windows 節點上的網絡插件要與 Linux 節點相同）

1. [wincni](https://github.com/Microsoft/SDN/blob/master/Kubernetes/windows/cni/wincni.exe) 等 L3 路由網絡插件，路由配置在 TOR 交換機、路由器或者雲服務中
2. [Azure VNET CNI Plugin](https://github.com/Azure/azure-container-networking/blob/master/docs/cni.md)
3. [Open vSwitch (OVS) & Open Virtual Network (OVN) with Overlay](https://github.com/openvswitch/ovn-kubernetes/)
4. Flannel v0.10.0+
5. Calico v3.0.1+
6. [win-bridge](https://github.com/containernetworking/plugins/tree/master/plugins/main/windows/win-bridge)
7. [win-overlay](https://github.com/containernetworking/plugins/tree/master/plugins/main/windows/win-overlay)

更多網絡拓撲模式請參考 [Windows container network drivers](https://docs.microsoft.com/en-us/virtualization/windowscontainers/container-networking/network-drivers-topologies)。

### L3 路由拓撲

![](images/upstreamrouting.png)

wincni 網絡插件配置示例

```json
{
  "cniVersion": "0.2.0",
  "name": "l2bridge",
  "type": "wincni.exe",
  "master": "Ethernet",
  "ipam": {
    "environment": "azure",
    "subnet": "10.10.187.64/26",
    "routes": [{
      "GW": "10.10.187.66"
    }]
  },
  "dns": {
    "Nameservers": [
      "11.0.0.10"
    ]
  },
  "AdditionalArgs": [{
      "Name": "EndpointPolicy",
      "Value": {
        "Type": "OutBoundNAT",
        "ExceptionList": [
          "11.0.0.0/8",
          "10.10.0.0/16",
          "10.127.132.128/25"
        ]
      }
    },
    {
      "Name": "EndpointPolicy",
      "Value": {
        "Type": "ROUTE",
        "DestinationPrefix": "11.0.0.0/8",
        "NeedEncap": true
      }
    },
    {
      "Name": "EndpointPolicy",
      "Value": {
        "Type": "ROUTE",
        "DestinationPrefix": "10.127.132.213/32",
        "NeedEncap": true
      }
    }
  ]
}
```

### OVS 網絡拓撲

![](images/ovn_kubernetes.png)

## 部署

### kubeadm

如果 Master 是通過 kubeadm 來部署的，那 Windows 節點也可以使用 kubeadm 來部署：

```sh
kubeadm.exe join --token <token> <master-ip>:<master-port> --discovery-token-ca-cert-hash sha256:<hash>
```

### Azure

在 Azure 上面推薦使用 [acs-engine](azure.md#Windows) 自動部署 Master 和 Windows 節點。

首先創建一個包含 Windows 的 Kubernetes 集群配置文件 `windows.json`

```json
{
    "apiVersion": "vlabs",
    "properties": {
        "orchestratorProfile": {
            "orchestratorType": "Kubernetes",
            "orchestratorVersion": "1.11.1",
            "kubernetesConfig": {
                "networkPolicy": "none",
                "enableAggregatedAPIs": true,
                "enableRbac": true
            }
        },
        "masterProfile": {
            "count": 3,
            "dnsPrefix": "kubernetes-windows",
            "vmSize": "Standard_D2_v3"
        },
        "agentPoolProfiles": [
            {
                "name": "windowspool1",
                "count": 3,
                "vmSize": "Standard_D2_v3",
                "availabilityProfile": "AvailabilitySet",
                "osType": "Windows"
            }
        ],
        "windowsProfile": {
            "adminUsername": "<your-username>",
            "adminPassword": "<your-password>"
        },
        "linuxProfile": {
            "adminUsername": "azure",
            "ssh": {
                "publicKeys": [
                    {
                        "keyData": "<your-ssh-public-key>"
                    }
                ]
            }
        },
        "servicePrincipalProfile": {
            "clientId": "",
            "secret": ""
        }
    }
}

```

然後使用 acs-engine 部署：

```sh
# create a new resource group.
az group create --name myResourceGroup  --location "centralus"

# start deploy the kubernetes
acs-engine deploy --resource-group myResourceGroup --subscription-id <subscription-id> --auto-suffix --api-model windows.json --location centralus --dns-prefix <dns-prefix>

# setup kubectl
export KUBECONFIG="$(pwd)/_output/<name-with-suffix>/kubeconfig/kubeconfig.centralus.json"
kubectl get node
```

### 手動部署

(1) 在 Windows Server 中 [安裝 Docker](https://docs.microsoft.com/en-us/virtualization/windowscontainers/quick-start/quick-start-windows-server)

```powershell
Install-Module -Name DockerMsftProvider -Repository PSGallery -Force
Install-Package -Name Docker -ProviderName DockerMsftProvider
Restart-Computer -Force
```

(2) 根據前面的下載部分下載 kubelet.exe 和 kube-proxy.exe

(3) 從 Master 節點上面拷貝 Node spec file (kube config)

(4) 配置 CNI 網絡插件和基礎鏡像

```powershell
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
wget https://github.com/Microsoft/SDN/archive/master.zip -o master.zip
Expand-Archive master.zip -DestinationPath master
mkdir C:/k/
mv master/SDN-master/Kubernetes/windows/* C:/k/
rm -recurse -force master,master.zip
```

```powershell
docker pull microsoft/windowsservercore:1709
docker tag microsoft/windowsservercore:1709 microsoft/windowsservercore:latest
cd C:/k/
docker build -t kubeletwin/pause .
```

(5) 使用 [start-kubelet.ps1](https://github.com/Microsoft/SDN/blob/master/Kubernetes/windows/start-kubelet.ps1) 啟動 kubelet.exe，並使用 [start-kubeproxy.ps1](https://github.com/Microsoft/SDN/blob/master/Kubernetes/windows/start-kubeproxy.ps1) 啟動 kube-proxy.exe

```sh
[Environment]::SetEnvironmentVariable("KUBECONFIG", "C:\k\config", [EnvironmentVariableTarget]::User)
./start-kubelet.ps1 -ClusterCidr 192.168.0.0/16
./start-kubeproxy.ps1
```

(6) 如果使用 Host-Gateway 網絡插件，還需要使用 [AddRoutes.ps1](https://github.com/Microsoft/SDN/blob/master/Kubernetes/windows/AddRoutes.ps1) 添加靜態路由

詳細的操作步驟可以參考 [這裡](https://github.com/MicrosoftDocs/Virtualization-Documentation/blob/live/virtualization/windowscontainers/kubernetes/getting-started-kubernetes-windows.md)。

## 運行 Windows 容器

使用 NodeSelector  `beta.kubernetes.io/os: windows` 將容器調度到 Windows 節點上，比如

```yaml
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: iis
spec:
  replicas: 1
  template:
    metadata:
      labels:
        app: iis
    spec:
      nodeSelector:
        beta.kubernetes.io/os: windows
      containers:
      - name: iis
        image: microsoft/iis
        resources:
          limits:
            memory: "128Mi"
            cpu: 2
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  labels:
    app: iis
  name: iis
  namespace: default
spec:
  ports:
  - port: 80
    protocol: TCP
    targetPort: 80
  selector:
    app: iis
  type: NodePort
```

運行 DaemonSet

```yaml
apiVersion: extensions/v1beta1
kind: DaemonSet
metadata:
  name: my-DaemonSet
  labels:
    app: foo
spec:
  template:
    metadata:
      labels:
        app: foo
    spec:
      containers:
      - name: foo
        image: microsoft/windowsservercore:1709
      nodeSelector:
        beta.kubernetes.io/os: windows
```

## 已知問題

### Secrets 和 ConfigMaps 只能以環境變量的方式使用

1709和更早版本有這個問題，升級到 1803 即可解決。

### Volume 支持情況

Windows 容器暫時只支持 local、emptyDir、hostPath、AzureDisk、AzureFile 以及 flexvolume。注意 Volume 的路徑格式需要為 `mountPath: "C:\\etc\\foo"` 或者 `mountPath: "C:/etc/foo"`。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: hostpath-pod
spec:
  containers:
  - name: hostpath-nano
    image: microsoft/nanoserver:1709
    stdin: true
    tty: true
    volumeMounts:
    - name: blah
      mountPath: "C:\\etc\\foo"
      readOnly: true
  nodeSelector:
    beta.kubernetes.io/os: windows
  volumes:
  - name: blah
    hostPath:
      path: "C:\\AzureData"
```

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: empty-dir-pod
spec:
  containers:
  - image: microsoft/nanoserver:1709
    name: empty-dir-nano
    stdin: true
    tty: true
    volumeMounts:
    - mountPath: /cache
      name: cache-volume
    - mountPath: C:/scratch
      name: scratch-volume
  volumes:
  - name: cache-volume
    emptyDir: {}
  - name: scratch-volume
    emptyDir: {}
  nodeSelector:
    beta.kubernetes.io/os: windows
```

### 鏡像版本匹配問題

在 `Windows Server version 1709` 中必須使用帶有 1709 標籤的鏡像，如

- microsoft/aspnet:4.7.1-windowsservercore-1709
- microsoft/windowsservercore:1709
- microsoft/iis:windowsservercore-1709

同樣，在 `Windows Server version 1803` 中必須使用帶有 1803 標籤的鏡像。而在 `Windows Server 2016` 上需要使用帶有 ltsc2016 標籤的鏡像，如 `microsoft/windowsservercore:ltsc2016`。

## 設置 CPU 和內存

從 v1.10 開始，Kubernetes 支持給 Windows 容器設置 CPU 和內存：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: iis
spec:
  replicas: 3
  template:
    metadata:
      labels:
        app: iis
    spec:
      containers:
      - name: iis
        image: microsoft/iis
        resources:
          limits:
            memory: "128Mi"
            cpu: 2
        ports:
        - containerPort: 80
```

## Hyper-V 容器

從 v1.10 開始支持 Hyper-V 隔離的容器（Alpha）。 在使用之前，需要配置 kubelet 開啟 `HyperVContainer` 特性開關。然後使用 Annotation `experimental.windows.kubernetes.io/isolation-type=hyperv` 來指定容器使用 Hyper-V 隔離:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: iis
spec:
  replicas: 3
  template:
    metadata:
      labels:
        app: iis
      annotations:
        experimental.windows.kubernetes.io/isolation-type: hyperv
    spec:
      containers:
      - name: iis
        image: microsoft/iis
        ports:
        - containerPort: 80
```

### 其他已知問題

- 僅  Windows Server 1709 或更新的版本才支持在 Pod 內運行多個容器（僅支持 Process 隔離）
- 暫不支持 StatefulSet
- 暫不支持 Windows Server Container Pods 的自動擴展（Horizontal Pod Autoscaling）
- Windows 容器的 OS 版本需要與 Host OS 版本匹配，否則容器無法啟動
- 使用 L3 或者 Host GW 網絡時，無法從 Windows Node 中直接訪問 Kubernetes Services（使用 OVS/OVN 時沒有這個問題）
- 在 VMWare Fusion 的 Window Server 中 kubelet.exe 可能會無法啟動（已在 [#57124](https://github.com/kubernetes/kubernetes/pull/57124) 中修復）
- 暫不支持 Weave 網絡插件
- Calico 網絡插件僅支持 Policy-Only 模式
- 對於需要使用 `:` 作為環境變量的 .NET 容器，可以將環境變量中的 `:` 替換為 `__`（參考 [這裡](https://docs.microsoft.com/en-us/aspnet/core/fundamentals/configuration/?tabs=basicconfiguration#configuration-by-environment)）

## 附錄：Docker EE 安裝方法

安裝 Docker EE 穩定版本

```powershell
Install-Module -Name DockerMsftProvider -Repository PSGallery -Force
Install-Package -Name docker -ProviderName DockerMsftProvider
Restart-Computer -Force
```

安裝 Docker EE 預覽版本

```powershell
Install-Module DockerProvider
Install-Package -Name Docker -ProviderName DockerProvider -RequiredVersion preview
```

升級 Docker EE 版本

```powershell
# Check the installed version
Get-Package -Name Docker -ProviderName DockerMsftProvider

# Find the current version
Find-Package -Name Docker -ProviderName DockerMsftProvider

# Upgrade Docker EE
Install-Package -Name Docker -ProviderName DockerMsftProvider -Update -Force
Start-Service Docker
```

## 參考文檔

- [Guide for adding Windows Nodes in Kubernetes](https://kubernetes.io/docs/setup/production-environment/windows/user-guide-windows-nodes/)
- [Intro to Windows support in Kubernetes](https://kubernetes.io/docs/setup/production-environment/windows/intro-windows-in-kubernetes/)
- [Guide for scheduling Windows containers in Kubernetes](https://kubernetes.io/docs/setup/production-environment/windows/user-guide-windows-containers/)
- [Kubernetes for Windows Walkthroughs](https://github.com/PatrickLang/KubernetesForWindowsTutorial)
