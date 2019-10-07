# kubectl

kubectl 是 Kubernetes 的命令行工具（CLI），是 Kubernetes 用户和管理员必备的管理工具。

kubectl 提供了大量的子命令，方便管理 Kubernetes 集群中的各种功能。这里不再罗列各种子命令的格式，而是介绍下如何查询命令的帮助

- `kubectl -h` 查看子命令列表
- `kubectl options` 查看全局选项
- `kubectl <command> --help` 查看子命令的帮助
- `kubectl [command] [PARAMS] -o=<format>` 设置输出格式（如 json、yaml、jsonpath 等）
- `kubectl explain [RESOURCE]` 查看资源的定义

## 配置

使用 kubectl 的第一步是配置 Kubernetes 集群以及认证方式，包括

- cluster 信息：Kubernetes server 地址
- 用户信息：用户名、密码或密钥
- Context：cluster、用户信息以及 Namespace 的组合

示例

```sh
kubectl config set-credentials myself --username=admin --password=secret
kubectl config set-cluster local-server --server=http://localhost:8080
kubectl config set-context default-context --cluster=local-server --user=myself --namespace=default
kubectl config use-context default-context
kubectl config view
```

## 常用命令格式

- 创建：`kubectl run <name> --image=<image>` 或者 `kubectl create -f manifest.yaml`
- 查询：`kubectl get <resource>`
- 更新 `kubectl set` 或者 `kubectl patch`
- 删除：`kubectl delete <resource> <name>` 或者 `kubectl delete -f manifest.yaml`
- 查询 Pod IP：`kubectl get pod <pod-name> -o jsonpath='{.status.podIP}'`
- 容器内执行命令：`kubectl exec -ti <pod-name> sh`
- 容器日志：`kubectl logs [-f] <pod-name>`
- 导出服务：`kubectl expose deploy <name> --port=80`
- Base64 解码：

```sh
kubectl get secret SECRET -o go-template='{{ .data.KEY | base64decode }}'
```

注意，`kubectl run` 仅支持 Pod、Replication Controller、Deployment、Job 和 CronJob 等几种资源。具体的资源类型是由参数决定的，默认为 Deployment：

| 创建的资源类型                | 参数                    |
| ---------------------- | --------------------- |
| Pod                    | `--restart=Never`     |
| Replication Controller | `--generator=run/v1`  |
| Deployment             | `--restart=Always`    |
| Job                    | `--restart=OnFailure` |
| CronJob                | `--schedule=<cron>`   |

## 命令行自动补全

Linux 系统 Bash：

```sh
source /usr/share/bash-completion/bash_completion
source <(kubectl completion bash)
```

MacOS zsh

```sh
source <(kubectl completion zsh)
```

##  自定义输出列

比如，查询所有 Pod 的资源请求和限制：

```sh
kubectl get pods --all-namespaces -o custom-columns=NS:.metadata.namespace,NAME:.metadata.name,"CPU(requests)":.spec.containers[*].resources.requests.cpu,"CPU(limits)":.spec.containers[*].resources.limits.cpu,"MEMORY(requests)":.spec.containers[*].resources.requests.memory,"MEMORY(limits)":.spec.containers[*].resources.limits.memory
```

## 日志查看

`kubectl logs` 用于显示 pod 运行中，容器内程序输出到标准输出的内容。跟 docker 的 logs 命令类似。

```sh
# Return snapshot logs from pod nginx with only one container
kubectl logs nginx

# Return snapshot of previous terminated ruby container logs from pod web-1
kubectl logs -p -c ruby web-1

# Begin streaming the logs of the ruby container in pod web-1
kubectl logs -f -c ruby web-1
```

## 连接到一个正在运行的容器

`kubectl attach` 用于连接到一个正在运行的容器。跟 docker 的 attach 命令类似。

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

## 在容器内部执行命令

`kubectl exec` 用于在一个正在运行的容器执行命令。跟 docker 的 exec 命令类似。

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

## 端口转发

`kubectl port-forward` 用于将本地端口转发到指定的 Pod。

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

也可以将本地端口转发到服务、复制控制器或者部署的端口。

```sh
# Forward to deployment
kubectl port-forward deployment/redis-master 6379:6379

# Forward to replicaSet
kubectl port-forward rs/redis-master 6379:6379

# Forward to service
kubectl port-forward svc/redis-master 6379:6379
```

