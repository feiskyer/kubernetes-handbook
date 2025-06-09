# Cloud Provider 扩展

当 Kubernetes 集群运行在云平台内部时，Cloud Provider 使得 Kubernetes 可以直接利用云平台实现持久化卷、负载均衡、网络路由、DNS 解析以及横向扩展等功能。

## 常见 Cloud Provider

Kubenretes 内置的 Cloud Provider 包括

* GCE
* AWS
* Azure
* Mesos
* OpenStack
* CloudStack
* Ovirt
* Photon
* Rackspace
* Vsphere

## 当前 Cloud Provider 工作原理

* apiserver，kubelet，controller-manager 都配置 cloud provider 选项
* Kubelet
  * 通过 Cloud Provider 接口查询 nodename
  * 向 API Server 注册 Node 时查询 InstanceID、ProviderID、ExternalID 和 Zone 等信息
  * 定期查询 Node 是否新增了 IP 地址
  * 设置无法调度的条件（condition），直到云服务商的路由配置完成
* kube-apiserver
  * 向所有 Node 分发 SSH 密钥以便建立 SSH 隧道
  * PersistentVolumeLabel 负责 PV 标签
  * PersistentVolumeClainResize 动态扩展 PV 的大小
* kube-controller-manager
  * Node 控制器检查 Node 所在 VM 的状态。当 VM 删除后自动从 API Server 中删除该 Node。
  * Volume 控制器向云提供商创建和删除持久化存储卷，并按需要挂载或卸载到指定的 VM 上。
  * Route 控制器给所有已注册的 Nodes 配置云路由。
  * Service 控制器给 LoadBalancer 类型的服务创建负载均衡器并更新服务的外网 IP。

## 独立 Cloud Provider 工作 [原理](https://kubernetes.io/docs/tasks/administer-cluster/running-cloud-controller/) 以及[跟踪进度](https://github.com/kubernetes/features/issues/88)

* Kubelet 必须配置 ``--cloud-provider=external`，并且 `kube-apiserver` 和 `kube-controller-manager` 必须不配置 cloud provider。``
* `kube-apiserver` 的准入控制选项不能包含 PersistentVolumeLabel。
* `cloud-controller-manager` 独立运行，并开启 `InitializerConifguration`。
* Kubelet 可以通过 `provider-id` 选项配置 `ExternalID`，启动后会自动给 Node 添加 taint `node.cloudprovider.kubernetes.io/uninitialized=NoSchedule`。
* `cloud-controller-manager` 在收到 Node 注册的事件后再次初始化 Node 配置，添加 zone、类型等信息，并删除上一步 Kubelet 自动创建的 taint。
* 主要逻辑（也就是合并了 kube-apiserver 和 kube-controller-manager 跟云相关的逻辑）
  * Node 控制器检查 Node 所在 VM 的状态。当 VM 删除后自动从 API Server 中删除该 Node。
  * Volume 控制器向云提供商创建和删除持久化存储卷，并按需要挂载或卸载到指定的 VM 上。
  * Route 控制器给所有已注册的 Nodes 配置云路由。
  * Service 控制器给 LoadBalancer 类型的服务创建负载均衡器并更新服务的外网 IP。
  * PersistentVolumeLabel 准入控制负责 PV 标签
  * PersistentVolumeClainResize 准入控制动态扩展 PV 大小

## Cloud Controller Manager 启动时序问题

在集群启动过程中，cloud-controller-manager 会遇到"鸡生蛋蛋生鸡"的启动时序问题：

### 问题描述

1. **节点注册问题**: kubelet 启动时向 API Server 注册 Node 对象，并添加 `node.cloudprovider.kubernetes.io/uninitialized=NoSchedule` taint
2. **调度依赖**: cloud-controller-manager 负责移除该 taint 并添加云提供商特定信息（如节点地址、标签等）
3. **启动时序矛盾**: cloud-controller-manager 本身可能因为以下原因无法正常调度：
   * 节点存在未初始化的 taint
   * 节点处于 not-ready 状态
   * 网络初始化依赖关系

### 解决方案

#### 1. 使用主机网络模式
```yaml
spec:
  hostNetwork: true
