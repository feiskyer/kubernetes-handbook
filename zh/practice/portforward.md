# 端口转发

端口转发是 kubectl 的一个子命令，通过 `kubectl port-forward` 可以将本地端口转发到指定的 Pod。

## Pod 端口转发

可以将本地端口转发到指定 Pod 的端口。

```sh
# Listen on ports 5000 and 6000 locally, forwarding data to/from ports 5000 and 6000 in the pod
kubectl port-forward mypod 5000 6000

# Listen on port 8888 locally, forwarding to 5000 in the pod
kubectl port-forward mypod 8888:5000

# Listen on a random port locally, forwarding to 5000 in the pod
kubectl port-forward mypod :5000

# Listen on a random port locally, forwarding to 5000 in the pod
kubectl port-forward mypod 0:5000
```
## 服务端口转发

也可以将本地端口转发到服务、复制控制器或者部署的端口。

```sh
# Forward to deployment
kubectl port-forward deployment/redis-master 6379:6379

# Forward to replicaSet
kubectl port-forward rs/redis-master 6379:6379

# Forward to service
kubectl port-forward svc/redis-master 6379:6379
```

