# Metrics

Starting from Kubernetes 1.8, resource usage metrics, such as container CPU and memory usage, are available in Kubernetes through the Metrics API. These metrics can be either accessed directly by user, for example by using `kubectl top` command, or used by a controller in the cluster, e.g. Horizontal Pod Autoscaler, to make decisions.

- Metrics API doesn’t store the metric values, so it’s not possible for example to get the amount of resources used by a given node 10 minutes ago.
- The URI of Metrics API is `/apis/metrics.k8s.io/` and is defined in [k8s.io/metrics](https://github.com/kubernetes/metrics)
- `metrics-server` must be deployed to access this API

## Enable API Aggregation

Before deploying metrics-server, API Aggregation must be enabled first in kube-apiserver.

```sh
--requestheader-client-ca-file=/etc/kubernetes/certs/proxy-ca.crt
--proxy-client-cert-file=/etc/kubernetes/certs/proxy.crt
--proxy-client-key-file=/etc/kubernetes/certs/proxy.key
--requestheader-allowed-names=aggregator
--requestheader-extra-headers-prefix=X-Remote-Extra-
--requestheader-group-headers=X-Remote-Group
--requestheader-username-headers=X-Remote-User
```

And if kube-proxy is not running on the master nodes, an extra config is also required:

```sh
--enable-aggregator-routing=true
```

## Deploy metrics-server

```sh
$ git clone https://github.com/kubernetes-incubator/metrics-server
$ cd metrics-server
$ kubectl create -f deploy/1.8+/
```

Wait a while and then metrics-server pod will be running

```sh
kubectl -n kube-system get pods -l k8s-app=metrics-server
```

## Metrics API

You can access [Metrics API](https://github.com/kubernetes/community/blob/master/contributors/design-proposals/instrumentation/resource-metrics-api.md) via `kubectl proxy`, e.g.

- `http://127.0.0.1:8001/apis/metrics.k8s.io/v1beta1/nodes`
- `http://127.0.0.1:8001/apis/metrics.k8s.io/v1beta1/nodes/<node-name>`
- `http://127.0.0.1:8001/apis/metrics.k8s.io/v1beta1/pods`
- `http://127.0.0.1:8001/apis/metrics.k8s.io/v1beta1/namespaces/<namespace-name>/pods/<pod-name>`

Or it can be accessed by kubectl raw:

- `kubectl get --raw /apis/metrics.k8s.io/v1beta1/nodes`
- `kubectl get --raw /apis/metrics.k8s.io/v1beta1/pods`
- `kubectl get --raw /apis/metrics.k8s.io/v1beta1/nodes/<node-name>`
- `kubectl get --raw /apis/metrics.k8s.io/v1beta1/namespaces/<namespace-name>/pods/<pod-name>`

## Troubleshooting

If metrics-server Pod is stuck on CrashLoopBackOff and restartCount is not zero, then it's probably API Aggregation not enabled on kube-apiserver.

If there are still same issue even after enabling API Aggregation, then we should check metrics-server's logs first. You may find following error:

```sh
dial tcp 10.96.0.1:443: i/o timeout
```

Which indicates the metrics-server couldn't reach kube-apiserver. It is probably because FORWARD disabled by newer docker (e.g. v1.13+), which could be enabled by

```sh
echo "ExecStartPost=/sbin/iptables -P FORWARD ACCEPT" >> /etc/systemd/system/docker.service.d/exec_start.conf
systemctl daemon-reload
systemctl restart docker
```

## References

- [Core metrics pipeline](https://kubernetes.io/docs/tasks/debug-application-cluster/resource-metrics-pipeline/)
- [metrics-server](https://github.com/kubernetes-incubator/metrics-server)
