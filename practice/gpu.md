# GPU

Kubernetes 支持容器請求 GPU 資源（目前僅支持 NVIDIA GPU），在深度學習等場景中有大量應用。

## 使用方法

### Kubernetes v1.8 及更新版本

從 Kubernetes v1.8 開始，GPU 開始以 DevicePlugin 的形式實現。在使用之前需要配置

- kubelet/kube-apiserver/kube-controller-manager: `--feature-gates="DevicePlugins=true"`
- 在所有的 Node 上安裝 Nvidia 驅動，包括 NVIDIA Cuda Toolkit 和 cuDNN 等
- Kubelet 配置使用 docker 容器引擎（默認就是 docker），其他容器引擎暫不支持該特性

#### NVIDIA 插件

NVIDIA 需要 nvidia-docker。

安裝 nvidia-docker

```sh
# Install docker-ce
sudo apt-get install \
    apt-transport-https \
    ca-certificates \
    curl \
    software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository \
   "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
   $(lsb_release -cs) \
   stable"
sudo apt-get update
sudo apt-get install docker-ce

# Add the package repositories
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | \
  sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/ubuntu16.04/amd64/nvidia-docker.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-docker.list
sudo apt-get update

# Install nvidia-docker2 and reload the Docker daemon configuration
sudo apt-get install -y nvidia-docker2
sudo pkill -SIGHUP dockerd

# Test nvidia-smi with the latest official CUDA image
docker run --runtime=nvidia --rm nvidia/cuda nvidia-smi
```

設置 Docker 默認運行時為 nvidia

```sh
# cat /etc/docker/daemon.json
{
    "default-runtime": "nvidia",
    "runtimes": {
        "nvidia": {
            "path": "/usr/bin/nvidia-container-runtime",
            "runtimeArgs": []
        }
    }
}
```

部署 NVDIA 設備插件

```sh
# For Kubernetes v1.8
kubectl create -f https://raw.githubusercontent.com/NVIDIA/k8s-device-plugin/v1.8/nvidia-device-plugin.yml

# For Kubernetes v1.9
kubectl create -f https://raw.githubusercontent.com/NVIDIA/k8s-device-plugin/v1.9/nvidia-device-plugin.yml
```

#### GCE/GKE GPU 插件

該插件不需要 nvidia-docker，並且也支持 CRI 容器運行時。

```sh
# Install NVIDIA drivers on Container-Optimized OS:
kubectl create -f https://raw.githubusercontent.com/GoogleCloudPlatform/container-engine-accelerators/k8s-1.9/daemonset.yaml

# Install NVIDIA drivers on Ubuntu (experimental):
kubectl create -f https://raw.githubusercontent.com/GoogleCloudPlatform/container-engine-accelerators/k8s-1.9/nvidia-driver-installer/ubuntu/daemonset.yaml

# Install the device plugin:
kubectl create -f https://raw.githubusercontent.com/kubernetes/kubernetes/release-1.9/cluster/addons/device-plugins/nvidia-gpu/daemonset.yaml
```

#### 請求 `nvidia.com/gpu` 資源示例

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: cuda-vector-add
spec:
  restartPolicy: OnFailure
  containers:
    - name: cuda-vector-add
      # https://github.com/kubernetes/kubernetes/blob/v1.7.11/test/images/nvidia-cuda/Dockerfile
      image: "k8s.gcr.io/cuda-vector-add:v0.1"
      resources:
        limits:
          nvidia.com/gpu: 1 # requesting 1 GPU
