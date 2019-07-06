# Device 插件

Kubernetes v1.8 开始增加了 Alpha 版的 Device 插件，用来支持 GPU、FPGA、高性能 NIC、InfiniBand 等各种设备。这样，设备厂商只需要根据 Device Plugin 的接口实现一个特定设备的插件，而不需要修改 Kubernetes 核心代码。

> 在 v1.10 中该特性升级为 Beta 版本。

## Device 插件原理

使用 Device 插件之前，首先要开启 DevicePlugins 功能，即配置 `--feature-gates=DevicePlugins=true`（默认是关闭的）。

Device 插件实际上是一个 [gPRC 接口](https://github.com/kubernetes/community/blob/master/contributors/design-proposals/resource-management/device-plugin.md)，需要实现 `ListAndWatch()` 和 `Allocate()` 等方法，并监听 gRPC Server 的 Unix Socket 在 `/var/lib/kubelet/device-plugins/` 目录中，如 `/var/lib/kubelet/device-plugins/nvidiaGPU.sock`。在实现 Device 插件时需要注意

- 插件启动时，需要通过 `/var/lib/kubelet/device-plugins/kubelet.sock` 向 Kubelet 注册，同时提供插件的 Unix Socket 名称、API 的版本号和插件名称（格式为 `vendor-domain/resource`，如 `nvidia.com/gpu`）。Kubelet 会将这些设备暴露到 Node 状态中，方便后续调度器使用
- 插件启动后向 Kubelet 发送插件列表、按需分配设备并持续监控设备的实时状态
- 插件启动后要持续监控 Kubelet 的状态，并在 Kubelet 重启后重新注册自己。比如，Kubelet 刚启动后会清空 `/var/lib/kubelet/device-plugins/` 目录，所以插件作者可以监控自己监听的 unix socket 是否被删除了，并根据此事件重新注册自己

![](images/device-plugin-overview.png)

Device 插件一般推荐使用 DaemonSet 的方式部署，并将 `/var/lib/kubelet/device-plugins` 以 Volume 的形式挂载到容器中。当然，也可以手动运行的方式来部署，但这样就没有失败自动恢复的功能了。

## NVIDIA GPU 插件

NVIDIA 提供了一个基于 Device Plugins 接口的 GPU 设备插件 [NVIDIA/k8s-device-plugin](https://github.com/NVIDIA/k8s-device-plugin)。

编译

```sh
git clone https://github.com/NVIDIA/k8s-device-plugin
cd k8s-device-plugin
docker build -t nvidia-device-plugin:1.0.0 .
```

部署

```sh
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

注意：**使用该插件时需要配置 [nvidia-docker 2.0](https://github.com/NVIDIA/nvidia-docker/)，并配置 `nvidia` 为默认运行时 （即配置 docker daemon 的选项 `--default-runtime=nvidia`）**。nvidia-docker 2.0 的安装方法为（以 Ubuntu Xenial 为例，其他系统的安装方法可以参考 [这里](http://nvidia.github.io/nvidia-docker/)）：

```sh
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

## 参考文档

- [Device Manager Proposal](https://github.com/kubernetes/community/blob/master/contributors/design-proposals/resource-management/device-plugin.md)
- [Device Plugins](https://kubernetes.io/docs/concepts/cluster-administration/device-plugins/)
- [NVIDIA device plugin for Kubernetes](https://github.com/NVIDIA/k8s-device-plugin)
- [NVIDIA Container Runtime for Docker](https://github.com/NVIDIA/nvidia-docker)
