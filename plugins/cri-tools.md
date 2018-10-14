# cri-tools

通常，容器引擎会提供一个命令行工具来帮助用户调试容器应用并简化故障排错。比如使用 Docker 作为容器运行时的时候，可以使用 `docker` 命令来查看容器和镜像的状态，并验证容器的配置是否正确。但在使用其他容器引擎时，推荐使用 `crictl` 来替代 `docker` 工具。

`crictl` 是 [cri-tools](https://github.com/kubernetes-incubator/cri-tools) 的一部分，它提供了类似于 docker 的命令行工具，不需要通过 Kubelet 就可以通过 CRI 跟容器运行时通信。它是专门为 Kubernetes 设计的，提供了Pod、容器和镜像等资源的管理命令，可以帮助用户和开发者调试容器应用或者排查异常问题。`crictl` 可以用于所有实现了 CRI 接口的容器运行时。

注意，`crictl` 并非 `kubectl` 的替代品，它只通过 CRI 接口与容器运行时通信，可以用来调试和排错，但并不用于运行容器。虽然 crictl 也提供运行 Pod 和容器的子命令，但这些命令仅推荐用于调试。需要注意的是，如果是在 Kubernetes Node 上面创建了新的 Pod，那么它们会被 Kubelet 停止并删除。

除了 `crictl`，cri-tools 还提供了用于验证容器运行时是否实现 CRI 需要功能的验证测试工具 `critest`。`critest` 通过运行一系列的测试验证容器运行时在实现 CRI 时是否与 Kubelet 的需求一致，推荐所有的容器运行时在发布前都要通过其测试。一般情况下，`critest` 可以作为容器运行时集成测试的一部分，用以保证代码更新不会破坏 CRI 功能。

cri-tools 已在 v1.11 版 GA，详细使用方法请参考 [kubernetes-sigs/cri-tools](https://github.com/kubernetes-sigs/cri-tools) 和 [Debugging Kubernetes nodes with crictl](https://kubernetes.io/docs/tasks/debug-application-cluster/crictl/)。

## crictl 示例

### 查询 Pod

```sh
$ crictl pods --name nginx-65899c769f-wv2gp
POD ID              CREATED             STATE               NAME                     NAMESPACE           ATTEMPT
4dccb216c4adb       2 minutes ago       Ready               nginx-65899c769f-wv2gp   default             0
```

### Pod 列表

```sh
$ crictl pods
POD ID              CREATED              STATE               NAME                         NAMESPACE           ATTEMPT
926f1b5a1d33a       About a minute ago   Ready               sh-84d7dcf559-4r2gq          default             0
4dccb216c4adb       About a minute ago   Ready               nginx-65899c769f-wv2gp       default             0
a86316e96fa89       17 hours ago         Ready               kube-proxy-gblk4             kube-system         0
919630b8f81f1       17 hours ago         Ready               nvidia-device-plugin-zgbbv   kube-system         0
```

### 镜像列表

```sh
$ crictl images
IMAGE                                     TAG                 IMAGE ID            SIZE
busybox                                   latest              8c811b4aec35f       1.15MB
k8s-gcrio.azureedge.net/hyperkube-amd64   v1.10.3             e179bbfe5d238       665MB
k8s-gcrio.azureedge.net/pause-amd64       3.1                 da86e6ba6ca19       742kB
nginx                                     latest              cd5239a0906a6       109MB
```

### 容器列表

```sh
$ crictl ps -a
CONTAINER ID        IMAGE                                                                                                             CREATED             STATE               NAME                       ATTEMPT
1f73f2d81bf98       busybox@sha256:141c253bc4c3fd0a201d32dc1f493bcf3fff003b6df416dea4f41046e0f37d47                                   7 minutes ago       Running             sh                         1
9c5951df22c78       busybox@sha256:141c253bc4c3fd0a201d32dc1f493bcf3fff003b6df416dea4f41046e0f37d47                                   8 minutes ago       Exited              sh                         0
87d3992f84f74       nginx@sha256:d0a8828cccb73397acb0073bf34f4d7d8aa315263f1e7806bf8c55d8ac139d5f                                     8 minutes ago       Running             nginx                      0
1941fb4da154f       k8s-gcrio.azureedge.net/hyperkube-amd64@sha256:00d814b1f7763f4ab5be80c58e98140dfc69df107f253d7fdd714b30a714260a   18 hours ago        Running             kube-proxy                 0
```

### 容器内执行命令

```sh
$ crictl exec -i -t 1f73f2d81bf98 ls
bin   dev   etc   home  proc  root  sys   tmp   usr   var
```

### 容器日志

```sh
crictl logs 87d3992f84f74
10.240.0.96 - - [06/Jun/2018:02:45:49 +0000] "GET / HTTP/1.1" 200 612 "-" "curl/7.47.0" "-"
10.240.0.96 - - [06/Jun/2018:02:45:50 +0000] "GET / HTTP/1.1" 200 612 "-" "curl/7.47.0" "-"
10.240.0.96 - - [06/Jun/2018:02:45:51 +0000] "GET / HTTP/1.1" 200 612 "-" "curl/7.47.0" "-"
```

## 参考文档

- [Debugging Kubernetes nodes with crictl](https://kubernetes.io/docs/tasks/debug-application-cluster/crictl/)
- <https://github.com/kubernetes-sigs/cri-tools>
