# Prometheus

```sh
helm repo add coreos https://s3-eu-west-1.amazonaws.com/coreos-charts/stable/
helm install coreos/prometheus-operator --name prometheus-operator --namespace monitoring
helm install coreos/kube-prometheus --name kube-prometheus --namespace monitoring
```

如果發現 exporter-kubelets 功能不正常，比如報 `server returned HTTP status 401 Unauthorized` 錯誤，則需要給 Kubelet 配置 webhook 認證：

```sh
kubelet --authentication-token-webhook=true --authorization-mode=Webhook
```

如果發現 K8SControllerManagerDown 和 K8SSchedulerDown 告警，則說明 kube-controller-manager 和 kube-scheduler 是以 Pod 的形式運行在集群中的，並且 prometheus 部署的監控服務與它們的標籤不一致。可通過修改服務標籤的方法解決，如

```
kubectl -n kube-system set selector service kube-prometheus-exporter-kube-controller-manager  component=kube-controller-manager
kubectl -n kube-system set selector service kube-prometheus-exporter-kube-scheduler  component=kube-scheduler
```

## Ingress

```
kubectl apply -f .
```

