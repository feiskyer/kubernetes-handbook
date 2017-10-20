# Cluster AutoScaler

Cluster AutoScaler 是一个自动扩展和收缩 Kubernetes 集群 Node 的扩展。当集群容量不足时，它会自动去 Cloud Provider （支持 GCE、GKE和AWS）创建新的 Node，而在 Node 长时间资源利用率都很低时自动将其删除以节省开支。

Cluster AutoScaler 独立于 Kubernetes 主代码库，维护在 <https://github.com/kubernetes/autoscaler>。

## 部署

Cluster AutoScaler v1.0.0 可以基于Docker镜像 `gcr.io/google_containers/cluster-autoscaler:v1.0.0` 来部署，详细的部署步骤可以参考

- GCE: <https://kubernetes.io/docs/concepts/cluster-administration/cluster-management/>
- GKE: <https://cloud.google.com/container-engine/docs/cluster-autoscaler>
- AWS: <https://github.com/kubernetes/autoscaler/blob/master/cluster-autoscaler/cloudprovider/aws/README.md>

## 工作原理

Cluster AutoScaler 定期（默认间隔10s）检测是否有充足的资源来调度新创建的 Pod，当资源不足时会调用 Cloud Provider 创建新的 Node。

![](images/15084813044270.png)

Cluster AutoScaler 也会定期（默认间隔10s）自动监测 Node 的资源使用情况，当一个 Node 长时间资源利用率都很低时（低于50%）自动将其删除。此时，原来的 Pod 会自动调度到其他 Node 上面（通过Deployment、StatefulSet等控制器）。

![](images/15084813160226.png)

用户在启动 Cluster AutoScaler 时可以配置 Node 数量的范围（包括最大Node数和最小Node数）。

在使用 Cluster AutoScaler 时需要注意：

- 由于在删除 Node 时会发生 Pod 重新调度的情况，所以应用必须可以容忍重新调度和短时的中断（比如使用多副本的Deployment）
- 当 Node 上面的 [Pods 满足下面的条件之一](https://github.com/kubernetes/autoscaler/blob/master/cluster-autoscaler/FAQ.md#what-types-of-pods-can-prevent-ca-from-removing-a-node)时，Node不会删除
  - Pod 配置了PodDisruptionBudget (PDB)
  - kube-system Pod 默认不在Node上运行或者未配置PDB
  - Pod 不是通过deployment, replica set, job, stateful set等控制器创建的
  - Pod 使用了本地存储
  - 其他原因导致的Pod 无法重新调度，如资源不足，其他Node无法满足NodeSelector或Affinity等

## 最佳实践

- Cluster AutoScaler 可以和 Horizontal Pod Autoscaler（HPA）配合使用
- 不要手动修改 Node 配置，保证集群内的所有 Node 有相同的配置并属于同一个Node组
- 运行 Pod 时指定资源请求
- 必要时使用 PodDisruptionBudgets 阻止 Pod 被误删除
- 确保云服务商的配额充足
- Cluster AutoScaler 与云服务商提供的 Node 自动扩展功能以及基于CPU利用率的Node自动扩展机制冲突，不要同时启用

## 参考文档

- [Kubernetes Autoscaler](https://github.com/kubernetes/autoscaler)
- [Kubernetes Cluster AutoScaler Support](http://blog.spotinst.com/2017/06/14/k8-autoscaler-support/)


