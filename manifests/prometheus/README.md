# Prometheus

```sh
helm repo add coreos https://s3-eu-west-1.amazonaws.com/coreos-charts/stable/
helm install coreos/prometheus-operator --name prometheus-operator --namespace monitoring
helm install coreos/kube-prometheus --name kube-prometheus --namespace monitoring
```

如果发现 exporter-kubelets 功能不正常，比如报 `server returned HTTP status 401 Unauthorized` 错误，则需要给 Kubelet 配置 webhook 认证：

```sh
kubelet --authentication-token-webhook=true --authorization-mode=Webhook
```

如果发现 K8SControllerManagerDown 和 K8SSchedulerDown 告警，则说明 kube-controller-manager 和 kube-scheduler 是以 Pod 的形式运行在集群中的，并且 prometheus 部署的监控服务与它们的标签不一致。可通过修改服务标签的方法解决，如

```
kubectl -n kube-system set selector service kube-prometheus-exporter-kube-controller-manager  component=kube-controller-manager
kubectl -n kube-system set selector service kube-prometheus-exporter-kube-scheduler  component=kube-scheduler
```

## Ingress

```
kubectl apply -f .
```

