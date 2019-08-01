# cri-tools

通常，容器引擎會提供一個命令行工具來幫助用戶調試容器應用並簡化故障排錯。比如使用 Docker 作為容器運行時的時候，可以使用 `docker` 命令來查看容器和鏡像的狀態，並驗證容器的配置是否正確。但在使用其他容器引擎時，推薦使用 `crictl` 來替代 `docker` 工具。

`crictl` 是 [cri-tools](https://github.com/kubernetes-incubator/cri-tools) 的一部分，它提供了類似於 docker 的命令行工具，不需要通過 Kubelet 就可以通過 CRI 跟容器運行時通信。它是專門為 Kubernetes 設計的，提供了Pod、容器和鏡像等資源的管理命令，可以幫助用戶和開發者調試容器應用或者排查異常問題。`crictl` 可以用於所有實現了 CRI 接口的容器運行時。

注意，`crictl` 並非 `kubectl` 的替代品，它只通過 CRI 接口與容器運行時通信，可以用來調試和排錯，但並不用於運行容器。雖然 crictl 也提供運行 Pod 和容器的子命令，但這些命令僅推薦用於調試。需要注意的是，如果是在 Kubernetes Node 上面創建了新的 Pod，那麼它們會被 Kubelet 停止並刪除。

除了 `crictl`，cri-tools 還提供了用於驗證容器運行時是否實現 CRI 需要功能的驗證測試工具 `critest`。`critest` 通過運行一系列的測試驗證容器運行時在實現 CRI 時是否與 Kubelet 的需求一致，推薦所有的容器運行時在發佈前都要通過其測試。一般情況下，`critest` 可以作為容器運行時集成測試的一部分，用以保證代碼更新不會破壞 CRI 功能。

cri-tools 已在 v1.11 版 GA，詳細使用方法請參考 [kubernetes-sigs/cri-tools](https://github.com/kubernetes-sigs/cri-tools) 和 [Debugging Kubernetes nodes with crictl](https://kubernetes.io/docs/tasks/debug-application-cluster/crictl/)。

## crictl 示例

### 查詢 Pod

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

### 鏡像列表

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

### 容器內執行命令

```sh
$ crictl exec -i -t 1f73f2d81bf98 ls
bin   dev   etc   home  proc  root  sys   tmp   usr   var
```

### 容器日誌

```sh
crictl logs 87d3992f84f74
10.240.0.96 - - [06/Jun/2018:02:45:49 +0000] "GET / HTTP/1.1" 200 612 "-" "curl/7.47.0" "-"
10.240.0.96 - - [06/Jun/2018:02:45:50 +0000] "GET / HTTP/1.1" 200 612 "-" "curl/7.47.0" "-"
10.240.0.96 - - [06/Jun/2018:02:45:51 +0000] "GET / HTTP/1.1" 200 612 "-" "curl/7.47.0" "-"
```

## 參考文檔

- [Debugging Kubernetes nodes with crictl](https://kubernetes.io/docs/tasks/debug-application-cluster/crictl/)
- <https://github.com/kubernetes-sigs/cri-tools>
