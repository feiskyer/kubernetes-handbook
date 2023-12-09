# Unleashing GPU Power in Kubernetes

Kubernetes has robust support for provisioning GPU resources (currently limited to NVIDIA GPUs), which is an invaluable asset for compute-intensive tasks such as deep learning.

## How to Access GPU Resources

### For Kubernetes v1.8 and Above

Starting from Kubernetes v1.8, GPU support is facilitated through the DevicePlugin feature. Prior configuration includes:

* Enabling the flag on kubelet/kube-apiserver/kube-controller-manager: `--feature-gates="DevicePlugins=true"`
* Installing Nvidia drivers on all Nodes, including NVIDIA Cuda Toolkit and cuDNN
* Configuring Kubelet to utilize the docker container engine (which is the default setting); other engines are not yet compatible with this feature.

#### NVIDIA Plugin

NVIDIA requires nvidia-docker for operation.

Install [nvidia-docker](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html#docker):

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

Deploy NVDIA device plugin on your cluster:

```bash
kubectl create -f https://raw.githubusercontent.com/NVIDIA/k8s-device-plugin/v0.13.0/nvidia-device-plugin.yml
```

#### GCE/GKE GPU Plugin

This plugin operates without the need for nvidia-docker and also supports CRI container runtime.

```bash
# Install NVIDIA drivers on Container-Optimized OS:
kubectl create -f https://github.com/GoogleCloudPlatform/container-engine-accelerators/raw/master/daemonset.yaml

# Install NVIDIA drivers on Ubuntu (experimental):
kubectl create -f https://github.com/GoogleCloudPlatform/container-engine-accelerators/raw/master/nvidia-driver-installer/ubuntu/daemonset.yaml

# Install the device plugin:
kubectl create -f https://github.com/kubernetes/kubernetes/raw/master/cluster/addons/device-plugins/nvidia-gpu/daemonset.yaml
```

### NVIDIA GPU Operator

The [Nvidia GPU Operator](https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/getting-started.html#install-nvidia-gpu-operator) simplifies the process of managing Nvidia GPUs in Kubernetes clusters.

```sh
helm install --wait --generate-name \
     -n gpu-operator --create-namespace \
     nvidia/gpu-operator
```

#### Sample Request for `nvidia.com/gpu` resource

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

### Kubernetes v1.6 and v1.7

> The `alpha.kubernetes.io/nvidia-gpu` has been removed in v1.10; use `nvidia.com/gpu` in newer versions.

For Kubernetes v1.6 and v1.7, it is necessary to install Nvidia drivers on all Nodes, enable `--feature-gates="Accelerators=true"` on apiserver and kubelet, and ensure kubelet is configured to use docker as the container engine.

The following is how you would specify the number of GPUs using the resource name `alpha.kubernetes.io/nvidia-gpu`:

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

Note:

* GPU resources must be requested within `resources.limits`, and `resources.requests` are ineffective.
* Containers can request either one or multiple GPUs, but not a fraction.
* GPUs cannot be shared between containers.
* The assumption is that all Nodes have the same model of GPUs installed.

## Handling Multiple GPU Models

If the cluster has Nodes with different GPU models, Node Affinity can be used to schedule Pods to Nodes with specific GPU models:

First, at cluster setup, label the Nodes with the appropriate GPU model:

```bash
# Label your nodes with the accelerator type they have.
kubectl label nodes <node-with-k80> accelerator=nvidia-tesla-k80
kubectl label nodes <node-with-p100> accelerator=nvidia-tesla-p100
```

Then, set Node Affinity when creating the Pod:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: cuda-vector-add
spec:
  restartPolicy: OnFailure
  containers:
    - name: cuda-vector-add
      image: "k8s.gcr.io/cuda-vector-add:v0.1"
      resources:
        limits:
          nvidia.com/gpu: 1
  nodeSelector:
    accelerator: nvidia-tesla-p100 # or nvidia-tesla-k80 etc.
```

## Utilizing CUDA Libraries

The NVIDIA Cuda Toolkit and cuDNN must be pre-installed on all Nodes. To access the `/usr/lib/nvidia-375`, pass the CUDA libraries to the container as hostPath volumes:

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
...
```

## Appendix: Installing CUDA

Installing CUDA:

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

Installing cuDNN:

Go to the website [https://developer.nvidia.com/cudnn](https://developer.nvidia.com/cudnn) to register and download cuDNN v5.1, then follow these commands to install:

```bash
tar zxvf cudnn-8.0-linux-x64-v5.1.tgz
ln -s /usr/local/cuda-8.0 /usr/local/cuda
sudo cp -P cuda/include/cudnn.h /usr/local/cuda/include
sudo cp -P cuda/lib64/libcudnn* /usr/local/cuda/lib64
sudo chmod a+r /usr/local/cuda/include/cudnn.h /usr/local/cuda/lib64/libcudnn*
```

After installation, you can check the GPU status with nvidia-smi:

```bash
$ nvidia-smi
...
```

## References

* [NVIDIA/k8s-device-plugin](https://github.com/NVIDIA/k8s-device-plugin)
* [Schedule GPUs on Kubernetes](https://kubernetes.io/docs/tasks/manage-gpus/scheduling-gpus/)
* [GoogleCloudPlatform/container-engine-accelerators](https://github.com/GoogleCloudPlatform/container-engine-accelerators)