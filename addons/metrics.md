# Metrics

从v1.8开始，资源使用情况的度量（如容器的CPU和内存使用）可以通过Metrics API获取。注意

- Metrics API只可以查询当前的度量数据，并不保存历史数据
- Metrics API URI为 `/apis/metrics.k8s.io/`，在 [k8s.io/metrics](https://github.com/kubernetes/metrics) 维护
- 必须部署metrics-server才能使用该API，metrics-server通过调用Kubelet Summary API获取数据

## 部署metrics-server

```sh
$ git clone https://github.com/kubernetes-incubator/metrics-server
$ cd metrics-server
$ kubectl create -f deploy/
```

## 参考文档

- [Core metrics pipeline](https://kubernetes.io/docs/tasks/debug-application-cluster/core-metrics-pipeline/)
- [metrics-server](https://github.com/kubernetes-incubator/metrics-server)