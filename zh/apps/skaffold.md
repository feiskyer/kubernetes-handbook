# Skaffold

[Skaffold](https://github.com/GoogleCloudPlatform/skaffold) 是谷歌开源的简化本地 Kubernetes 应用开发的工具。它将构建镜像、推送镜像以及部署 Kubernetes 服务等流程自动化，可以方便地对 Kubernetes 应用进行持续开发。其功能特点包括

- 没有服务器组件
- 自动检测代码更改并自动构建、推送和部署服务
- 自动管理镜像标签
- 支持已有工作流
- 保存文件即部署

![](images/skaffold1.png)

## 安装

```sh
# Linux
curl -Lo skaffold https://storage.googleapis.com/skaffold/releases/latest/skaffold-linux-amd64 && chmod +x skaffold && sudo mv skaffold /usr/local/bin

# MacOS
curl -Lo skaffold https://storage.googleapis.com/skaffold/releases/latest/skaffold-darwin-amd64 && chmod +x skaffold && sudo mv skaffold /usr/local/bin
```

## 使用

在使用 skaffold 之前需要确保

- Kubernetes 集群已部署并配置好本地 kubectl 命令行
- 本地 Docker 处于运行状态并登录 DockerHub 或其他的 Docker Registry
- skaffold 命令行已下载并放到系统 PATH 路径中

skaffold 代码库提供了一些列的[示例](https://github.com/GoogleCloudPlatform/skaffold/tree/master/examples)，我们来看一个最简单的。

下载示例应用：

```sh
$ git clone https://github.com/GoogleCloudPlatform/skaffold
$ cd skaffold/examples/getting-started
```

修改 `k8s-pod.yaml` 和 `skaffold.yaml` 文件中的镜像，将 `gcr.io/k8s-skaffold` 替换为已登录的 Docker Registry。然后运行 skaffold

```sh
$ skaffold dev
Starting build...
Found [minikube] context, using local docker daemon.
Sending build context to Docker daemon  6.144kB
Step 1/5 : FROM golang:1.9.4-alpine3.7
 ---> fb6e10bf973b
Step 2/5 : WORKDIR /go/src/github.com/GoogleCloudPlatform/skaffold/examples/getting-started
 ---> Using cache
 ---> e9d19a54595b
Step 3/5 : CMD ./app
 ---> Using cache
 ---> 154b6512c4d9
Step 4/5 : COPY main.go .
 ---> Using cache
 ---> e097086e73a7
Step 5/5 : RUN go build -o app main.go
 ---> Using cache
 ---> 9c4622e8f0e7
Successfully built 9c4622e8f0e7
Successfully tagged 930080f0965230e824a79b9e7eccffbd:latest
Successfully tagged gcr.io/k8s-skaffold/skaffold-example:9c4622e8f0e7b5549a61a503bf73366a9cf7f7512aa8e9d64f3327a3c7fded1b
Build complete in 657.426821ms
Starting deploy...
Deploying k8s-pod.yaml...
Deploy complete in 173.770268ms
[getting-started] Hello world!
```

此时，打开另外一个终端，修改 `main.go` 的内容后 skaffold 会自动执行

- 构建一个新的镜像（带有不同的 sha256 TAG）
- 修改 `k8s-pod.yaml` 文件中的镜像为新的 TAG
- 重新部署 `k8s-pod.yaml` 
