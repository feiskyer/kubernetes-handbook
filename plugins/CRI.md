# Container Runtime Interface (CRI)

容器运行时插件（Container Runtime Interface，简称 CRI）是 Kubernetes v1.5 引入的容器运行时接口，它将 Kubelet 与容器运行时解耦，将原来完全面向 Pod 级别的内部接口拆分成面向 Sandbox 和 Container 的 gRPC 接口，并将镜像管理和容器管理分离到不同的服务。

![](images/cri.png)

CRI 最早从从 1.4 版就开始设计讨论和开发，在 v1.5 中发布第一个测试版。在 v1.6 时已经有了很多外部容器运行时，如 frakti 和 cri-o 等。v1.7 中又新增了 cri-containerd 支持用 Containerd 来管理容器。

采用 CRI 后，Kubelet 的架构如下图所示：

![image-20190316183052101](assets/image-20190316183052101.png)

## CRI 接口

CRI 基于 gRPC 定义了 RuntimeService 和 ImageService 等两个 gRPC 服务，分别用于容器运行时和镜像的管理。其定义在

- v1.14 以以上：<https://github.com/kubernetes/cri-api/tree/master/pkg/apis/runtime>
- v1.10-v1.13: [pkg/kubelet/apis/cri/runtime/v1alpha2](https://github.com/kubernetes/kubernetes/tree/release-1.13/pkg/kubelet/apis/cri/runtime/v1alpha2)
- v1.7-v1.9: [pkg/kubelet/apis/cri/v1alpha1/runtime](https://github.com/kubernetes/kubernetes/tree/release-1.9/pkg/kubelet/apis/cri/v1alpha1/runtime)
- v1.6: [pkg/kubelet/api/v1alpha1/runtime](https://github.com/kubernetes/kubernetes/tree/release-1.6/pkg/kubelet/api/v1alpha1/runtime)

Kubelet 作为 CRI 的客户端，而容器运行时则需要实现 CRI 的服务端（即 gRPC server，通常称为 CRI shim）。容器运行时在启动 gRPC server 时需要监听在本地的 Unix Socket （Windows 使用 tcp 格式）。

### 开发 CRI 容器运行时

开发新的容器运行时只需要实现 CRI 的 gRPC Server，包括 RuntimeService 和 ImageService。该 gRPC Server 需要监听在本地的 unix socket（Linux 支持 unix socket 格式，Windows 支持 tcp 格式）。

一个简单的示例为

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

对于 Streaming API（Exec、PortForward 和 Attach），CRI 要求容器运行时返回一个 streaming server 的 URL 以便 Kubelet 重定向 API Server 发送过来的请求。在 v1.10 及更早版本中，容器运行时必需返回一个 API Server 可直接访问的 URL（通常跟 Kubelet 使用相同的监听地址）；而从 v1.11 开始，Kubelet 新增了 `--redirect-container-streaming`（默认为 false），默认不再转发而是代理 Streaming 请求，这样运行时可以返回一个 localhost 的 URL（当然也不再需要配置 TLS）。

![image-20190316183005314](assets/image-20190316183005314.png)

详细的实现方法可以参考 [dockershim](https://github.com/kubernetes/kubernetes/tree/master/pkg/kubelet/dockershim) 或者 [cri-o](https://github.com/kubernetes-incubator/cri-o)。

### Kubelet 配置

在启动 kubelet 时传入容器运行时监听的 Unix Socket 文件路径，比如

```sh
kubelet --container-runtime=remote --container-runtime-endpoint=unix:///var/run/runtime.sock --image-service-endpoint=unix:///var/run/runtime.sock
```

## 容器运行时

| **CRI** **容器运行时** | **维护者** | **主要特性**                 | **容器引擎**               |
| ---------------------- | ---------- | ---------------------------- | -------------------------- |
| **Dockershim**         | Kubernetes | 内置实现、特性最新           | docker                     |
| **cri-o**              | Kubernetes | OCI标准不需要Docker          | OCI（runc、kata、gVisor…） |
| **cri-containerd**     | Containerd | 基于 containerd 不需要Docker | OCI（runc、kata、gVisor…） |
| **Frakti**             | Kubernetes | 虚拟化容器                   | hyperd、docker             |
| **rktlet**             | Kubernetes | 支持rkt                      | rkt                        |
| **PouchContainer**     | Alibaba    | 富容器                       | OCI（runc、kata…）         |
| **Virtlet**            | Mirantis   | 虚拟机和QCOW2镜像            | Libvirt（KVM）             |

目前基于 CRI 容器引擎已经比较丰富了，包括

- Docker: 核心代码依然保留在 kubelet 内部（[pkg/kubelet/dockershim](https://github.com/kubernetes/kubernetes/tree/master/pkg/kubelet/dockershim)），是最稳定和特性支持最好的运行时
- OCI 容器运行时：
  - 社区有两个实现
    - [Containerd](https://github.com/containerd/cri)，支持 kubernetes v1.7+
    - [CRI-O](https://github.com/kubernetes-incubator/cri-o)，支持 Kubernetes v1.6+
  - 支持的 OCI 容器引擎包括
    - [runc](https://github.com/opencontainers/runc)：OCI 标准容器引擎
    - [gVisor](https://github.com/google/gvisor)：谷歌开源的基于用户空间内核的沙箱容器引擎
    - [Clear Containers](https://github.com/clearcontainers/runtime)：Intel 开源的基于虚拟化的容器引擎
    - [Kata Containers](https://github.com/kata-containers/runtime)：基于虚拟化的容器引擎，由 Clear Containers 和 runV 合并而来
- [PouchContainer](https://github.com/alibaba/pouch)：阿里巴巴开源的胖容器引擎
- [Frakti](https://github.com/kubernetes/frakti)：支持 Kubernetes v1.6+，提供基于 hypervisor 和 docker 的混合运行时，适用于运行非可信应用，如多租户和 NFV 等场景
- [Rktlet](https://github.com/kubernetes-incubator/rktlet)：支持 [rkt](https://github.com/rkt/rkt) 容器引擎（rknetes 代码已在 v1.10 中弃用）
- [Virtlet](https://github.com/Mirantis/virtlet)：Mirantis 开源的虚拟机容器引擎，直接管理 libvirt 虚拟机，镜像须是 qcow2 格式
- [Infranetes](https://github.com/apporbit/infranetes)：直接管理 IaaS 平台虚拟机，如 GCE、AWS 等

### Containerd

以 Containerd 为例，在 1.0 及以前版本将 dockershim 和 docker daemon 替换为 cri-containerd + containerd，而在 1.1 版本直接将 cri-containerd 内置在 Containerd 中，简化为一个 CRI 插件。

![](images/cri-containerd.png)

Containerd 内置的 CRI 插件实现了 Kubelet CRI 接口中的 Image Service 和 Runtime Service，通过内部接口管理容器和镜像，并通过 CNI 插件给 Pod 配置网络。

![](images/containerd.png)

## RuntimeClass

RuntimeClass 是 v1.12 引入的新 API 对象，用来支持多容器运行时，比如

* Kata Containers/gVisor + runc
* Windows Process isolation + Hyper-V isolation containers

RuntimeClass 表示一个运行时对象，在使用前需要开启特性开关 `RuntimeClass`，并创建 RuntimeClass CRD：

```sh
kubectl apply -f https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/runtimeclass/runtimeclass_crd.yaml
```

然后就可以定义 RuntimeClass 对象

```yaml
apiVersion: node.k8s.io/v1alpha1  # RuntimeClass is defined in the node.k8s.io API group
kind: RuntimeClass
metadata:
  name: myclass  # The name the RuntimeClass will be referenced by
  # RuntimeClass is a non-namespaced resource
spec:
  runtimeHandler: myconfiguration  # The name of the corresponding CRI configuration
```

而在 Pod 中定义使用哪个 RuntimeClass：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: mypod
spec:
  runtimeClassName: myclass
  # ...
```

## 参考文档

- [Runtime Class Documentation](https://kubernetes.io/docs/concepts/containers/runtime-class/#runtime-class)
- [Sandbox Isolation Level Decision](https://docs.google.com/document/d/1fe7lQUjYKR0cijRmSbH_y0_l3CYPkwtQa5ViywuNo8Q/preview)
