# Linkerd2 (Conduit)

Linkerd2 （曾命名為 [Conduit](https://conduit.io)） 是 Buoyant 公司推出的下一代輕量級服務網格框架，開源在 <https://github.com/linkerd/linkerd2>。與 linkerd 不同的是，它專用於 Kubernetes 集群中，並且比 linkerd 更輕量級（基於 Rust 和 Go，沒有了 JVM 等大內存的開銷），可以以 sidecar 的方式把代理服務跟實際服務的 Pod 運行在一起（這點跟 Istio 類似）。Linkerd2 的主要特性包括：

- 輕量級，速度快，每個代理容器僅佔用 10mb RSS，並且額外延遲只有亞毫妙級
- 安全，基於 Rust，默認開啟 TLS
- 端到端可視化
- 增強 Kubernetes 的可靠性、可視性以及安全性

## 部署

```sh
$ linkerd install | kubectl apply -f -
namespace/linkerd configured
serviceaccount/linkerd-controller configured
clusterrole.rbac.authorization.k8s.io/linkerd-linkerd-controller configured
clusterrolebinding.rbac.authorization.k8s.io/linkerd-linkerd-controller configured
serviceaccount/linkerd-prometheus configured
clusterrole.rbac.authorization.k8s.io/linkerd-linkerd-prometheus configured
clusterrolebinding.rbac.authorization.k8s.io/linkerd-linkerd-prometheus configured
service/api configured
service/proxy-api configured
deployment.extensions/controller configured
service/web configured
deployment.extensions/web configured
service/prometheus configured
deployment.extensions/prometheus configured
configmap/prometheus-config configured
service/grafana configured
deployment.extensions/grafana configured
configmap/grafana-config configured

$ kubectl -n linkerd get svc
NAME         TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)             AGE
api          ClusterIP   10.0.173.27    <none>        8085/TCP            163m
grafana      ClusterIP   10.0.49.44     <none>        3000/TCP            163m
prometheus   ClusterIP   10.0.205.82    <none>        9090/TCP            163m
proxy-api    ClusterIP   10.0.170.201   <none>        8086/TCP            163m
web          ClusterIP   10.0.88.136    <none>        8084/TCP,9994/TCP   163m

$ kubectl -n linkerd get pod          
NAME                          READY     STATUS    RESTARTS   AGE
controller-67489d768d-75wjz   5/5       Running   0          163m
grafana-5df745d8b8-pv6tf      2/2       Running   0          163m
prometheus-d96f9bf89-2s6jg    2/2       Running   0          163m
web-5cd59f97b6-wf8nk          2/2       Running   0          57s
```

## Dashboard

```sh
$ linkerd dashboard
Linkerd dashboard available at:
http://127.0.0.1:37737/api/v1/namespaces/linkerd/services/web:http/proxy/
Grafana dashboard available at:
http://127.0.0.1:37737/api/v1/namespaces/linkerd/services/grafana:http/proxy/
Opening Linkerd dashboard in the default browser
```

![](images/linkerd2.png)

## 示例應用

```sh
curl https://run.linkerd.io/emojivoto.yml \
  | linkerd inject - \
  | kubectl apply -f -
```

查看服務的網絡流量統計情況：

```sh
linkerd -n emojivoto stat deployment
NAME       MESHED   SUCCESS      RPS   LATENCY_P50   LATENCY_P95   LATENCY_P99   TLS
emoji         1/1   100.00%   8.1rps           1ms           1ms           1ms    0%
vote-bot      1/1         -        -             -             -             -     -
voting        1/1    87.88%   1.1rps           1ms           1ms           1ms    0%
web           1/1    93.65%   2.1rps           1ms           9ms          88ms    0%
```

跟蹤服務的網絡流量

```sh
$ linkerd -n emojivoto tap deploy voting
req id=0:809 src=10.244.6.239:57202 dst=10.244.1.237:8080 :method=POST :authority=voting-svc.emojivoto:8080 :path=/emojivoto.v1.VotingService/VoteDoughnut
rsp id=0:809 src=10.244.6.239:57202 dst=10.244.1.237:8080 :status=200 latency=478µs
end id=0:809 src=10.244.6.239:57202 dst=10.244.1.237:8080 grpc-status=OK duration=7µs response-length=5B
req id=0:810 src=10.244.6.239:57202 dst=10.244.1.237:8080 :method=POST :authority=voting-svc.emojivoto:8080 :path=/emojivoto.v1.VotingService/VoteDoughnut
rsp id=0:810 src=10.244.6.239:57202 dst=10.244.1.237:8080 :status=200 latency=419µs
end id=0:810 src=10.244.6.239:57202 dst=10.244.1.237:8080 grpc-status=OK duration=8µs response-length=5B
```

## 參考文檔

- [A SERVICE MESH FOR KUBERNETES](https://buoyant.io/2016/10/04/a-service-mesh-for-kubernetes-part-i-top-line-service-metrics/)
- [Service Mesh Pattern](http://philcalcado.com/2017/08/03/pattern_service_mesh.html)
- <https://linkerd.io/2/overview/>

