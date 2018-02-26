# 核心组件

![](images/components.png)

Kubernetes主要由以下几个核心组件组成:

- etcd保存了整个集群的状态；
- apiserver提供了资源操作的唯一入口，并提供认证、授权、访问控制、API注册和发现等机制；
- controller manager负责维护集群的状态，比如故障检测、自动扩展、滚动更新等；
- scheduler负责资源的调度，按照预定的调度策略将Pod调度到相应的机器上；
- kubelet负责维护容器的生命周期，同时也负责Volume（CVI）和网络（CNI）的管理；
- Container runtime负责镜像管理以及Pod和容器的真正运行（CRI）；
- kube-proxy负责为Service提供cluster内部的服务发现和负载均衡；

## 组件通信

Kubernetes多组件之间的通信原理为

- apiserver负责etcd存储的所有操作，且只有apiserver才直接操作etcd集群
- apiserver对内（集群中的其他组件）和对外（用户）提供统一的REST API，其他组件均通过apiserver进行通信
  - controller manager、scheduler、kube-proxy和kubelet等均通过apiserver watch API监测资源变化情况，并对资源作相应的操作
  - 所有需要更新资源状态的操作均通过apiserver的REST API进行
- apiserver也会直接调用kubelet API（如logs, exec, attach等），默认不校验kubelet证书，但可以通过`--kubelet-certificate-authority`开启（而GKE通过SSH隧道保护它们之间的通信）

比如典型的创建Pod的流程为

![](images/workflow.png)

1. 用户通过REST API创建一个Pod
2. apiserver将其写入etcd
3. scheduluer检测到未绑定Node的Pod，开始调度并更新Pod的Node绑定
4. kubelet检测到有新的Pod调度过来，通过container runtime运行该Pod
5. kubelet通过container runtime取到Pod状态，并更新到apiserver中

## 端口号

### Master node(s)

| Protocol | Direction | Port Range | Purpose                 |
| -------- | --------- | ---------- | ----------------------- |
| TCP      | Inbound   | 6443*      | Kubernetes API server   |
| TCP      | Inbound   | 2379-2380  | etcd server client API  |
| TCP      | Inbound   | 10250      | Kubelet API             |
| TCP      | Inbound   | 10251      | kube-scheduler          |
| TCP      | Inbound   | 10252      | kube-controller-manager |
| TCP      | Inbound   | 10255      | Read-only Kubelet API   |

### Worker node(s)

| Protocol | Direction | Port Range  | Purpose               |
| -------- | --------- | ----------- | --------------------- |
| TCP      | Inbound   | 10250       | Kubelet API           |
| TCP      | Inbound   | 10255       | Read-only Kubelet API |
| TCP      | Inbound   | 30000-32767 | NodePort Services**   |

## 参考文档

- [Master-Node communication](https://kubernetes.io/docs/concepts/architecture/master-node-communication/)
- [Core Kubernetes: Jazz Improv over Orchestration](https://blog.heptio.com/core-kubernetes-jazz-improv-over-orchestration-a7903ea92ca)
- [Installing kubeadm](https://kubernetes.io/docs/setup/independent/install-kubeadm/#check-required-ports)
