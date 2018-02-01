# 部署 Windows 节点

Kubernetes 从 v1.5 开始支持 alpha 版的 Windows 节点，并从 v1.9 开始升级为 beta 版。Windows 容器的主要特性包括

- Windows 容器支持 Pod（isolation=process）
- 基于 Virtual Filtering Platform (VFP) Hyper-v Switch Extension 的内核负载均衡
- 基于 Container Runtime Interface (CRI) 管理 Windows 容器
- 支持 kubeadm 命令将 Windows 节点加入到已有集群中
- 推荐使用 Windows Server Version 1709+ 和 Docker Version 17.06+

> 注意：控制平面的服务依然运行在 Linux 服务器中，而 Windows 节点上只运行 Kubelet、Kube-proxy 以及网络插件等服务。

## 下载

可以从 <<https://github.com/kubernetes/kubernetes/releases>下载已发布的用于 Windows 服务器的二进制文件，如

```sh
$ wget https://dl.k8s.io/v1.9.2/kubernetes-node-windows-amd64.tar.gz
```

或者从 Kubernetes 源码编译

```sh
go get -u k8s.io/kubernetes
cd $GOPATH/src/k8s.io/kubernetes

# Build the kubelet
KUBE_BUILD_PLATFORMS=windows/amd64 make WHAT=cmd/kubelet

# Build the kube-proxy
KUBE_BUILD_PLATFORMS=windows/amd64 make WHAT=cmd/kube-proxy

# You will find the output binaries under the folder _output/local/bin/windows/
```

## 网络插件

Windows Server 中支持以下几种网络插件（注意 Windows 节点上的网络插件要与 Linux 节点相同）

1. [wincni](https://github.com/Microsoft/SDN/blob/master/Kubernetes/windows/cni/wincni.exe) 等 L3 路由网络插件，路由配置在 TOR 交换机、路由器或者云服务中
2. [Host Gateway](https://docs.microsoft.com/en-us/virtualization/windowscontainers/kubernetes/configuring-host-gateway-mode) 网络插件，跟上面类似但将 IP 路由配置到每台主机上面
3. [Azure VNET CNI Plugin](https://github.com/Azure/azure-container-networking/blob/master/docs/cni.md)
4. [Open vSwitch (OVS) & Open Virtual Network (OVN) with Overlay](https://github.com/openvswitch/ovn-kubernetes/)
5. Flannel
6. Calico
7. 未来还会支持 [win-l2bridge (host-gateway) 和 win-overlay (vxlan)](https://github.com/containernetworking/plugins/pull/85)

### L3 路由拓扑

![](images/upstreamrouting.png)

wincni 网络插件配置示例

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

### OVS 网络拓扑

![](images/ovn_kubernetes.png)

## 部署

### kubeadm

如果 Master 是通过 kubeadm 来部署的，那 Windows 节点也可以使用 kubeadm 来部署：

```sh
kubeadm.exe join --token <token> <master-ip>:<master-port> --discovery-token-ca-cert-hash sha256:<hash>
```

### Azure

在 Azure 上面推荐使用 [acs-engine](azure.md#Windows) 自动部署 Master 和 Windows 节点。

### 手动部署

1. 在 Windows Server 中[安装 Docker](https://docs.microsoft.com/en-us/virtualization/windowscontainers/quick-start/quick-start-windows-server)

   ```
   Install-Module -Name DockerMsftProvider -Repository PSGallery -Force
   Install-Package -Name Docker -ProviderName DockerMsftProvider
   Restart-Computer -Force
   ```

2. 根据前面的下载部分下载或者编译 kubelet.exe 和 kube-proxy.exe

3. 从 Master 节点上面拷贝 Node spec file (kube config)

4. 创建 HNS 网络，配置 CNI 网络插件

   ```sh
   wget https://github.com/Microsoft/SDN/archive/master.zip -o master.zip
   Expand-Archive master.zip -DestinationPath master
   mkdir C:/k/
   mv master/SDN-master/Kubernetes/windows/* C:/k/
   rm -recurse -force master,master.zip
   ```

5. 使用[start-kubelet.ps1](https://github.com/Microsoft/SDN/blob/master/Kubernetes/windows/start-kubelet.ps1)启动 kubelet.exe，并使用 [start-kubeproxy.ps1](https://github.com/Microsoft/SDN/blob/master/Kubernetes/windows/start-kubeproxy.ps1) 启动 kube-proxy.exe

   ```sh
   [Environment]::SetEnvironmentVariable("KUBECONFIG", "C:\k\config", [EnvironmentVariableTarget]::User)
   ./start-kubelet.ps1 -ClusterCidr 192.168.0.0/16
   ./start-kubeproxy.ps1
   ```

   ​

6. 如果使用 Host-Gateway 网络插件，还需要使用 [AddRoutes.ps1](https://github.com/Microsoft/SDN/blob/master/Kubernetes/windows/AddRoutes.ps1) 添加静态路由

详细的操作步骤可以参考[这里](https://github.com/MicrosoftDocs/Virtualization-Documentation/blob/live/virtualization/windowscontainers/kubernetes/getting-started-kubernetes-windows.md)。

## 运行 Windows 容器

使用 NodeSelector  `beta.kubernetes.io/os: windows` 将容器调度到 Windows 节点上，比如

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

## 已知问题

### Secrets 和 ConfigMaps 只能以环境变量的方式使用

```yaml
kind: ConfigMap
apiVersion: v1
metadata:
  name: example-config
data:
  example.property.1: hello
  example.property.2: world

---

apiVersion: v1
kind: Pod
metadata:
  name: my-configmap-pod
spec:
  containers:
  - name: my-configmap-pod
    image: microsoft/windowsservercore:1709
    env:
      - name: EXAMPLE_PROPERTY_1
        valueFrom:
          configMapKeyRef:
            name: example-config
            key: example.property.1
      - name: EXAMPLE_PROPERTY_2
        valueFrom:
          configMapKeyRef:
            name: example-config
            key: example.property.2
  nodeSelector:
    beta.kubernetes.io/os: windows
```

### Volume 支持情况

Windows 容器暂时只支持 local、emptyDir、hostPath、AzureDisk、AzureFile 以及 flexvolume。注意 Volume 的路径格式需要为 `mountPath: "C:\\etc\\foo"` 或者 `mountPath: "C:/etc/foo"`。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-hostpath-volume-pod
spec:
  containers:
  - name: my-hostpath-volume-pod
    image: microsoft/windowsservercore:1709
    volumeMounts:
    - name: foo
      mountPath: "C:\\etc\\foo"
      readOnly: true
  nodeSelector:
    beta.kubernetes.io/os: windows
  volumes:
  - name: foo
    hostPath:
      path: "C:\\etc\\foo"
```



### 镜像版本匹配问题

在 `Windows Server version 1709` 中必须使用带有 1709 标签的镜像，如

```
microsoft/aspnet:4.7.1-windowsservercore-1709
microsoft/windowsservercore:1709
microsoft/iis:windowsservercore-1709
```

### 其他已知问题

- Shared network namespace (compartment) with multiple Windows Server containers (shared kernel) per pod is only supported on Windows Server 1709 or later
- Using Secrets and ConfigMaps as volume mounts is not supported
- The StatefulSet functionality for stateful applications is not supported
- Horizontal Pod Autoscaling for Windows Server Container pods has not been verified to work end-to-end
- Hyper-V Containers are not supported