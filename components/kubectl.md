# kubectl

kubectl是Kubernetes的命令行工具（CLI），是Kubernetes用户和管理员必备的管理工具。

kubectl提供了大量的子命令，方便管理Kubernetes集群中的各种功能。这里不再罗列各种子命令的格式，而是介绍下如何查询命令的帮助

- `kubectl -h`查看子命令列表
- `kubectl options`查看全局选项
- `kubectl <command> --help`查看子命令的帮助
- `kubectl [command] [PARAMS] -o=<format>`设置输出格式（如json、yaml、jsonpath等）

## 配置

使用kubectl的第一步是配置Kubernetes集群以及认证方式，包括

- cluster信息：Kubernetes server地址
- 用户信息：用户名、密码或密钥
- Context：cluster和用户信息的组合

示例

```sh
$ kubectl config set-credentials myself --username=admin --password=secret
$ kubectl config set-cluster local-server --server=http://localhost:8080
$ kubectl config set-context default-context --cluster=local-server --user=myself --namespace=default
$ kubectl config use-context default-context
$ kubectl config view
```

## 常用命令格式

- 创建：`kubectl run <name> --image=<image>`或者`kubectl create -f manifest.yaml`
- 查询：`kubectl get <resource>`
- 更新
- 删除：`kubectl delete <resource> <name>`或者`kubectl delete -f manifest.yaml`
- 查询Pod IP：`kubectl get pod <pod-name> -o jsonpath='{.status.podIP}'`
- 容器内执行命令：`kubectl exec -ti <pod-name> sh`
- 容器日志：`kubectl logs [-f] <pod-name>`
- 导出服务：`kubectl expose deploy <name> --port=80`

注意，`kubectl run`仅支持Pod、Replication Controller、Deployment、Job和CronJob等几种资源。具体的资源类型是由参数决定的，默认为Deployment：

|创建的资源类型|参数|
|------------|---|
|Pod|`--restart=Never`|
|Replication Controller|`--generator=run/v1`|
|Deployment|`--restart=Always`|
|Job|`--restart=OnFailure`|
|CronJob|`--schedule=<cron>`|



## 命令行自动补全

Linux系统Bash：

```sh
source /usr/share/bash-completion/bash_completion
source <(kubectl completion bash)
```

MacOS zsh

```sh
source <(kubectl completion zsh)
```

## 端口转发

`kubectl port-forward`用于将本地端口转发到指定的Pod。

```sh
# Listen on port 8888 locally, forwarding to 5000 in the pod
kubectl port-forward mypod 8888:5000
```

## kubectl proxy

kubectl proxy命令提供了一个Kubernetes API服务的HTTP代理。

```sh
$ kubectl proxy --port=8080
Starting to serve on 127.0.0.1:8080
```

可以通过代理地址`http://localhost:8080/api/`来直接访问Kubernetes API，比如查询Pod列表

```sh
curl http://localhost:8080/api/v1/namespaces/default/pods
```

## 附录

kubectl的安装方法

```sh
# OS X
curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/darwin/amd64/kubectl

# Linux
curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/amd64/kubectl

# Windows
curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/windows/amd64/kubectl.exe
```
