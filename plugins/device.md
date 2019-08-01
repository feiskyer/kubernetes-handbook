# Device 插件

Kubernetes v1.8 開始增加了 Alpha 版的 Device 插件，用來支持 GPU、FPGA、高性能 NIC、InfiniBand 等各種設備。這樣，設備廠商只需要根據 Device Plugin 的接口實現一個特定設備的插件，而不需要修改 Kubernetes 核心代碼。

> 在 v1.10 中該特性升級為 Beta 版本。

## Device 插件原理

使用 Device 插件之前，首先要開啟 DevicePlugins 功能，即配置 `--feature-gates=DevicePlugins=true`（默認是關閉的）。

Device 插件實際上是一個 [gPRC 接口](https://github.com/kubernetes/community/blob/master/contributors/design-proposals/resource-management/device-plugin.md)，需要實現 `ListAndWatch()` 和 `Allocate()` 等方法，並監聽 gRPC Server 的 Unix Socket 在 `/var/lib/kubelet/device-plugins/` 目錄中，如 `/var/lib/kubelet/device-plugins/nvidiaGPU.sock`。在實現 Device 插件時需要注意

- 插件啟動時，需要通過 `/var/lib/kubelet/device-plugins/kubelet.sock` 向 Kubelet 註冊，同時提供插件的 Unix Socket 名稱、API 的版本號和插件名稱（格式為 `vendor-domain/resource`，如 `nvidia.com/gpu`）。Kubelet 會將這些設備暴露到 Node 狀態中，方便後續調度器使用
- 插件啟動後向 Kubelet 發送插件列表、按需分配設備並持續監控設備的實時狀態
- 插件啟動後要持續監控 Kubelet 的狀態，並在 Kubelet 重啟後重新註冊自己。比如，Kubelet 剛啟動後會清空 `/var/lib/kubelet/device-plugins/` 目錄，所以插件作者可以監控自己監聽的 unix socket 是否被刪除了，並根據此事件重新註冊自己

![](images/device-plugin-overview.png)

Device 插件一般推薦使用 DaemonSet 的方式部署，並將 `/var/lib/kubelet/device-plugins` 以 Volume 的形式掛載到容器中。當然，也可以手動運行的方式來部署，但這樣就沒有失敗自動恢復的功能了。

## NVIDIA GPU 插件

NVIDIA 提供了一個基於 Device Plugins 接口的 GPU 設備插件 [NVIDIA/k8s-device-plugin](https://github.com/NVIDIA/k8s-device-plugin)。

編譯

```sh
git clone https://github.com/NVIDIA/k8s-device-plugin
cd k8s-device-plugin
docker build -t nvidia-device-plugin:1.0.0 .
```

部署

```sh
kubectl apply -f https://raw.githubusercontent.com/NVIDIA/k8s-device-plugin/master/nvidia-device-plugin.yml
```

創建 Pod 時請求 GPU 資源

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

注意：**使用該插件時需要配置 [nvidia-docker 2.0](https://github.com/NVIDIA/nvidia-docker/)，並配置 `nvidia` 為默認運行時 （即配置 docker daemon 的選項 `--default-runtime=nvidia`）**。nvidia-docker 2.0 的安裝方法為（以 Ubuntu Xenial 為例，其他系統的安裝方法可以參考 [這裡](http://nvidia.github.io/nvidia-docker/)）：

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

GCP 也提供了一個 GPU 設備的插件，僅適用於 Google Container Engine，可以訪問 [GoogleCloudPlatform/container-engine-accelerators](https://github.com/GoogleCloudPlatform/container-engine-accelerators) 查看。

## 參考文檔

- [Device Manager Proposal](https://github.com/kubernetes/community/blob/master/contributors/design-proposals/resource-management/device-plugin.md)
- [Device Plugins](https://kubernetes.io/docs/concepts/cluster-administration/device-plugins/)
- [NVIDIA device plugin for Kubernetes](https://github.com/NVIDIA/k8s-device-plugin)
- [NVIDIA Container Runtime for Docker](https://github.com/NVIDIA/nvidia-docker)
