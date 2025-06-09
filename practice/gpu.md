# GPU

Kubernetes 支持容器请求 GPU 资源（目前仅支持 NVIDIA GPU），在深度学习等场景中有大量应用。

## 使用方法

### Kubernetes v1.8 及更新版本

从 Kubernetes v1.8 开始，GPU 开始以 DevicePlugin 的形式实现。在使用之前需要配置

* kubelet/kube-apiserver/kube-controller-manager: `--feature-gates="DevicePlugins=true"`
* 在所有的 Node 上安装 Nvidia 驱动，包括 NVIDIA Cuda Toolkit 和 cuDNN 等
* Kubelet 配置使用 docker 容器引擎（默认就是 docker），其他容器引擎暂不支持该特性

#### NVIDIA 插件

NVIDIA 需要 nvidia-docker。

安装 [nvidia-docker](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html#docker):

```bash
# Install docker-ce
curl https://get.docker.com | sh \
  && sudo systemctl --now enable docker

# Add the package repositories
distribution=$(. /etc/os-release;echo $ID$VERSION_ID) \
      && curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg \
      && curl -s -L https://nvidia.github.io/libnvidia-container/experimental/$distribution/libnvidia-container.list | \
         sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
         sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

# Install nvidia-docker2 and reload the Docker daemon configuration
sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker

# Test nvidia-smi with the latest official CUDA image
sudo docker run --rm --gpus all nvidia/cuda:11.6.2-base-ubuntu20.04 nvidia-smi
```

部署 NVDIA 设备插件

```bash
kubectl create -f https://raw.githubusercontent.com/NVIDIA/k8s-device-plugin/v0.13.0/nvidia-device-plugin.yml
```

#### GCE/GKE GPU 插件

该插件不需要 nvidia-docker，并且也支持 CRI 容器运行时。

```bash
# Install NVIDIA drivers on Container-Optimized OS:
kubectl create -f https://github.com/GoogleCloudPlatform/container-engine-accelerators/raw/master/daemonset.yaml

# Install NVIDIA drivers on Ubuntu (experimental):
kubectl create -f https://github.com/GoogleCloudPlatform/container-engine-accelerators/raw/master/nvidia-driver-installer/ubuntu/daemonset.yaml

# Install the device plugin:
kubectl create -f https://github.com/kubernetes/kubernetes/raw/master/cluster/addons/device-plugins/nvidia-gpu/daemonset.yaml
```

### NVIDIA GPU Operator

[Nvidia GPU Operator](https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/getting-started.html#install-nvidia-gpu-operator) 是一个 Kubernetes Operator，用于在 Kubernetes 集群中部署和管理 Nvidia GPU。

```sh
helm install --wait --generate-name \
     -n gpu-operator --create-namespace \
     nvidia/gpu-operator
```

#### 请求 `nvidia.com/gpu` 资源示例

```sh
$ cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: gpu-pod
spec:
  restartPolicy: Never
  containers:
    - name: cuda-container
      image: nvcr.io/nvidia/k8s/cuda-sample:vectoradd-cuda10.2
      resources:
        limits:
          nvidia.com/gpu: 1 # requesting 1 GPU
  tolerations:
  - key: nvidia.com/gpu
    operator: Exists
    effect: NoSchedule
EOF
```

### Kubernetes v1.6 和 v1.7

> `alpha.kubernetes.io/nvidia-gpu` 已在 v1.10 中删除，新版本请使用 `nvidia.com/gpu`。

在 Kubernetes v1.6 和 v1.7 中使用 GPU 需要预先配置

* 在所有的 Node 上安装 Nvidia 驱动，包括 NVIDIA Cuda Toolkit 和 cuDNN 等
* 在 apiserver 和 kubelet 上开启 `--feature-gates="Accelerators=true"`
* Kubelet 配置使用 docker 容器引擎（默认就是 docker），其他容器引擎暂不支持该特性

使用资源名 `alpha.kubernetes.io/nvidia-gpu` 指定请求 GPU 的个数，如

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

```bash
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

* GPU 资源必须在 `resources.limits` 中请求，`resources.requests` 中无效
* 容器可以请求 1 个或多个 GPU，不能只请求一部分
* 多个容器之间不能共享 GPU
* 默认假设所有 Node 安装了相同型号的 GPU

## Dynamic Resource Allocation (DRA) 方式使用 GPU

从 Kubernetes v1.26 开始，可以使用 DRA 方式来管理 GPU 资源，相比传统的 Device Plugin 方式，DRA 提供了更灵活的 GPU 分配和管理能力。

### DRA GPU 配置

#### 1. 创建 GPU ResourceClass

```yaml
apiVersion: resource.k8s.io/v1alpha2
kind: ResourceClass
metadata:
  name: nvidia-gpu-class
spec:
  driverName: gpu.nvidia.com
  parameters:
    # GPU 内存大小
    memory: "16Gi"
    # 计算能力
    compute: "7.5"
    # v1.33 新特性：支持 GPU 分区
    partitionable: true
    maxPartitions: 7  # MIG 分区数
    # 支持的 CUDA 版本
    cudaVersion: "12.0"
---
# 用于 AI/ML 工作负载的高性能 GPU 类
apiVersion: resource.k8s.io/v1alpha2
kind: ResourceClass
metadata:
  name: high-perf-gpu-class
spec:
  driverName: gpu.nvidia.com
  parameters:
    memory: "80Gi"      # A100 GPU
    compute: "8.0"
    tensorCores: true
    nvlink: true
---
# 共享 GPU 资源类
apiVersion: resource.k8s.io/v1alpha2
kind: ResourceClass
metadata:
  name: shared-gpu-class
spec:
  driverName: gpu.nvidia.com
  parameters:
    shared: true
    maxUsers: 4
    timeSlicing: true
```

#### 2. 创建 GPU ResourceClaim

```yaml
# 独占 GPU 资源声明
apiVersion: resource.k8s.io/v1alpha2
kind: ResourceClaim
metadata:
  name: exclusive-gpu-claim
  namespace: ml-training
spec:
  resourceClassName: nvidia-gpu-class
  allocationMode: WaitForFirstConsumer
---
# v1.33 特性：优先级列表 - 尝试多种 GPU 类型
apiVersion: resource.k8s.io/v1alpha2
kind: ResourceClaim
metadata:
  name: flexible-gpu-claim
  namespace: ml-training
spec:
  # 按优先级尝试不同的 GPU 类型
  resourceClassNames:
  - high-perf-gpu-class   # 优先使用高性能 GPU
  - nvidia-gpu-class      # 备选标准 GPU
  - shared-gpu-class      # 最后尝试共享 GPU
  allocationMode: WaitForFirstConsumer
```

#### 3. 使用 DRA GPU 的 Pod

```yaml
# 机器学习训练任务
apiVersion: v1
kind: Pod
metadata:
  name: ml-training-pod
  namespace: ml-training
spec:
  containers:
  - name: trainer
    image: tensorflow/tensorflow:latest-gpu
    command: ["python", "train.py"]
    env:
    - name: NVIDIA_VISIBLE_DEVICES
      value: "all"
    resources:
      claims:
      - name: gpu-resource
      limits:
        memory: "32Gi"
        cpu: "8"
  resourceClaims:
  - name: gpu-resource
    source:
      resourceClaimName: exclusive-gpu-claim
---
# 推理服务使用共享 GPU
apiVersion: v1
kind: Pod
metadata:
  name: inference-pod
  namespace: ml-inference
spec:
  containers:
  - name: inference-server
    image: tensorrt-inference:latest
    ports:
    - containerPort: 8080
    resources:
      claims:
      - name: shared-gpu
      limits:
        memory: "4Gi"
        cpu: "2"
  resourceClaims:
  - name: shared-gpu
    source:
      resourceClaimName: shared-gpu-claim
```

### v1.33 DRA GPU 新特性

#### 1. GPU 分区（MIG 支持）

```yaml
# 支持 NVIDIA MIG 分区的 ResourceClass
apiVersion: resource.k8s.io/v1alpha2
kind: ResourceClass
metadata:
  name: mig-gpu-class
spec:
  driverName: gpu.nvidia.com
  parameters:
    # MIG 配置
    migEnabled: true
    migProfile: "1g.5gb"  # 1/7 GPU + 5GB 内存
    partitionable: true
---
# 请求 MIG 分区的 Pod
apiVersion: v1
kind: Pod
metadata:
  name: mig-workload
spec:
  containers:
  - name: light-ml-task
    image: pytorch/pytorch:latest
    resources:
      claims:
      - name: mig-partition
  resourceClaims:
  - name: mig-partition
    source:
      resourceClaimName: mig-gpu-claim
```

#### 2. GPU 污点和容忍度

```yaml
# 将 GPU 标记为维护状态
apiVersion: resource.k8s.io/v1alpha2
kind: ResourceSlice
metadata:
  name: gpu-node-maintenance
spec:
  driverName: gpu.nvidia.com
  devices:
  - name: gpu-0
    basic:
      capacity:
        memory: "16Gi"
    # GPU 污点：标记为维护状态
    taints:
    - key: "maintenance"
      value: "scheduled"
      effect: "NoSchedule"
    - key: "thermal-throttling"
      value: "detected"
      effect: "PreferNoSchedule"
---
# 容忍 GPU 污点的 Pod
apiVersion: v1
kind: Pod
metadata:
  name: maintenance-tolerant-gpu-pod
spec:
  containers:
  - name: monitoring-task
    image: gpu-monitor:latest
    resources:
      claims:
      - name: gpu-resource
  resourceClaims:
  - name: gpu-resource
    source:
      resourceClaimName: maintenance-gpu-claim
  # 容忍 GPU 设备污点
  tolerations:
  - key: "resource.kubernetes.io/device.maintenance"
    operator: "Equal"
    value: "scheduled"
    effect: "NoSchedule"
  - key: "resource.kubernetes.io/device.thermal-throttling"
    operator: "Equal"
    value: "detected"
    effect: "PreferNoSchedule"
```

#### 3. 管理员访问控制

```yaml
# 启用 DRA 管理访问的命名空间
apiVersion: v1
kind: Namespace
metadata:
  name: gpu-admin-namespace
  labels:
    # v1.33 特性：管理员访问标签
    resource.kubernetes.io/admin-access: "enabled"
---
# 只有管理员命名空间才能创建的 ResourceClaim
apiVersion: resource.k8s.io/v1alpha2
kind: ResourceClaim
metadata:
  name: admin-gpu-claim
  namespace: gpu-admin-namespace
spec:
  resourceClassName: high-perf-gpu-class
  # 管理员级别的配置
  parameters:
    # 允许超额分配
    overcommit: true
    # 强制亲和性
    requiredNodeAffinity:
      nodeSelectorTerms:
      - matchExpressions:
        - key: gpu.nvidia.com/class
          operator: In
          values: ["A100", "H100"]
```

### DRA GPU 监控和调试

```yaml
# GPU 使用情况监控 Pod
apiVersion: v1
kind: Pod
metadata:
  name: gpu-monitor
spec:
  containers:
  - name: nvidia-smi-exporter
    image: mindprince/nvidia_gpu_prometheus_exporter:0.1
    ports:
    - containerPort: 9445
      name: metrics
    securityContext:
      capabilities:
        add: ["SYS_ADMIN"]
    volumeMounts:
    - name: dev
      mountPath: /dev
    - name: proc-driver-nvidia
      mountPath: /proc/driver/nvidia
      readOnly: true
    resources:
      claims:
      - name: monitor-gpu
  resourceClaims:
  - name: monitor-gpu
    source:
      resourceClaimName: monitoring-gpu-claim
  volumes:
  - name: dev
    hostPath:
      path: /dev
  - name: proc-driver-nvidia
    hostPath:
      path: /proc/driver/nvidia
```

## 多种型号的 GPU

如果集群 Node 中安装了多种型号的 GPU，则可以使用 Node Affinity 来调度 Pod 到指定 GPU 型号的 Node 上。

首先，在集群初始化时，需要给 Node 打上 GPU 型号的标签

```bash
# Label your nodes with the accelerator type they have.
kubectl label nodes <node-with-k80> accelerator=nvidia-tesla-k80
kubectl label nodes <node-with-p100> accelerator=nvidia-tesla-p100
```

然后，在创建 Pod 时设置 Node Affinity：

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

## 使用 CUDA 库

NVIDIA Cuda Toolkit 和 cuDNN 等需要预先安装在所有 Node 上。为了访问 `/usr/lib/nvidia-375`，需要将 CUDA 库以 hostPath volume 的形式传给容器：

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

```bash
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

## 附录：CUDA 安装方法

安装 CUDA：

```bash
# Check for CUDA and try to install.
if ! dpkg-query -W cuda; then
  # The 16.04 installer works with 16.10.
  curl -O http://developer.download.nvidia.com/compute/cuda/repos/ubuntu1604/x86_64/cuda-repo-ubuntu1604_8.0.61-1_amd64.deb
  dpkg -i ./cuda-repo-ubuntu1604_8.0.61-1_amd64.deb
  apt-get update
  apt-get install cuda -y
fi
```

安装 cuDNN：

首先到网站 [https://developer.nvidia.com/cudnn](https://developer.nvidia.com/cudnn) 注册，并下载 cuDNN v5.1，然后运行命令安装

```bash
tar zxvf cudnn-8.0-linux-x64-v5.1.tgz
ln -s /usr/local/cuda-8.0 /usr/local/cuda
sudo cp -P cuda/include/cudnn.h /usr/local/cuda/include
sudo cp -P cuda/lib64/libcudnn* /usr/local/cuda/lib64
sudo chmod a+r /usr/local/cuda/include/cudnn.h /usr/local/cuda/lib64/libcudnn*
```

安装完成后，可以运行 nvidia-smi 查看 GPU 设备的状态

```bash
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

## AI/ML 推理工作负载的网关管理

对于运行在 GPU 上的 AI/ML 推理服务，可以使用 Gateway API Inference Extension 来进行智能路由和负载平衡。

### Gateway API Inference Extension 配置

```yaml
# 定义 GPU 推理服务池
apiVersion: gateway.networking.x-k8s.io/v1alpha1
kind: InferencePool
metadata:
  name: llama2-gpu-pool
spec:
  deployment:
    replicas: 3
    template:
      spec:
        containers:
        - name: vllm-server
          image: vllm/vllm-openai:latest
          resources:
            limits:
              nvidia.com/gpu: 1
              memory: "16Gi"
              cpu: "4"
            requests:
              memory: "8Gi"
              cpu: "2"
          env:
          - name: MODEL_NAME
            value: "meta-llama/Llama-2-7b-chat-hf"
          - name: GPU_MEMORY_UTILIZATION
            value: "0.9"
        nodeSelector:
          accelerator: nvidia-tesla-v100
---
# 定义模型端点
apiVersion: gateway.networking.x-k8s.io/v1alpha1
kind: InferenceModel
metadata:
  name: llama2-7b-chat
spec:
  poolRef:
    name: llama2-gpu-pool
  routing:
    # 优先级路由：高优先级请求优先分配
    priority: high
    # 智能负载平衡：基于 GPU 利用率
    loadBalancing:
      strategy: gpu-aware
      metrics:
      - name: gpu_utilization
        target: 80
      - name: memory_utilization  
        target: 85
    # 金丝雀发布
    trafficSplit:
    - weight: 90
      version: stable
      poolRef:
        name: llama2-gpu-pool
    - weight: 10
      version: canary
      poolRef:
        name: llama2-gpu-pool-canary
---
# Gateway 配置
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: ai-inference-gateway
spec:
  gatewayClassName: inference-gateway-class
  listeners:
  - name: https
    port: 443
    protocol: HTTPS
    tls:
      mode: Terminate
      certificateRefs:
      - name: inference-tls-cert
---
# HTTPRoute 将请求路由到推理模型
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: llama2-inference-route
spec:
  parentRefs:
  - name: ai-inference-gateway
  hostnames:
  - "api.ai-platform.example.com"
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /v1/chat/completions
    - headers:
      - name: x-model-name
        value: llama2-7b-chat
    backendRefs:
    - group: gateway.networking.x-k8s.io
      kind: InferenceModel
      name: llama2-7b-chat
    filters:
    # 基于请求优先级的路由
    - type: ExtensionRef
      extensionRef:
        group: gateway.networking.x-k8s.io
        kind: PriorityFilter
        name: inference-priority
```

### 性能优势

使用 Gateway API Inference Extension 管理 GPU 推理工作负载具有以下优势：

- **智能路由**：基于 GPU 利用率、内存使用情况等实时指标进行路由决策
- **降低延迟**：特别是在高查询率下，延迟显著降低
- **提高 GPU 利用率**：更有效的资源分配和负载平衡
- **支持模型版本管理**：安全的金丝雀发布和 A/B 测试
- **请求优先级**：重要请求可以获得优先处理

### 监控 GPU 推理服务

```yaml
# GPU 推理服务监控 ServiceMonitor
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: inference-gpu-metrics
spec:
  selector:
    matchLabels:
      app: inference-model
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
```

## 参考文档

* [NVIDIA/k8s-device-plugin](https://github.com/NVIDIA/k8s-device-plugin)
* [Schedule GPUs on Kubernetes](https://kubernetes.io/docs/tasks/manage-gpus/scheduling-gpus/)
* [GoogleCloudPlatform/container-engine-accelerators](https://github.com/GoogleCloudPlatform/container-engine-accelerators)
* [Gateway API Inference Extension](https://kubernetes.io/blog/2025/06/05/introducing-gateway-api-inference-extension/)
