# GPU

Kubernetes支持容器请求GPU资源（目前仅支持NVIDIA GPU），在深度学习等场景中有大量应用。

在Kubernetes中使用GPU需要预先配置

- 在所有的Node上安装Nvidia驱动，包括NVIDIA Cuda Toolkit和cuDNN等
- 在apiserver和kubelet上开启`--feature-gates="Accelerators=true"`
- Kubelet配置使用docker容器引擎（默认就是docker），其他容器引擎暂不支持该特性

## 使用方法

使用资源名`alpha.kubernetes.io/nvidia-gpu`指定请求GPU的个数，如

```yaml
apiVersion: v1
kind: pod
spec:
  containers:
    - image: gcr.io/tensorflow/tensorflow:latest-gpu
      name: gpu-container-1
      command: ["python"]
      args: ["-u", "-c", "import tensorflow"]
      resources: 
        limits: 
          alpha.kubernetes.io/nvidia-gpu: 2 # requesting 2 GPUs
```

注意

- GPU资源必须在`resources.limits`中请求，`resources.requests`中无效
- 容器可以请求1个或多个GPU，不能只请求一部分
- 多个容器之间不能共享GPU
- 默认假设所有Node安装了相同型号的GPU

## 多种型号的GPU

如果集群Node中安装了多种型号的GPU，则可以使用Node Affinity来调度Pod到指定GPU型号的Node上。

首先，在集群初始化时，需要给Node打上GPU型号的标签

```sh
NVIDIA_GPU_NAME=$(nvidia-smi --query-gpu=gpu_name --format=csv,noheader --id=0)
source /etc/default/kubelet
KUBELET_OPTS="$KUBELET_OPTS --node-labels='alpha.kubernetes.io/nvidia-gpu-name=$NVIDIA_GPU_NAME'"
echo "KUBELET_OPTS=$KUBELET_OPTS" > /etc/default/kubelet
```

然后，在创建Pod时设置Node Affinity

```yaml
kind: pod
apiVersion: v1
metadata:
  annotations:
    scheduler.alpha.kubernetes.io/affinity: >
      {
        "nodeAffinity": {
          "requiredDuringSchedulingIgnoredDuringExecution": {
            "nodeSelectorTerms": [
              {
                "matchExpressions": [
                  {
                    "key": "alpha.kubernetes.io/nvidia-gpu-name",
                    "operator": "In",
                    "values": ["Tesla K80", "Tesla P100"]
                  }
                ]
              }
            ]
          }
        }
      }
spec:
  containers:
    - image: gcr.io/tensorflow/tensorflow:latest-gpu
      name: gpu-container-1
      command: ["python"]
      args: ["-u", "-c", "import tensorflow"]
      resources:
        limits:
          alpha.kubernetes.io/nvidia-gpu: 2
```

## 使用CUDA库

NVIDIA Cuda Toolkit和cuDNN等需要预先安装在所有Node上。为了访问`/usr/lib/nvidia-367`，容器需要运行在特权模式，并将CUDA库以hostPath Volume的形式传给容器。

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
        command: [ "nvidia-smi" ]
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

## 附录：CUDA安装方法

安装CUDA：

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

安装cuDNN：

首先到网站<https://developer.nvidia.com/cudnn>注册，并下载cuDNN v5.1，然后

```sh
tar xvzf cudnn-8.0-linux-x64-v5.1-ga.tgz
sudo cp -P cuda/include/cudnn.h /usr/local/cuda/include
sudo cp -P cuda/lib64/libcudnn* /usr/local/cuda/lib64
sudo chmod a+r /usr/local/cuda/include/cudnn.h /usr/local/cuda/lib64/libcudnn*
```