```

### Kubernetes v1.6 和 v1.7

> `alpha.kubernetes.io/nvidia-gpu` 已在 v1.10 中刪除，新版本請使用 `nvidia.com/gpu`。

在 Kubernetes v1.6 和 v1.7 中使用 GPU 需要預先配置

- 在所有的 Node 上安裝 Nvidia 驅動，包括 NVIDIA Cuda Toolkit 和 cuDNN 等
- 在 apiserver 和 kubelet 上開啟 `--feature-gates="Accelerators=true"`
- Kubelet 配置使用 docker 容器引擎（默認就是 docker），其他容器引擎暫不支持該特性

使用資源名 `alpha.kubernetes.io/nvidia-gpu` 指定請求 GPU 的個數，如

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: tensorflow
spec:
  restartPolicy: Never
  containers:
  - image: gcr.io/tensorflow/tensorflow:latest-gpu
    name: gpu-container-1
    command: ["python"]
    env:
    - name: LD_LIBRARY_PATH
      value: /usr/lib/nvidia
    args:
    - -u
    - -c
    - from tensorflow.python.client import device_lib; print device_lib.list_local_devices()
    resources:
      limits:
        alpha.kubernetes.io/nvidia-gpu: 1 # requests one GPU
    volumeMounts:
    - mountPath: /usr/local/nvidia/bin
      name: bin
    - mountPath: /usr/lib/nvidia
      name: lib
    - mountPath: /usr/lib/x86_64-linux-gnu/libcuda.so
      name: libcuda-so
    - mountPath: /usr/lib/x86_64-linux-gnu/libcuda.so.1
      name: libcuda-so-1
    - mountPath: /usr/lib/x86_64-linux-gnu/libcuda.so.375.66
      name: libcuda-so-375-66
  volumes:
    - name: bin
      hostPath:
        path: /usr/lib/nvidia-375/bin
    - name: lib
      hostPath:
        path: /usr/lib/nvidia-375
    - name: libcuda-so
      hostPath:
        path: /usr/lib/x86_64-linux-gnu/libcuda.so
    - name: libcuda-so-1
      hostPath:
        path: /usr/lib/x86_64-linux-gnu/libcuda.so.1
    - name: libcuda-so-375-66
      hostPath:
        path: /usr/lib/x86_64-linux-gnu/libcuda.so.375.66
```

```sh
$ kubectl create -f pod.yaml
pod "tensorflow" created

$ kubectl logs tensorflow
...
[name: "/cpu:0"
device_type: "CPU"
memory_limit: 268435456
locality {
}
incarnation: 9675741273569321173
, name: "/gpu:0"
device_type: "GPU"
memory_limit: 11332668621
locality {
  bus_id: 1
}
incarnation: 7807115828340118187
physical_device_desc: "device: 0, name: Tesla K80, pci bus id: 0000:00:04.0"
]
```

注意

- GPU 資源必須在 `resources.limits` 中請求，`resources.requests` 中無效
- 容器可以請求 1 個或多個 GPU，不能只請求一部分
- 多個容器之間不能共享 GPU
- 默認假設所有 Node 安裝了相同型號的 GPU

## 多種型號的 GPU

如果集群 Node 中安裝了多種型號的 GPU，則可以使用 Node Affinity 來調度 Pod 到指定 GPU 型號的 Node 上。

首先，在集群初始化時，需要給 Node 打上 GPU 型號的標籤

```sh
# Label your nodes with the accelerator type they have.
kubectl label nodes <node-with-k80> accelerator=nvidia-tesla-k80
kubectl label nodes <node-with-p100> accelerator=nvidia-tesla-p100
```

然後，在創建 Pod 時設置 Node Affinity：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: cuda-vector-add
spec:
  restartPolicy: OnFailure
  containers:
    - name: cuda-vector-add
      # https://github.com/kubernetes/kubernetes/blob/v1.7.11/test/images/nvidia-cuda/Dockerfile
      image: "k8s.gcr.io/cuda-vector-add:v0.1"
      resources:
        limits:
          nvidia.com/gpu: 1
  nodeSelector:
    accelerator: nvidia-tesla-p100 # or nvidia-tesla-k80 etc.
```

## 使用 CUDA 庫

NVIDIA Cuda Toolkit 和 cuDNN 等需要預先安裝在所有 Node 上。為了訪問 `/usr/lib/nvidia-375`，需要將 CUDA 庫以 hostPath volume 的形式傳給容器：

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: nvidia-smi
  labels:
    name: nvidia-smi
spec:
  template:
    metadata:
      labels:
        name: nvidia-smi
    spec:
      containers:
      - name: nvidia-smi
        image: nvidia/cuda
        command: ["nvidia-smi"]
        imagePullPolicy: IfNotPresent
        resources:
          limits:
            alpha.kubernetes.io/nvidia-gpu: 1
        volumeMounts:
        - mountPath: /usr/local/nvidia/bin
          name: bin
        - mountPath: /usr/lib/nvidia
          name: lib
      volumes:
        - name: bin
          hostPath:
            path: /usr/lib/nvidia-375/bin
        - name: lib
          hostPath:
            path: /usr/lib/nvidia-375
      restartPolicy: Never
```

