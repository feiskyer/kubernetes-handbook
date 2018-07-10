# Conduit

[Conduit](https://conduit.io) 是 Buoyant 公司推出的下一代轻量级服务网格框架，开源在 <https://github.com/runconduit/conduit>。与 linkerd 不同的是，它专用于 Kubernetes 集群中，并且比 linkerd 更轻量级（基于 Rust 和 Go，没有了 JVM 等大内存的开销），可以以 sidecar 的方式把代理服务跟实际服务的 Pod 运行在一起（这点跟 Istio 类似）。Conduit 的主要特性包括：

- 轻量级，速度快，每个代理容器仅占用 10mb RSS，并且额外延迟只有亚毫妙级
- 安全，基于 Rust，默认开启 TLS
- 端到端可视化
- 增强 Kubernetes 的可靠性、可视性以及安全性

> 注意：Conduit 目前还处于 Alpha 阶段，并且将在未来合并到 Linkerd 2.0 中。

## 部署

首先安装 conduit 命令行工具：

```sh
$ curl https://run.conduit.io/install | sh
$ sudo cp $HOME/.conduit/bin/conduit /usr/local/bin
```

然后部署 conduit 控制平面服务

```sh
$ conduit install | kubectl apply -f -
namespace "conduit" created
serviceaccount "conduit-controller" created
clusterrole "conduit-controller" created
clusterrolebinding "conduit-controller" created
serviceaccount "conduit-prometheus" created
clusterrole "conduit-prometheus" created
clusterrolebinding "conduit-prometheus" created
service "api" created
service "proxy-api" created
deployment "controller" created
service "web" created
deployment "web" created
service "prometheus" created
deployment "prometheus" created
configmap "prometheus-config" created

$ kubectl -n conduit get svc
NAME         TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)             AGE
api          ClusterIP   10.0.17.12     <none>        8085/TCP            6m
grafana      ClusterIP   10.0.161.136   <none>        3000/TCP            6m
prometheus   ClusterIP   10.0.90.252    <none>        9090/TCP            6m
proxy-api    ClusterIP   10.0.9.45      <none>        8086/TCP            6m
web          ClusterIP   10.0.199.56    <none>        8084/TCP,9994/TCP   6m

$ kubectl -n conduit get pod
NAME                          READY     STATUS    RESTARTS   AGE
controller-66f969dc6d-clp92   5/5       Running   0          6m
grafana-56575f6f47-5gt5s      2/2       Running   0          6m
prometheus-5db966cd8d-vhb7l   2/2       Running   0          6m
web-844fb7fdbb-rqqxj          2/2       Running   0          6m
```

## Dashboard

```sh
$ conduit dashboard
```

## 示例应用

```sh
$ curl https://raw.githubusercontent.com/runconduit/conduit-examples/master/emojivoto/emojivoto.yml | conduit inject - | kubectl apply -f -

$ kubectl -n emojivoto get svc
NAME         TYPE           CLUSTER-IP    EXTERNAL-IP   PORT(S)        AGE
emoji-svc    ClusterIP      None          <none>        8080/TCP       49s
voting-svc   ClusterIP      None          <none>        8080/TCP       48s
web-svc      LoadBalancer   10.0.100.46   <pending>     80:30636/TCP   48s

$ kubectl -n emojivoto get pod
NAME                       READY     STATUS    RESTARTS   AGE
emoji-69b88fc996-pfdc5     2/2       Running   0          5m
vote-bot-bf74b855d-dtpl9   2/2       Running   0          5m
voting-76f4784558-gtgkl    2/2       Running   0          5m
web-f54d6cf54-267zn        2/2       Running   0          5m
```

查看服务的网络流量统计情况：

```sh
conduit -n emojivoto stat deployment
NAME       MESHED   SUCCESS      RPS   LATENCY_P50   LATENCY_P95   LATENCY_P99
emoji         1/1   100.00%   2.0rps           1ms           1ms           1ms
vote-bot      1/1         -        -             -             -             -
voting        1/1    75.86%   1.0rps           1ms           1ms           1ms
web           1/1    85.00%   2.0rps           3ms           4ms           4ms
```

跟踪服务的网络流量

```sh
$ conduit tap deploy emojivoto/voting                                                                root@MSWINX1YOGA
req id=0:809 src=10.244.6.239:57202 dst=10.244.1.237:8080 :method=POST :authority=voting-svc.emojivoto:8080 :path=/emojivoto.v1.VotingService/VoteDoughnut
rsp id=0:809 src=10.244.6.239:57202 dst=10.244.1.237:8080 :status=200 latency=478µs
end id=0:809 src=10.244.6.239:57202 dst=10.244.1.237:8080 grpc-status=OK duration=7µs response-length=5B
req id=0:810 src=10.244.6.239:57202 dst=10.244.1.237:8080 :method=POST :authority=voting-svc.emojivoto:8080 :path=/emojivoto.v1.VotingService/VoteDoughnut
rsp id=0:810 src=10.244.6.239:57202 dst=10.244.1.237:8080 :status=200 latency=419µs
end id=0:810 src=10.244.6.239:57202 dst=10.244.1.237:8080 grpc-status=OK duration=8µs response-length=5B
```

## 已知问题

### HTTP 隧道以及 WebSocket

虽然 Conduit 已经可以处理大部分的 HTTP 流量，但目前还不支持使用 HTTP CONNECT 方法（如 HTTP 隧道和代理）以及 WebSockets 流量。此时，需要额外配置跳过它们，如

```sh
conduit inject deployment.yml --skip-inbound-ports=80,7777 | kubectl apply -f -
```

### MySQL 和 SMTP

虽然 Conduit 已经可以处理大部分的 TCP 流量，但目前还不支持服务器端比客户端更早发送数据包的协议（如 MySQL 和 SMTP）。此时，需要额外配置跳过它们，如

```sh
conduit inject deployment.yml --skip-outbound-ports=3306 | kubectl apply -f -
```

## 参考文档

- [A SERVICE MESH FOR KUBERNETES](https://buoyant.io/2016/10/04/a-service-mesh-for-kubernetes-part-i-top-line-service-metrics/)
- [Service Mesh Pattern](http://philcalcado.com/2017/08/03/pattern_service_mesh.html)
- <https://conduit.io>
