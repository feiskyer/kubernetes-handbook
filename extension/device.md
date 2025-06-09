# Device 插件

Kubernetes v1.8 开始增加了 Alpha 版的 Device 插件，用来支持 GPU、FPGA、高性能 NIC、InfiniBand 等各种设备。这样，设备厂商只需要根据 Device Plugin 的接口实现一个特定设备的插件，而不需要修改 Kubernetes 核心代码。

> 在 v1.10 中该特性升级为 Beta 版本。

> **注意：** 从 Kubernetes v1.26 开始，引入了 Dynamic Resource Allocation (DRA) 作为 Device 插件的演进版本，提供了更灵活的资源分配机制。详见本文后面的 DRA 章节。

## Device 插件原理

使用 Device 插件之前，首先要开启 DevicePlugins 功能，即配置 `--feature-gates=DevicePlugins=true`（默认是关闭的）。

Device 插件实际上是一个 [gPRC 接口](https://github.com/kubernetes/community/blob/master/contributors/design-proposals/resource-management/device-plugin.md)，需要实现 `ListAndWatch()` 和 `Allocate()` 等方法，并监听 gRPC Server 的 Unix Socket 在 `/var/lib/kubelet/device-plugins/` 目录中，如 `/var/lib/kubelet/device-plugins/nvidiaGPU.sock`。在实现 Device 插件时需要注意

* 插件启动时，需要通过 `/var/lib/kubelet/device-plugins/kubelet.sock` 向 Kubelet 注册，同时提供插件的 Unix Socket 名称、API 的版本号和插件名称（格式为 `vendor-domain/resource`，如 `nvidia.com/gpu`）。Kubelet 会将这些设备暴露到 Node 状态中，方便后续调度器使用
* 插件启动后向 Kubelet 发送插件列表、按需分配设备并持续监控设备的实时状态
* 插件启动后要持续监控 Kubelet 的状态，并在 Kubelet 重启后重新注册自己。比如，Kubelet 刚启动后会清空 `/var/lib/kubelet/device-plugins/` 目录，所以插件作者可以监控自己监听的 unix socket 是否被删除了，并根据此事件重新注册自己

![](../.gitbook/assets/device-plugin-overview.png)

Device 插件一般推荐使用 DaemonSet 的方式部署，并将 `/var/lib/kubelet/device-plugins` 以 Volume 的形式挂载到容器中。当然，也可以手动运行的方式来部署，但这样就没有失败自动恢复的功能了。

## NVIDIA GPU 插件

NVIDIA 提供了一个基于 Device Plugins 接口的 GPU 设备插件 [NVIDIA/k8s-device-plugin](https://github.com/NVIDIA/k8s-device-plugin)。

编译

```bash
git clone https://github.com/NVIDIA/k8s-device-plugin
cd k8s-device-plugin
docker build -t nvidia-device-plugin:1.0.0 .
```

部署

```bash
kubectl apply -f https://raw.githubusercontent.com/NVIDIA/k8s-device-plugin/master/nvidia-device-plugin.yml
```

创建 Pod 时请求 GPU 资源

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: pod1
spec:
  restartPolicy: OnFailure
  containers:
  - image: nvidia/cuda
    name: pod1-ctr
    command: ["sleep"]
    args: ["100000"]

    resources:
      limits:
        nvidia.com/gpu: 1
```

注意：**使用该插件时需要配置** [**nvidia-docker 2.0**](https://github.com/NVIDIA/nvidia-docker/)**，并配置 `nvidia` 为默认运行时 （即配置 docker daemon 的选项 `--default-runtime=nvidia`）**。nvidia-docker 2.0 的安装方法为（以 Ubuntu Xenial 为例，其他系统的安装方法可以参考 [这里](http://nvidia.github.io/nvidia-docker/)）：

```bash
# Configure repository
curl -L https://nvidia.github.io/nvidia-docker/gpgkey | \
sudo apt-key add -
sudo tee /etc/apt/sources.list.d/nvidia-docker.list <<< \
"deb https://nvidia.github.io/libnvidia-container/ubuntu16.04/amd64 /
deb https://nvidia.github.io/nvidia-container-runtime/ubuntu16.04/amd64 /
deb https://nvidia.github.io/nvidia-docker/ubuntu16.04/amd64 /"
sudo apt-get update

# Install nvidia-docker 2.0
sudo apt-get install nvidia-docker2
sudo pkill -SIGHUP dockerd

# Check installation
docker run --runtime=nvidia --rm nvidia/cuda nvidia-smi
```

## GCP GPU 插件

GCP 也提供了一个 GPU 设备的插件，仅适用于 Google Container Engine，可以访问 [GoogleCloudPlatform/container-engine-accelerators](https://github.com/GoogleCloudPlatform/container-engine-accelerators) 查看。

## Dynamic Resource Allocation (DRA)

Dynamic Resource Allocation (DRA) 是 Kubernetes v1.26 引入的 Alpha 特性，是 Device 插件的下一代演进方案。DRA 提供了更灵活、更细粒度的设备资源分配机制。

### DRA 核心特性

在 Kubernetes v1.33 中，DRA 已经发生了重要的更新：

#### Beta 特性

* **Driver-owned Resource Claim Status (Beta)**: 允许驱动程序为已分配的设备报告特定于设备的状态数据

#### Alpha 特性

1. **可分区设备 (Partitionable Devices)**
   - 允许驱动程序通告重叠的逻辑设备"分区"
   - 支持物理设备的动态重新配置以提高利用率

2. **设备污点与容忍度 (Device Taints and Tolerations)**
   - 允许将设备标记为不可用
   - 支持基于污点阻止设备分配或 Pod 驱逐

3. **优先级列表 (Prioritized List)**
   - 允许用户指定多个可接受的设备备选方案
   - 调度器尝试按优先级顺序分配最佳可用设备

4. **管理员访问控制 (Admin Access)**
   - 限制只有具有特定管理员访问标签的命名空间才能创建 ResourceClaim
   - 防止非管理员用户误用设备管理功能

### DRA vs Device 插件

| 特性 | Device 插件 | DRA |
|------|-------------|-----|
| 资源分配 | 静态，启动时分配 | 动态，按需分配 |
| 设备共享 | 有限支持 | 灵活的分区和共享 |
| 资源类型 | 固定类型 | 自定义资源类 |
| 配置灵活性 | 基本配置 | 丰富的配置选项 |
| 错误恢复 | 有限 | 更好的错误处理 |

### DRA 工作流程

1. **资源类定义**: 管理员定义 ResourceClass，描述可用的设备类型和配置
2. **资源声明**: 用户创建 ResourceClaim，请求特定类型的资源
3. **调度决策**: 调度器考虑资源可用性进行 Pod 调度
4. **资源分配**: DRA 驱动程序分配具体设备给 Pod
5. **设备使用**: Pod 使用分配的设备资源
6. **资源释放**: Pod 完成后自动释放资源

### 示例：使用 DRA 分配 GPU

```yaml
# ResourceClass 定义
apiVersion: resource.k8s.io/v1alpha2
kind: ResourceClass
metadata:
  name: gpu-class
spec:
  driverName: gpu.example.com
  parameters:
    memory: "8Gi"
    compute: "high"
---
# ResourceClaim 声明
apiVersion: resource.k8s.io/v1alpha2
kind: ResourceClaim
metadata:
  name: my-gpu-claim
spec:
  resourceClassName: gpu-class
---
# Pod 使用资源
apiVersion: v1
kind: Pod
metadata:
  name: gpu-pod
spec:
  containers:
  - name: gpu-container
    image: nvidia/cuda
    resources:
      claims:
      - name: gpu-resource
        request: my-gpu-claim
  resourceClaims:
  - name: gpu-resource
    source:
      resourceClaimName: my-gpu-claim
```

### 未来发展

DRA 计划在 Kubernetes v1.34 中升级为 GA（Generally Available）状态。未来的发展包括：

- 默认启用更多 DRA 特性
- v1.33 的 Alpha 特性将在 v1.34 中升级为 Beta
- 改进的用户体验和 API 简化

### 迁移建议

对于新项目，建议考虑使用 DRA 而不是传统的 Device 插件，特别是在以下场景：

- 需要动态设备分配
- 需要设备分区或共享
- 需要复杂的设备配置
- 需要更好的错误处理和恢复

## 参考文档

* [Device Manager Proposal](https://github.com/kubernetes/community/blob/master/contributors/design-proposals/resource-management/device-plugin.md)
* [Device Plugins](https://kubernetes.io/docs/concepts/cluster-administration/device-plugins/)
* [NVIDIA device plugin for Kubernetes](https://github.com/NVIDIA/k8s-device-plugin)
* [NVIDIA Container Runtime for Docker](https://github.com/NVIDIA/nvidia-docker)
* [Dynamic Resource Allocation](https://kubernetes.io/docs/concepts/scheduling-eviction/dynamic-resource-allocation/)
* [Kubernetes v1.33 DRA Updates](https://kubernetes.io/blog/2025/05/01/kubernetes-v1-33-dra-updates/)