```sh
$ kubectl create -f job.yaml
job "nvidia-smi" created

$ kubectl get job
NAME         DESIRED   SUCCESSFUL   AGE
nvidia-smi   1         1            14m

$ kubectl get pod -a
NAME               READY     STATUS      RESTARTS   AGE
nvidia-smi-kwd2m   0/1       Completed   0          14m

$ kubectl logs nvidia-smi-kwd2m
Fri Jun 16 19:49:53 2017
+-----------------------------------------------------------------------------+
| NVIDIA-SMI 375.66                 Driver Version: 375.66                    |
|-------------------------------+----------------------+----------------------+
| GPU  Name        Persistence-M| Bus-Id        Disp.A | Volatile Uncorr. ECC |
| Fan  Temp  Perf  Pwr:Usage/Cap|         Memory-Usage | GPU-Util  Compute M. |
|===============================+======================+======================|
|   0  Tesla K80           Off  | 0000:00:04.0     Off |                    0 |
| N/A   74C    P0    80W / 149W |      0MiB / 11439MiB |    100%      Default |
+-------------------------------+----------------------+----------------------+

+-----------------------------------------------------------------------------+
| Processes:                                                       GPU Memory |
|  GPU       PID  Type  Process name                               Usage      |
|=============================================================================|
|  No running processes found                                                 |
+-----------------------------------------------------------------------------+
```

## 附錄：CUDA 安裝方法

安裝 CUDA：

```sh
# Check for CUDA and try to install.
if ! dpkg-query -W cuda; then
  # The 16.04 installer works with 16.10.
  curl -O http://developer.download.nvidia.com/compute/cuda/repos/ubuntu1604/x86_64/cuda-repo-ubuntu1604_8.0.61-1_amd64.deb
  dpkg -i ./cuda-repo-ubuntu1604_8.0.61-1_amd64.deb
  apt-get update
  apt-get install cuda -y
fi
```

安裝 cuDNN：

首先到網站 <https://developer.nvidia.com/cudnn> 註冊，並下載 cuDNN v5.1，然後運行命令安裝

```sh
tar zxvf cudnn-8.0-linux-x64-v5.1.tgz
ln -s /usr/local/cuda-8.0 /usr/local/cuda
sudo cp -P cuda/include/cudnn.h /usr/local/cuda/include
sudo cp -P cuda/lib64/libcudnn* /usr/local/cuda/lib64
sudo chmod a+r /usr/local/cuda/include/cudnn.h /usr/local/cuda/lib64/libcudnn*
```

安裝完成後，可以運行 nvidia-smi 查看 GPU 設備的狀態

```sh
$ nvidia-smi
Fri Jun 16 19:33:35 2017
+-----------------------------------------------------------------------------+
| NVIDIA-SMI 375.66                 Driver Version: 375.66                    |
|-------------------------------+----------------------+----------------------+
| GPU  Name        Persistence-M| Bus-Id        Disp.A | Volatile Uncorr. ECC |
| Fan  Temp  Perf  Pwr:Usage/Cap|         Memory-Usage | GPU-Util  Compute M. |
|===============================+======================+======================|
|   0  Tesla K80           Off  | 0000:00:04.0     Off |                    0 |
| N/A   74C    P0    80W / 149W |      0MiB / 11439MiB |    100%      Default |
+-------------------------------+----------------------+----------------------+

+-----------------------------------------------------------------------------+
| Processes:                                                       GPU Memory |
|  GPU       PID  Type  Process name                               Usage      |
|=============================================================================|
|  No running processes found                                                 |
+-----------------------------------------------------------------------------+
```

## 參考文檔

- [NVIDIA/k8s-device-plugin](https://github.com/NVIDIA/k8s-device-plugin)
- [Schedule GPUs on Kubernetes](https://kubernetes.io/docs/tasks/manage-gpus/scheduling-gpus/)
- [GoogleCloudPlatform/container-engine-accelerators](https://github.com/GoogleCloudPlatform/container-engine-accelerators)
