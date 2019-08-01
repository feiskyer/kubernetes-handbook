# Jenkins X

[Jenkins X](http://jenkins-x.io/) 是一個基於 Jenkins 和 Kubernetes 的 CI/CD 平臺，旨在解決微服務架構下雲原生應用的持續集成和持續交付問題。它使用 Jenkins、Helm、Draft、GitOps 以及 Github 等工具鏈構造了一個從集群安裝、環境管理、持續集成、持續部署一直到應用發佈等支持整個流程的平臺。

## 安裝部署

### 安裝 jx 命令行工具

```sh
# MacOS
brew tap jenkins-x/jx
brew install jx 

# Linux
curl -L https://github.com/jenkins-x/jx/releases/download/v1.1.10/jx-linux-amd64.tar.gz | tar xzv 
sudo mv jx /usr/local/bin
```

### 部署 Kubernetes 集群

如果 Kubernetes 集群已經部署好了，那麼該步可以忽略。

`jx` 命令提供了在公有云中直接部署 Kubernetes 的功能，比如

```sh
create cluster aks      # Create a new kubernetes cluster on AKS: Runs on Azure
create cluster aws      # Create a new kubernetes cluster on AWS with kops
create cluster gke      # Create a new kubernetes cluster on GKE: Runs on Google Cloud
create cluster minikube # Create a new kubernetes cluster with minikube: Runs locally
```

### 部署 Jenkins X 服務

注意在安裝 Jenkins X 服務之前，Kubernetes 集群需要開啟 RBAC 並開啟 insecure docker registries（`dockerd --insecure-registry=10.0.0.0/16` ）。

運行下面的命令按照提示操作，該過程會配置

- Ingress Controller （如果沒有安裝的話）
- Ingress 公網 IP 的 DNS（默認使用 `ip.xip.io`）
- Github API token（用於創建 github repo 和 webhook）
- Jenkins-X 服務
- 創建 staging 和 production 等示例項目，包括 github repo 以及 Jenkins 配置等

```sh
jx install --provider=kubernetes
```

安裝完成後，會輸出 Jenkins 的訪問入口以及管理員的用戶名和密碼，用於登錄 Jenkins。

## 創建應用

Jenkins X 支持快速創建新的應用

```sh
# 創建 Spring Boot 應用
jx create spring -d web -d actuator

# 創建快速啟動項目
jx create quickstart  -l go
```

也支持導入已有的應用，只是需要注意導入前要保證

- 使用 Github 等 git 系統管理源碼並設置好 Jenkins webhook
- 添加 Dockerfile、Jenkinsfile 以及運行應用所需要的 Helm Chart

```sh
# 從本地導入
$ cd my-cool-app
$ jx import

# 從 Github 導入
jx import --github --org myname

# 從 URL 導入
jx import --url https://github.com/jenkins-x/spring-boot-web-example.git
```

## 發佈應用

```sh
# 發佈新版本到生產環境中
jx promote myapp --version 1.2.3 --env production
```

![](images/jenkinsx.png)

## 常用命令

```sh
# Get pipelines
jx get pipelines

# Get pipeline activities
jx get activities

# Get build logs
jx get build logs -f myapp

# Open Jenkins in brower
jx console

# Get applications
jx get applications

# Get environments
jx get environments
```

