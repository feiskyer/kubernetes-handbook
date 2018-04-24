# Conduit

[Conduit](https://conduit.io) 是 Buoyant 公司推出的下一代轻量级 service mesh。与 linkerd 不同的是，它专用于 Kubernetes 集群中，并且比 linkerd 更轻量级（基于 Rust 和 Go，没有了 JVM 等大内存的开销），可以以 sidecar 的方式把代理服务跟实际服务的 Pod 运行在一起（这点跟 Istio 类似）。

> 注意：Conduit 目前还处于 Alpha 阶段，不建议在生产环境中使用。

```sh
$ curl https://run.conduit.io/install | bash
..
.
Conduit was successfully installed 🎉

$ conduit install | kubectl apply -f -
..
.
namespace "conduit" created...

$ conduit dashboard
Running `kubectl proxy --port=8001`... |

# Install a demo app
$ curl https://raw.githubusercontent.com/runconduit/conduit-examples/master/emojivoto/emojivoto.yml | conduit inject - --skip-inbound-ports=80 | kubectl apply -f -
```

## 参考文档

- [A SERVICE MESH FOR KUBERNETES](https://buoyant.io/2016/10/04/a-service-mesh-for-kubernetes-part-i-top-line-service-metrics/)
- [Service Mesh Pattern](http://philcalcado.com/2017/08/03/pattern_service_mesh.html)
- <https://conduit.io>