## API Server 代理

`kubectl proxy` 命令提供了一个 Kubernetes API 服务的 HTTP 代理。

```sh
$ kubectl proxy --port=8080
Starting to serve on 127.0.0.1:8080
```

可以通过代理地址 `http://localhost:8080/api/` 来直接访问 Kubernetes API，比如查询 Pod 列表

```sh
curl http://localhost:8080/api/v1/namespaces/default/pods
```

注意，如果通过 `--address` 指定了非 localhost 的地址，则访问 8080 端口时会报未授权的错误，可以设置 `--accept-hosts` 来避免这个问题（** 不推荐生产环境这么设置 **）：

```sh
kubectl proxy --address='0.0.0.0' --port=8080 --accept-hosts='^*$'
```

## 文件拷贝

`kubectl cp` 支持从容器中拷贝，或者拷贝文件到容器中

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

注意：文件拷贝依赖于 tar 命令，所以容器中需要能够执行 tar 命令

## kubectl drain

```sh
kubectl drain NODE [Options]
```

- 它会删除该 NODE 上由 ReplicationController, ReplicaSet, DaemonSet, StatefulSet or Job 创建的 Pod
- 不删除 mirror pods（因为不可通过 API 删除 mirror pods）
- 如果还有其它类型的 Pod（比如不通过 RC 而直接通过 kubectl create 的 Pod）并且没有 --force 选项，该命令会直接失败
- 如果命令中增加了 --force 选项，则会强制删除这些不是通过 ReplicationController, Job 或者 DaemonSet 创建的 Pod

有的时候不需要 evict pod，只需要标记 Node 不可调用，可以用 `kubectl cordon` 命令。

恢复的话只需要运行 `kubectl uncordon NODE` 将 NODE 重新改成可调度状态。

## 权限检查

`kubectl auth` 提供了两个子命令用于检查用户的鉴权情况：

- `kubectl auth can-i` 检查用户是否有权限进行某个操作，比如

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

- `kubectl auth reconcile` 自动修复有问题的 RBAC 策略，如

```sh
  # Reconcile rbac resources from a file
  kubectl auth reconcile -f my-rbac-rules.yaml
```

## 模拟其他用户

kubectl 支持模拟其他用户或者组来进行集群管理操作，比如

```sh
kubectl drain mynode --as=superman --as-group=system:masters
```

这实际上就是在请求 Kubernetes API 时添加了如下的 HTTP HEADER：

```sh
Impersonate-User: superman
Impersonate-Group: system:masters
```

## 查看事件（events）

```sh
# 查看所有事件
kubectl get events --all-namespaces

# 查看名为nginx对象的事件
kubectl get events --field-selector involvedObject.name=nginx,involvedObject.namespace=default

# 查看名为nginx的服务事件
kubectl get events --field-selector involvedObject.name=nginx,involvedObject.namespace=default,involvedObject.kind=Service

# 查看Pod的事件
kubectl get events --field-selector involvedObject.name=nginx-85cb5867f-bs7pn,involvedObject.kind=Pod
```

## kubectl 插件

kubectl 插件提供了一种扩展 kubectl 的机制，比如添加新的子命令。插件可以以任何语言编写，只需要满足以下条件即可

- 插件放在 `~/.kube/plugins` 或环境变量 `KUBECTL_PLUGINS_PATH` 指定的目录中
- 插件的格式为 ` 子目录 / 可执行文件或脚本 ` 且子目录中要包括 `plugin.yaml` 配置文件

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

你也可以使用 [krew](../deploy/kubectl.md) 来管理 kubectl 插件。

## 原始 URI

kubectl 也可以用来直接访问原始 URI，比如要访问 [Metrics API](https://github.com/kubernetes-incubator/metrics-server) 可以

- `kubectl get --raw /apis/metrics.k8s.io/v1beta1/nodes`
- `kubectl get --raw /apis/metrics.k8s.io/v1beta1/pods`
- `kubectl get --raw /apis/metrics.k8s.io/v1beta1/nodes/<node-name>`
- `kubectl get --raw /apis/metrics.k8s.io/v1beta1/namespace/<namespace-name>/pods/<pod-name>`

## 附录

kubectl 的安装方法

```sh
# OS X
curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/darwin/amd64/kubectl

# Linux
curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/amd64/kubectl

# Windows
curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/windows/amd64/kubectl.exe
```