```

#### 2. 配置适当的容忍度
```yaml
tolerations:
- key: "node.cloudprovider.kubernetes.io/uninitialized"
  operator: "Exists"
  effect: "NoSchedule"
- key: "node-role.kubernetes.io/control-plane"
  operator: "Exists"
  effect: "NoSchedule"
- key: "node.kubernetes.io/not-ready"
  operator: "Exists"
  effect: "NoExecute"
  tolerationSeconds: 300
```

#### 3. 调度到控制平面节点
```yaml
nodeSelector:
  node-role.kubernetes.io/control-plane: ""
```

#### 4. 使用可扩展的资源类型
推荐使用 Deployment 或 DaemonSet 而不是静态 Pod，以确保高可用性。

#### 5. 启用 Leader Election
当运行多个副本时，启用 leader election：
```bash
--leader-elect=true
--leader-elect-lease-duration=15s
--leader-elect-renew-deadline=10s
--leader-elect-retry-period=2s
```

#### 6. 配置反亲和性
防止多个控制器实例调度到同一主机：
```yaml
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      podAffinityTerm:
        labelSelector:
          matchLabels:
            component: cloud-controller-manager
        topologyKey: kubernetes.io/hostname
```

### 最佳实践配置示例

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cloud-controller-manager
  namespace: kube-system
spec:
  replicas: 2
  selector:
    matchLabels:
      component: cloud-controller-manager
  template:
    metadata:
      labels:
        component: cloud-controller-manager
    spec:
      hostNetwork: true
      nodeSelector:
        node-role.kubernetes.io/control-plane: ""
      tolerations:
      - key: "node.cloudprovider.kubernetes.io/uninitialized"
        operator: "Exists"
        effect: "NoSchedule"
      - key: "node-role.kubernetes.io/control-plane"
        operator: "Exists"
        effect: "NoSchedule"
      - key: "node.kubernetes.io/not-ready"
        operator: "Exists"
        effect: "NoExecute"
        tolerationSeconds: 300
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchLabels:
                  component: cloud-controller-manager
              topologyKey: kubernetes.io/hostname
      containers:
      - name: cloud-controller-manager
        image: your-cloud-provider/cloud-controller-manager:latest
        command:
        - /cloud-controller-manager
        - --leader-elect=true
        - --cloud-provider=your-provider
        - --use-service-account-credentials=true
```

## 如何开发 Cloud Provider 扩展

Kubernetes 的 Cloud Provider 目前正在重构中

* v1.6 添加了独立的 `cloud-controller-manager` 服务，云提供商可以构建自己的 `cloud-controller-manager` 而无须修改 Kubernetes 核心代码
* v1.7-v1.10 进一步重构 `cloud-controller-manager`，解耦了 Controller Manager 与 Cloud Controller 的代码逻辑
* v1.11 External Cloud Provider 升级为 Beta 版

构建一个新的云提供商的 Cloud Provider 步骤为

* 编写实现 [cloudprovider.Interface](https://github.com/kubernetes/cloud-provider/blob/master/cloud.go) 的 cloudprovider 代码
* 将该 cloudprovider 链接到 `cloud-controller-manager`
  * 在 `cloud-controller-manager` 中导入新的 cloudprovider：`import "pkg/new-cloud-provider"`
  * 初始化时传入新 cloudprovider 的名字，如 `cloudprovider.InitCloudProvider("rancher", s.CloudConfigFile)`
* 配置 kube-controller-manager `--cloud-provider=external`
* 启动 `cloud-controller-manager`

具体实现方法可以参考 [rancher-cloud-controller-manager](https://github.com/rancher/rancher-cloud-controller-manager) 和 [cloud-controller-manager](https://github.com/kubernetes/cloud-provider)。
