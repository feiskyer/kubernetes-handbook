# Controller Manager

Controller Manager由kube-controller-manager和cloud-controller-manager组成，是Kubernetes的大脑，它通过apiserver监控整个集群的状态，并确保集群处于预期的工作状态。

kube-controller-manager由一系列的控制器组成

- Replication Controller
- Node Controller
- CronJob Controller
- Daemon Controller
- Deployment Controller
- Endpoint Controller
- Garbage Collector
- Namespace Controller
- Job Controller
- Pod AutoScaler
- RelicaSet
- Service Controller
- ServiceAccount Controller
- StatefulSet Controller
- Volume Controller
- Resource quota Controller

cloud-controller-manager在Kubernetes启用Cloud Provider的时候才需要，用来配合云服务提供商的控制，也包括一系列的控制器

- Node Controller
- Route Controller
- Service Controller


## kube-controller-manager启动示例

```sh
kube-controller-manager --enable-dynamic-provisioning=true \
    --feature-gates=AllAlpha=true \
    --horizontal-pod-autoscaler-sync-period=10s \
    --horizontal-pod-autoscaler-use-rest-clients=true \
    --node-monitor-grace-period=10s \
    --cluster-signing-cert-file=/etc/kubernetes/pki/ca.crt \
    --address=127.0.0.1 \
    --leader-elect=true \
    --use-service-account-credentials=true \
    --controllers=*,bootstrapsigner,tokencleaner \
    --kubeconfig=/etc/kubernetes/controller-manager.conf \
    --insecure-experimental-approve-all-kubelet-csrs-for-group=system:bootstrappers \
    --root-ca-file=/etc/kubernetes/pki/ca.crt \
    --service-account-private-key-file=/etc/kubernetes/pki/sa.key \
    --cluster-signing-key-file=/etc/kubernetes/pki/ca.key
```
