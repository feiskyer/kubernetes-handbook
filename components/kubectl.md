# kubectl

kubectl 是 Kubernetes 的命令行工具（CLI），是 Kubernetes 用戶和管理員必備的管理工具。

kubectl 提供了大量的子命令，方便管理 Kubernetes 集群中的各種功能。這裡不再羅列各種子命令的格式，而是介紹下如何查詢命令的幫助

- `kubectl -h` 查看子命令列表
- `kubectl options` 查看全局選項
- `kubectl <command> --help` 查看子命令的幫助
- `kubectl [command] [PARAMS] -o=<format>` 設置輸出格式（如 json、yaml、jsonpath 等）
- `kubectl explain [RESOURCE]` 查看資源的定義

## 配置

使用 kubectl 的第一步是配置 Kubernetes 集群以及認證方式，包括

- cluster 信息：Kubernetes server 地址
- 用戶信息：用戶名、密碼或密鑰
- Context：cluster、用戶信息以及 Namespace 的組合

示例

```sh
kubectl config set-credentials myself --username=admin --password=secret
kubectl config set-cluster local-server --server=http://localhost:8080
kubectl config set-context default-context --cluster=local-server --user=myself --namespace=default
kubectl config use-context default-context
kubectl config view
```

## 常用命令格式

- 創建：`kubectl run <name> --image=<image>` 或者 `kubectl create -f manifest.yaml`
- 查詢：`kubectl get <resource>`
- 更新 `kubectl set` 或者 `kubectl patch`
- 刪除：`kubectl delete <resource> <name>` 或者 `kubectl delete -f manifest.yaml`
- 查詢 Pod IP：`kubectl get pod <pod-name> -o jsonpath='{.status.podIP}'`
- 容器內執行命令：`kubectl exec -ti <pod-name> sh`
- 容器日誌：`kubectl logs [-f] <pod-name>`
- 導出服務：`kubectl expose deploy <name> --port=80`
- Base64 解碼：

```sh
kubectl get secret SECRET -o go-template='{{ .data.KEY | base64decode }}'
```

注意，`kubectl run` 僅支持 Pod、Replication Controller、Deployment、Job 和 CronJob 等幾種資源。具體的資源類型是由參數決定的，默認為 Deployment：

| 創建的資源類型                | 參數                    |
| ---------------------- | --------------------- |
| Pod                    | `--restart=Never`     |
| Replication Controller | `--generator=run/v1`  |
| Deployment             | `--restart=Always`    |
| Job                    | `--restart=OnFailure` |
| CronJob                | `--schedule=<cron>`   |

## 命令行自動補全

Linux 系統 Bash：

```sh
source /usr/share/bash-completion/bash_completion
source <(kubectl completion bash)
```

MacOS zsh

```sh
source <(kubectl completion zsh)
```

## 日誌查看

`kubectl logs` 用於顯示 pod 運行中，容器內程序輸出到標準輸出的內容。跟 docker 的 logs 命令類似。

```sh
# Return snapshot logs from pod nginx with only one container
kubectl logs nginx

# Return snapshot of previous terminated ruby container logs from pod web-1
kubectl logs -p -c ruby web-1

# Begin streaming the logs of the ruby container in pod web-1
kubectl logs -f -c ruby web-1
```

## 連接到一個正在運行的容器

`kubectl attach` 用於連接到一個正在運行的容器。跟 docker 的 attach 命令類似。

```sh
  # Get output from running pod 123456-7890, using the first container by default
  kubectl attach 123456-7890

  # Get output from ruby-container from pod 123456-7890
  kubectl attach 123456-7890 -c ruby-container

  # Switch to raw terminal mode, sends stdin to 'bash' in ruby-container from pod 123456-7890
  # and sends stdout/stderr from 'bash' back to the client
  kubectl attach 123456-7890 -c ruby-container -i -t

Options:
  -c, --container='': Container name. If omitted, the first container in the pod will be chosen
  -i, --stdin=false: Pass stdin to the container
  -t, --tty=false: Stdin is a TTY
```

## 在容器內部執行命令

`kubectl exec` 用於在一個正在運行的容器執行命令。跟 docker 的 exec 命令類似。

```sh
  # Get output from running 'date' from pod 123456-7890, using the first container by default
  kubectl exec 123456-7890 date

  # Get output from running 'date' in ruby-container from pod 123456-7890
  kubectl exec 123456-7890 -c ruby-container date

  # Switch to raw terminal mode, sends stdin to 'bash' in ruby-container from pod 123456-7890
  # and sends stdout/stderr from 'bash' back to the client
  kubectl exec 123456-7890 -c ruby-container -i -t -- bash -il

Options:
  -c, --container='': Container name. If omitted, the first container in the pod will be chosen
  -p, --pod='': Pod name
  -i, --stdin=false: Pass stdin to the container
  -t, --tty=false: Stdin is a TT
```

## 端口轉發

`kubectl port-forward` 用於將本地端口轉發到指定的 Pod。

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

也可以將本地端口轉發到服務、複製控制器或者部署的端口。

```sh
# Forward to deployment
kubectl port-forward deployment/redis-master 6379:6379

# Forward to replicaSet
kubectl port-forward rs/redis-master 6379:6379

# Forward to service
kubectl port-forward svc/redis-master 6379:6379
```

## API Server 代理

`kubectl proxy` 命令提供了一個 Kubernetes API 服務的 HTTP 代理。

```sh
$ kubectl proxy --port=8080
Starting to serve on 127.0.0.1:8080
```

可以通過代理地址 `http://localhost:8080/api/` 來直接訪問 Kubernetes API，比如查詢 Pod 列表

