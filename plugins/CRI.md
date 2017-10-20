# Container Runtime Interface

Container Runtime Interface (CRI)是 Kubelet 1.5/1.6 中主要负责的一块项目，它重新定义了 Kubelet Container Runtime API，将原来完全面向 Pod 级别的 API 拆分成面向 Sandbox 和 Container 的 API，并分离镜像管理和容器引擎到不同的服务。

![](images/cri.png)

CRI 最早从从1.4版就开始设计讨论和开发，在v1.5中发布第一个测试版。在v1.6时已经有了很多外部容器运行时，如frakti、cri-o的alpha支持。v1.7版本新增了 cri-containerd 的 alpha 支持，而 frakti 和 cri-o 则升级到 beta 支持。

## CRI 接口

CRI 基于 gRPC 定义了 RuntimeService 和 ImageService，分别用于容器运行时和镜像的管理。其定义在

- v1.7+: [pkg/kubelet/apis/cri/v1alpha1/runtime](https://github.com/kubernetes/kubernetes/tree/master/pkg/kubelet/apis/cri/v1alpha1/runtime)
- v1.6: [pkg/kubelet/api/v1alpha1/runtime](https://github.com/kubernetes/kubernetes/tree/release-1.6/pkg/kubelet/api/v1alpha1/runtime)

Kubelet 作为 CRI 的客户端，而 Runtime 维护者则需要实现 CRI 服务端，并在启动 kubelet 时将其传入：

```sh
kubelet --container-runtime=remote --container-runtime-endpoint=/var/run/frakti.sock ..
```

## 如何开发新的Container Runtime

开发新的 Container Runtime 只需要实现 CRI gRPC Server，包括 RuntimeService 和 ImageService。该 gRPC Server 需要监听在本地的 unix socket（Linux支持unix socket格式，Windows支持tcp格式）。

具体的实现方法可以参考下面已经支持的 Container Runtime 列表。

## 目前支持的Container Runtime

目前，有多家厂商都在基于CRI集成自己的容器引擎，其中包括

- Docker: 核心代码依然保留在 kubelet 内部（[pkg/kubelet/dockershim](https://github.com/kubernetes/kubernetes/tree/master/pkg/kubelet/dockershim)），依然是最稳定和特性支持最好的Runtime
- HyperContainer: <https://github.com/kubernetes/frakti>，支持Kubernetes v1.6+，提供基于 hypervisor 和 docker 的混合运行时，适用于运行非可信应用，如多租户和NFV等场景
- Runc有两个实现，cri-o和cri-containerd
  - [cri-containerd](https://github.com/kubernetes-incubator/cri-containerd)，支持kubernetes v1.7+
  - [cri-o](https://github.com/kubernetes-incubator/cri-o)，支持Kubernetes v1.6+，底层运行时支持runc和intel clear container。
- Rkt: <https://github.com/kubernetes-incubator/rktlet>，开发中
- Mirantis: <https://github.com/Mirantis/virtlet>，直接管理libvirt虚拟机，镜像须是qcow2格式
- Infranetes: <https://github.com/apporbit/infranetes>，直接管理IaaS平台虚拟机，如GCE、AWS等

## CRI Tools

为了方便开发、调试和验证新的 Container Runtime，社区还维护了一个 [cri-tools](https://github.com/kubernetes-incubator/cri-tools) 工具，它提供两个组件

- crictl：类似于docker的命令行工具，不需要通过 Kubelet 就可以跟 Container Runtime 通信，可用来调试或排查问题
- critest：CRI 的验证测试工具，用来验证新的 Container Runtime 是否实现了 CRI 需要的功能
