# Container Runtime Interface (CRI)

容器運行時插件（Container Runtime Interface，簡稱 CRI）是 Kubernetes v1.5 引入的容器運行時接口，它將 Kubelet 與容器運行時解耦，將原來完全面向 Pod 級別的內部接口拆分成面向 Sandbox 和 Container 的 gRPC 接口，並將鏡像管理和容器管理分離到不同的服務。

![](images/cri.png)

CRI 最早從從 1.4 版就開始設計討論和開發，在 v1.5 中發佈第一個測試版。在 v1.6 時已經有了很多外部容器運行時，如 frakti 和 cri-o 等。v1.7 中又新增了 cri-containerd 支持用 Containerd 來管理容器。

採用 CRI 後，Kubelet 的架構如下圖所示：

![image-20190316183052101](assets/image-20190316183052101.png)

## CRI 接口

CRI 基於 gRPC 定義了 RuntimeService 和 ImageService 等兩個 gRPC 服務，分別用於容器運行時和鏡像的管理。其定義在

- v1.14 以以上：<https://github.com/kubernetes/cri-api/tree/master/pkg/apis/runtime>
- v1.10-v1.13: [pkg/kubelet/apis/cri/runtime/v1alpha2](https://github.com/kubernetes/kubernetes/tree/release-1.13/pkg/kubelet/apis/cri/runtime/v1alpha2)
- v1.7-v1.9: [pkg/kubelet/apis/cri/v1alpha1/runtime](https://github.com/kubernetes/kubernetes/tree/release-1.9/pkg/kubelet/apis/cri/v1alpha1/runtime)
- v1.6: [pkg/kubelet/api/v1alpha1/runtime](https://github.com/kubernetes/kubernetes/tree/release-1.6/pkg/kubelet/api/v1alpha1/runtime)

Kubelet 作為 CRI 的客戶端，而容器運行時則需要實現 CRI 的服務端（即 gRPC server，通常稱為 CRI shim）。容器運行時在啟動 gRPC server 時需要監聽在本地的 Unix Socket （Windows 使用 tcp 格式）。

### 開發 CRI 容器運行時

開發新的容器運行時只需要實現 CRI 的 gRPC Server，包括 RuntimeService 和 ImageService。該 gRPC Server 需要監聽在本地的 unix socket（Linux 支持 unix socket 格式，Windows 支持 tcp 格式）。

一個簡單的示例為

```go
import (
    // Import essential packages
    "google.golang.org/grpc"
    runtime "k8s.io/kubernetes/pkg/kubelet/apis/cri/runtime/v1alpha2"
)

// Serivice implements runtime.ImageService and runtime.RuntimeService.
type Service struct {
    ...
}

func main() {
    service := &Service{}
    s := grpc.NewServer(grpc.MaxRecvMsgSize(maxMsgSize),
        grpc.MaxSendMsgSize(maxMsgSize))
    runtime.RegisterRuntimeServiceServer(s, service)
    runtime.RegisterImageServiceServer(s, service)
    lis, err := net.Listen("unix", "/var/run/runtime.sock")
    if err != nil {
        logrus.Fatalf("Failed to create listener: %v", err)
    }
    go s.Serve(lis)

    // Other codes
}
```

對於 Streaming API（Exec、PortForward 和 Attach），CRI 要求容器運行時返回一個 streaming server 的 URL 以便 Kubelet 重定向 API Server 發送過來的請求。在 v1.10 及更早版本中，容器運行時必需返回一個 API Server 可直接訪問的 URL（通常跟 Kubelet 使用相同的監聽地址）；而從 v1.11 開始，Kubelet 新增了 `--redirect-container-streaming`（默認為 false），默認不再轉發而是代理 Streaming 請求，這樣運行時可以返回一個 localhost 的 URL（當然也不再需要配置 TLS）。

![image-20190316183005314](assets/image-20190316183005314.png)

詳細的實現方法可以參考 [dockershim](https://github.com/kubernetes/kubernetes/tree/master/pkg/kubelet/dockershim) 或者 [cri-o](https://github.com/kubernetes-incubator/cri-o)。

### Kubelet 配置

在啟動 kubelet 時傳入容器運行時監聽的 Unix Socket 文件路徑，比如

```sh
kubelet --container-runtime=remote --container-runtime-endpoint=unix:///var/run/runtime.sock --image-service-endpoint=unix:///var/run/runtime.sock
```

## 容器運行時

| **CRI** **容器運行時** | **維護者** | **主要特性**                 | **容器引擎**               |
| ---------------------- | ---------- | ---------------------------- | -------------------------- |
| **Dockershim**         | Kubernetes | 內置實現、特性最新           | docker                     |
| **cri-o**              | Kubernetes | OCI標準不需要Docker          | OCI（runc、kata、gVisor…） |
| **cri-containerd**     | Containerd | 基於 containerd 不需要Docker | OCI（runc、kata、gVisor…） |
| **Frakti**             | Kubernetes | 虛擬化容器                   | hyperd、docker             |
| **rktlet**             | Kubernetes | 支持rkt                      | rkt                        |
| **PouchContainer**     | Alibaba    | 富容器                       | OCI（runc、kata…）         |
| **Virtlet**            | Mirantis   | 虛擬機和QCOW2鏡像            | Libvirt（KVM）             |

目前基於 CRI 容器引擎已經比較豐富了，包括

- Docker: 核心代碼依然保留在 kubelet 內部（[pkg/kubelet/dockershim](https://github.com/kubernetes/kubernetes/tree/master/pkg/kubelet/dockershim)），是最穩定和特性支持最好的運行時
- OCI 容器運行時：
  - 社區有兩個實現
    - [Containerd](https://github.com/containerd/cri)，支持 kubernetes v1.7+
    - [CRI-O](https://github.com/kubernetes-incubator/cri-o)，支持 Kubernetes v1.6+
  - 支持的 OCI 容器引擎包括
    - [runc](https://github.com/opencontainers/runc)：OCI 標準容器引擎
    - [gVisor](https://github.com/google/gvisor)：谷歌開源的基於用戶空間內核的沙箱容器引擎
    - [Clear Containers](https://github.com/clearcontainers/runtime)：Intel 開源的基於虛擬化的容器引擎
    - [Kata Containers](https://github.com/kata-containers/runtime)：基於虛擬化的容器引擎，由 Clear Containers 和 runV 合併而來
- [PouchContainer](https://github.com/alibaba/pouch)：阿里巴巴開源的胖容器引擎
- [Frakti](https://github.com/kubernetes/frakti)：支持 Kubernetes v1.6+，提供基於 hypervisor 和 docker 的混合運行時，適用於運行非可信應用，如多租戶和 NFV 等場景
- [Rktlet](https://github.com/kubernetes-incubator/rktlet)：支持 [rkt](https://github.com/rkt/rkt) 容器引擎（rknetes 代碼已在 v1.10 中棄用）
- [Virtlet](https://github.com/Mirantis/virtlet)：Mirantis 開源的虛擬機容器引擎，直接管理 libvirt 虛擬機，鏡像須是 qcow2 格式
- [Infranetes](https://github.com/apporbit/infranetes)：直接管理 IaaS 平臺虛擬機，如 GCE、AWS 等

### Containerd

以 Containerd 為例，在 1.0 及以前版本將 dockershim 和 docker daemon 替換為 cri-containerd + containerd，而在 1.1 版本直接將 cri-containerd 內置在 Containerd 中，簡化為一個 CRI 插件。

![](images/cri-containerd.png)

Containerd 內置的 CRI 插件實現了 Kubelet CRI 接口中的 Image Service 和 Runtime Service，通過內部接口管理容器和鏡像，並通過 CNI 插件給 Pod 配置網絡。

![](images/containerd.png)

## RuntimeClass

RuntimeClass 是 v1.12 引入的新 API 對象，用來支持多容器運行時，比如

* Kata Containers/gVisor + runc
* Windows Process isolation + Hyper-V isolation containers

RuntimeClass 表示一個運行時對象，在使用前需要開啟特性開關 `RuntimeClass`，並創建 RuntimeClass CRD：

```sh
kubectl apply -f https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/runtimeclass/runtimeclass_crd.yaml
```

然後就可以定義 RuntimeClass 對象

```yaml
apiVersion: node.k8s.io/v1alpha1  # RuntimeClass is defined in the node.k8s.io API group
kind: RuntimeClass
metadata:
  name: myclass  # The name the RuntimeClass will be referenced by
  # RuntimeClass is a non-namespaced resource
spec:
  runtimeHandler: myconfiguration  # The name of the corresponding CRI configuration
```

而在 Pod 中定義使用哪個 RuntimeClass：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: mypod
spec:
  runtimeClassName: myclass
  # ...
```

## 參考文檔

- [Runtime Class Documentation](https://kubernetes.io/docs/concepts/containers/runtime-class/#runtime-class)
- [Sandbox Isolation Level Decision](https://docs.google.com/document/d/1fe7lQUjYKR0cijRmSbH_y0_l3CYPkwtQa5ViywuNo8Q/preview)