```sh
curl http://localhost:8080/api/v1/namespaces/default/pods
```

注意，如果通過 `--address` 指定了非 localhost 的地址，則訪問 8080 端口時會報未授權的錯誤，可以設置 `--accept-hosts` 來避免這個問題（** 不推薦生產環境這麼設置 **）：

```sh
kubectl proxy --address='0.0.0.0' --port=8080 --accept-hosts='^*$'
```

## 文件拷貝

`kubectl cp` 支持從容器中拷貝，或者拷貝文件到容器中

```sh
  # Copy /tmp/foo_dir local directory to /tmp/bar_dir in a remote pod in the default namespace
  kubectl cp /tmp/foo_dir <some-pod>:/tmp/bar_dir

  # Copy /tmp/foo local file to /tmp/bar in a remote pod in a specific container
  kubectl cp /tmp/foo <some-pod>:/tmp/bar -c <specific-container>

  # Copy /tmp/foo local file to /tmp/bar in a remote pod in namespace <some-namespace>
  kubectl cp /tmp/foo <some-namespace>/<some-pod>:/tmp/bar

  # Copy /tmp/foo from a remote pod to /tmp/bar locally
  kubectl cp <some-namespace>/<some-pod>:/tmp/foo /tmp/bar

Options:
  -c, --container='': Container name. If omitted, the first container in the pod will be chosen
```

注意：文件拷貝依賴於 tar 命令，所以容器中需要能夠執行 tar 命令

## kubectl drain

```sh
kubectl drain NODE [Options]
```

- 它會刪除該 NODE 上由 ReplicationController, ReplicaSet, DaemonSet, StatefulSet or Job 創建的 Pod
- 不刪除 mirror pods（因為不可通過 API 刪除 mirror pods）
- 如果還有其它類型的 Pod（比如不通過 RC 而直接通過 kubectl create 的 Pod）並且沒有 --force 選項，該命令會直接失敗
- 如果命令中增加了 --force 選項，則會強制刪除這些不是通過 ReplicationController, Job 或者 DaemonSet 創建的 Pod

有的時候不需要 evict pod，只需要標記 Node 不可調用，可以用 `kubectl cordon` 命令。

恢復的話只需要運行 `kubectl uncordon NODE` 將 NODE 重新改成可調度狀態。

## 權限檢查

`kubectl auth` 提供了兩個子命令用於檢查用戶的鑑權情況：

- `kubectl auth can-i` 檢查用戶是否有權限進行某個操作，比如

```sh
  # Check to see if I can create pods in any namespace
  kubectl auth can-i create pods --all-namespaces

  # Check to see if I can list deployments in my current namespace
  kubectl auth can-i list deployments.extensions

  # Check to see if I can do everything in my current namespace ("*" means all)
  kubectl auth can-i '*' '*'

  # Check to see if I can get the job named "bar" in namespace "foo"
  kubectl auth can-i list jobs.batch/bar -n foo
```

- `kubectl auth reconcile` 自動修復有問題的 RBAC 策略，如

```sh
  # Reconcile rbac resources from a file
  kubectl auth reconcile -f my-rbac-rules.yaml
```

## 模擬其他用戶

kubectl 支持模擬其他用戶或者組來進行集群管理操作，比如

```sh
kubectl drain mynode --as=superman --as-group=system:masters
```

這實際上就是在請求 Kubernetes API 時添加了如下的 HTTP HEADER：

```sh
Impersonate-User: superman
Impersonate-Group: system:masters
```

## 查看事件（events）

```sh
# 查看所有事件
kubectl get events --all-namespaces

# 查看名為nginx對象的事件
kubectl get events --field-selector involvedObject.name=nginx,involvedObject.namespace=default

# 查看名為nginx的服務事件
kubectl get events --field-selector involvedObject.name=nginx,involvedObject.namespace=default,involvedObject.kind=Service

# 查看Pod的事件
kubectl get events --field-selector involvedObject.name=nginx-85cb5867f-bs7pn,involvedObject.kind=Pod
```

## kubectl 插件

kubectl 插件提供了一種擴展 kubectl 的機制，比如添加新的子命令。插件可以以任何語言編寫，只需要滿足以下條件即可

- 插件放在 `~/.kube/plugins` 或環境變量 `KUBECTL_PLUGINS_PATH` 指定的目錄中
- 插件的格式為 ` 子目錄 / 可執行文件或腳本 ` 且子目錄中要包括 `plugin.yaml` 配置文件

比如

```sh
$ tree
.
└── hello
    └── plugin.yaml

1 directory, 1 file

$ cat hello/plugin.yaml
name: "hello"
shortDesc: "Hello kubectl plugin!"
command: "echo Hello plugins!"

$ kubectl plugin hello
Hello plugins!
```

你也可以使用 [krew](../deploy/kubectl.md) 來管理 kubectl 插件。

## 原始 URI

kubectl 也可以用來直接訪問原始 URI，比如要訪問 [Metrics API](https://github.com/kubernetes-incubator/metrics-server) 可以

- `kubectl get --raw /apis/metrics.k8s.io/v1beta1/nodes`
- `kubectl get --raw /apis/metrics.k8s.io/v1beta1/pods`
- `kubectl get --raw /apis/metrics.k8s.io/v1beta1/nodes/<node-name>`
- `kubectl get --raw /apis/metrics.k8s.io/v1beta1/namespace/<namespace-name>/pods/<pod-name>`

## 附錄

kubectl 的安裝方法

```sh
# OS X
curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/darwin/amd64/kubectl

# Linux
curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/amd64/kubectl

# Windows
curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/windows/amd64/kubectl.exe
```
