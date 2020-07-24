# 应用高可用

## 应用高可用的一般原则

* 应用遵循 [The Twelve-Factor App](https://12factor.net/zh_cn/)
* 使用 Service 和多副本 Pod 部署应用
* 多副本通过反亲和性避免单节点故障导致应用异常
* 使用 PodDisruptionBudget 避免驱逐导致的应用不可用
* 使用 preStopHook 和健康检查探针保证服务平滑更新

## 优雅关闭

为 Pod 配置 terminationGracePeriodSeconds，并通过 preStop 钩子延迟关闭容器应用以避免 `kubectl drain` 等事件发生时导致的应用中断：

```yaml
restartPolicy: Always
terminationGracePeriodSeconds: 30
containers:
- image: nginx
  lifecycle:
    preStop:
      exec:
        command: [
          "sh", "-c",
          # Introduce a delay to the shutdown sequence to wait for the
          # pod eviction event to propagate. Then, gracefully shutdown
          # nginx.
          "sleep 5 && /usr/sbin/nginx -s quit",
        ]
```

详细的原理可以参考下面这个系列文章

* [1. Zero Downtime Server Updates For Your Kubernetes Cluster](https://blog.gruntwork.io/zero-downtime-server-updates-for-your-kubernetes-cluster-902009df5b33)

* [2. Gracefully Shutting Down Pods in a Kubernetes Cluster](https://blog.gruntwork.io/gracefully-shutting-down-pods-in-a-kubernetes-cluster-328aecec90d)
* [3. Delaying Shutdown to Wait for Pod Deletion Propagation](https://blog.gruntwork.io/delaying-shutdown-to-wait-for-pod-deletion-propagation-445f779a8304)

* [4. Avoiding Outages in your Kubernetes Cluster using PodDisruptionBudgets](https://blog.gruntwork.io/avoiding-outages-in-your-kubernetes-cluster-using-poddisruptionbudgets-ef6a4baa5085)



## 参考文档

* [Kubernetes Pod Lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)
* [Kubernetes PodDisruptionBudget](https://kubernetes.io/docs/concepts/workloads/pods/disruptions/)

