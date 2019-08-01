# Skaffold

[Skaffold](https://github.com/GoogleCloudPlatform/skaffold) 是谷歌開源的簡化本地 Kubernetes 應用開發的工具。它將構建鏡像、推送鏡像以及部署 Kubernetes 服務等流程自動化，可以方便地對 Kubernetes 應用進行持續開發。其功能特點包括

- 沒有服務器組件
- 自動檢測代碼更改並自動構建、推送和部署服務
- 自動管理鏡像標籤
- 支持已有工作流
- 保存文件即部署

![](images/skaffold1.png)

## 安裝

```sh
# Linux
curl -Lo skaffold https://storage.googleapis.com/skaffold/releases/latest/skaffold-linux-amd64 && chmod +x skaffold && sudo mv skaffold /usr/local/bin

# MacOS
curl -Lo skaffold https://storage.googleapis.com/skaffold/releases/latest/skaffold-darwin-amd64 && chmod +x skaffold && sudo mv skaffold /usr/local/bin
```

## 使用

在使用 skaffold 之前需要確保

- Kubernetes 集群已部署並配置好本地 kubectl 命令行
- 本地 Docker 處於運行狀態並登錄 DockerHub 或其他的 Docker Registry
- skaffold 命令行已下載並放到系統 PATH 路徑中

skaffold 代碼庫提供了一些列的[示例](https://github.com/GoogleCloudPlatform/skaffold/tree/master/examples)，我們來看一個最簡單的。

下載示例應用：

```sh
$ git clone https://github.com/GoogleCloudPlatform/skaffold
$ cd skaffold/examples/getting-started
```

修改 `k8s-pod.yaml` 和 `skaffold.yaml` 文件中的鏡像，將 `gcr.io/k8s-skaffold` 替換為已登錄的 Docker Registry。然後運行 skaffold

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

此時，打開另外一個終端，修改 `main.go` 的內容後 skaffold 會自動執行

- 構建一個新的鏡像（帶有不同的 sha256 TAG）
- 修改 `k8s-pod.yaml` 文件中的鏡像為新的 TAG
- 重新部署 `k8s-pod.yaml` 
