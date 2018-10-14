# 安装命令行工具

本次实验你将会安装一些实用的命令行工具, 用来完成这份指南，这包括 [cfssl](https://github.com/cloudflare/cfssl)、[cfssljson](https://github.com/cloudflare/cfssl) 以及 [kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl)。

## 安装 CFSSL

从 [cfssl 网站](https://pkg.cfssl.org) 下载 `cfssl` 和 `cfssljson` 并安装：

### OS X

```sh
curl -o cfssl https://pkg.cfssl.org/R1.2/cfssl_darwin-amd64
curl -o cfssljson https://pkg.cfssl.org/R1.2/cfssljson_darwin-amd64
chmod +x cfssl cfssljson
sudo mv cfssl cfssljson /usr/local/bin/
```

或者使用 Homebrew 来安装

```sh
brew install cfssl
```

### Linux

```sh
wget -q --show-progress --https-only --timestamping \
  https://pkg.cfssl.org/R1.2/cfssl_linux-amd64 \
  https://pkg.cfssl.org/R1.2/cfssljson_linux-amd64
chmod +x cfssl_linux-amd64 cfssljson_linux-amd64
sudo mv cfssl_linux-amd64 /usr/local/bin/cfssl
sudo mv cfssljson_linux-amd64 /usr/local/bin/cfssljson
```

### 验证

验证 `cfssl` 的版本为 1.2.0 或是更高

```sh
cfssl version
```

> 输出为

```sh
Version: 1.2.0
Revision: dev
Runtime: go1.6
```

> 注意：cfssljson 命令行工具没有提供查询版本的方法。

## 安装 kubectl

`kubectl` 命令行工具用来与 Kubernetes API Server 交互，可以在 Kubernetes 官方网站下载并安装 `kubectl`。

### OS X

```sh
curl -o kubectl https://storage.googleapis.com/kubernetes-release/release/v1.12.0/bin/darwin/amd64/kubectl
chmod +x kubectl
sudo mv kubectl /usr/local/bin/
```

### Linux

```sh
wget https://storage.googleapis.com/kubernetes-release/release/v1.12.0/bin/linux/amd64/kubectl
chmod +x kubectl
sudo mv kubectl /usr/local/bin/
```

### 验证

验证 `kubectl` 的安装版本为 1.12.0 或是更高

```sh
kubectl version --client
```

> 输出为

```sh
Client Version: version.Info{Major:"1", Minor:"12", GitVersion:"v1.12.0", GitCommit:"0ed33881dc4355495f623c6f22e7dd0b7632b7c0", GitTreeState:"clean", BuildDate:"2018-09-27T17:05:32Z", GoVersion:"go1.10.4", Compiler:"gc", Platform:"linux/amd64"}
```

下一步： [准备计算资源](03-compute-resources.md)
