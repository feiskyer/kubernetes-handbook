# Windows

Beginning with v1.5, Kubernetes started to introduce support for Windows nodes in its alpha version, upgrading this support to beta with the release of v1.9. Some of the key features for Windows containers are include:

* Pod-level support for Windows containers (isolation=process)
* Kernel load balancing based on Virtual Filtering Platform (VFP) Hyper-v Switch Extension
* Windows container management via Container Runtime Interface (CRI)
* Support for the use of the kubeadm command to add Windows nodes to an existing cluster
* Recommended use of Windows Server Version 1803+ and Docker Version 17.06+

> Note:
>
> 1. Control plane services still run on Linux servers, with only Kubelet, Kube-proxy, Docker, and network plugin services running on Windows nodes.
> 2. Windows Server 1803 is recommended since it fixes issues with Windows container symlinks, allowing ServiceAccount and ConfigMap to function normally. 

## Downloads

You can download the released binary files for Windows servers from [https://github.com/kubernetes/kubernetes/releases](https://github.com/kubernetes/kubernetes/releases). For instance,

```bash
wget https://dl.k8s.io/v1.15.0/kubernetes-node-windows-amd64.tar.gz
```

Alternatively, you can compile from Kubernetes source code:

```bash
go get -u k8s.io/kubernetes
cd $GOPATH/src/k8s.io/kubernetes

# Build the kubelet
KUBE_BUILD_PLATFORMS=windows/amd64 make WHAT=cmd/kubelet

# Build the kube-proxy
KUBE_BUILD_PLATFORMS=windows/amd64 make WHAT=cmd/kube-proxy

# You will find the output binaries under the folder _output/local/bin/windows/
```

## Network Plugins

The following network plugins are supported in Windows Server (note that the network plugin on Windows nodes must be the same as on Linux nodes):

1. L3 routing network plugins like [wincni](https://github.com/Microsoft/SDN/blob/master/Kubernetes/windows/cni/wincni.exe), where routing is configured in TOR switches, routers, or cloud services
2. [Azure VNET CNI Plugin](https://github.com/Azure/azure-container-networking/blob/master/docs/cni.md)
3. [Open vSwitch (OVS) & Open Virtual Network (OVN) with Overlay](https://github.com/openvswitch/ovn-kubernetes/)
4. Flannel v0.10.0+
5. Calico v3.0.1+
6. [win-bridge](https://github.com/containernetworking/plugins/tree/master/plugins/main/windows/win-bridge)
7. [win-overlay](https://github.com/containernetworking/plugins/tree/master/plugins/main/windows/win-overlay)

For more network topology modes, please refer to [Windows container network drivers](https://docs.microsoft.com/en-us/virtualization/windowscontainers/container-networking/network-drivers-topologies).

### L3 Routing Topology

![](../../.gitbook/assets/upstreamrouting.png)

Example configuration for the wincni network plugin:

```javascript
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

### OVS Network Topology

![](../../.gitbook/assets/ovn_kubernetes%20%282%29.png)

## Deployment

### kubeadm

If the master node is deployed via kubeadm, Windows nodes can also be deployed through kubeadm:

```bash
kubeadm.exe join --token <token> <master-ip>:<master-port> --discovery-token-ca-cert-hash sha256:<hash>
```

### Azure

On Azure, it is recommended to use [acs-engine](azure.md#Windows) for automatic deployment of Master and Windows nodes.

First, create a Kubernetes cluster configuration file that includes Windows, named `windows.json`

```javascript
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

You can then deploy using acs-engine:

```bash
# create a new resource group.
az group create --name myResourceGroup  --location "centralus"

# start deploy the kubernetes
acs-engine deploy --resource-group myResourceGroup --subscription-id <subscription-id> --auto-suffix --api-model windows.json --location centralus --dns-prefix <dns-prefix>

# setup kubectl
export KUBECONFIG="$(pwd)/_output/<name-with-suffix>/kubeconfig/kubeconfig.centralus.json"
kubectl get node
```

### Manual Deployment

\(1\) Install Docker on Windows Server by following these instructions: [Install Docker](https://docs.microsoft.com/en-us/virtualization/windowscontainers/quick-start/quick-start-windows-server)

```text
Install-Module -Name DockerMsftProvider -Repository PSGallery -Force
Install-Package -Name Docker -ProviderName DockerMsftProvider
Restart-Computer -Force
```

\(2\) Download kubelet.exe and kube-proxy.exe based on the earlier download section.

\(3\) Copy the Node spec file (kube config) from the Master node.

\(4\) Configure the CNI network plugin and base images.

```text
wget https://github.com/Microsoft/SDN/archive/master.zip -o master.zip
Expand-Archive master.zip -DestinationPath master
mkdir C:/k/
mv master/SDN-master/Kubernetes/windows/* C:/k/
rm -recurse -force master,master.zip
```

```text
docker pull microsoft/windowsservercore:1709
docker tag microsoft/windowsservercore:1709 microsoft/windowsservercore:latest
cd C:/k/
docker build -t kubeletwin/pause .
```

\(5\) Use [start-kubelet.ps1](https://github.com/Microsoft/SDN/blob/master/Kubernetes/windows/start-kubelet.ps1) to start kubelet.exe, and use [start-kubeproxy.ps1](https://github.com/Microsoft/SDN/blob/master/Kubernetes/windows/start-kubeproxy.ps1) to start kube-proxy.exe

```bash
./start-kubelet.ps1 -ClusterCidr 192.168.0.0/16
./start-kubeproxy.ps1
```

\(6\) If you are using the Host-Gateway network plugin, you will also need to use [AddRoutes.ps1](https://github.com/Microsoft/SDN/blob/master/Kubernetes/windows/AddRoutes.ps1) to add static routes.

For a detailed step-by-step guide, you can refer to [this](https://github.com/MicrosoftDocs/Virtualization-Documentation/blob/live/virtualization/windowscontainers/kubernetes/getting-started-kubernetes-windows.md).

## Running Windows Containers

To schedule a container on a Windows node, use the NodeSelector `beta.kubernetes.io/os: windows`, for example:

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

Running a DaemonSet:

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

## Known Issues

### Secrets and ConfigMaps can only be used as environmental variables

This is a known issue with versions 1709 and earlier and can be fixed by upgrading to version 1803.

### Volume Support

Local, emptyDir, hostPath, AzureDisk, AzureFile, and flexvolume are currently the only types of volumes supported by Windows containers. It's important to note that the format for the Volume's path needs to be `mountPath: "C:\\etc\\foo"` or `mountPath: "C:/etc/foo"`.

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

### Image Version Matching 

In `Windows Server version 1709`, you must use images with the 1709 tag, such as

* microsoft/aspnet:4.7.1-windowsservercore-1709
* microsoft/windowsservercore:1709
* microsoft/iis:windowsservercore-1709

Likewise, for `Windows Server version 1803`, you must use images with the 1803 tag. For `Windows Server 2016`, you need to use images with the ltsc2016 tag, such as `microsoft/windowsservercore:ltsc2016`.

## Setting CPU and Memory

Starting from v1.10, Kubernetes supports setting CPU and memory for Windows containers:

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

## Hyper-V Containers

Starting from v1.10, containers with Hyper-V isolation are supported (Alpha). Before use, the kubelet needs to be configured to enable the `HyperVContainer` feature switch. Then you can specify a container for Hyper-V isolation using Annotation `experimental.windows.kubernetes.io/isolation-type=hyperv`:

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

### Other Known Issues

* Only Windows Server 1709 or later versions support running multiple containers in a Pod (only Process isolation is supported)
* StatefulSet is not currently supported
* Automatic expansion of Windows Server Container Pods (Horizontal Pod Autoscaling) is not yet supported
* The OS version of the Windows container needs to match the Host OS version; otherwise, the container will not be able to start
* When using L3 or Host GW networks, you cannot access Kubernetes Services directly from the Windows Node (there is no such issue when using OVS/OVN)
* On Window Server running on VMWare Fusion kubelet.exe may fail to start (this has been fixed in [\#57124](https://github.com/kubernetes/kubernetes/pull/57124))
* The Weave network plugin is not currently supported
* Calico network plugin only supports Policy-Only mode
* For .NET containers that need to use `:` as an environment variable, you can replace `:` in the environment variable with `__` (see [here](https://docs.microsoft.com/en-us/aspnet/core/fundamentals/configuration/?tabs=basicconfiguration#configuration-by-environment) for reference)

## Appendix: Docker EE Installation Method

To install Docker EE stable version:

```text
Install-Module -Name DockerMsftProvider -Repository PSGallery -Force
Install-Package -Name docker -ProviderName DockerMsftProvider
Restart-Computer -Force
```

To install Docker EE preview version:

```text
Install-Module DockerProvider
Install-Package -Name Docker -ProviderName DockerProvider -RequiredVersion preview
```

To upgrade Docker EE version:

```text
# Check the installed version
Get-Package -Name Docker -ProviderName DockerMsftProvider

# Find the current version
Find-Package -Name Docker -ProviderName DockerMsftProvider

# Upgrade Docker EE
Install-Package -Name Docker -ProviderName DockerMsftProvider -Update -Force
Start-Service Docker
```

## Reference Documents

* [Guide for adding Windows Nodes in Kubernetes](https://kubernetes.io/docs/setup/production-environment/windows/user-guide-windows-nodes/)
* [Intro to Windows support in Kubernetes](https://kubernetes.io/docs/setup/production-environment/windows/intro-windows-in-kubernetes/)
* [Guide for scheduling Windows containers in Kubernetes](https://kubernetes.io/docs/setup/production-environment/windows/user-guide-windows-containers/)
* [Kubernetes for Windows Walkthroughs](https://github.com/PatrickLang/KubernetesForWindowsTutorial)

