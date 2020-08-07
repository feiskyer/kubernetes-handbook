# 安装命令行工具

本次实验你将会安装一些实用的命令行工具, 用来完成这份指南，这包括 [cfssl](https://github.com/cloudflare/cfssl)、[cfssljson](https://github.com/cloudflare/cfssl) 以及 [kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl)。

## 安装 CFSSL

从 [cfssl 网站](https://pkg.cfssl.org) 下载 `cfssl` 和 `cfssljson` 并安装：

### OS X

```sh
curl -o cfssl https://storage.googleapis.com/kubernetes-the-hard-way/cfssl/1.4.1/darwin/cfssl
curl -o cfssljson https://storage.googleapis.com/kubernetes-the-hard-way/cfssl/1.4.1/darwin/cfssljson
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
  https://storage.googleapis.com/kubernetes-the-hard-way/cfssl/1.4.1/linux/cfssl \
  https://storage.googleapis.com/kubernetes-the-hard-way/cfssl/1.4.1/linux/cfssljson
chmod +x cfssl cfssljson
sudo mv cfssl cfssljson /usr/local/bin/
```

### 验证

验证 `cfssl` 的版本为 1.4.1 或是更高：

```sh
$ cfssl version
Version: 1.4.1
Runtime: go1.12.12

$ cfssljson --version
Version: 1.4.1
Runtime: go1.12.12
```

## 安装 kubectl

`kubectl` 命令行工具用来与 Kubernetes API Server 交互，可以在 Kubernetes 官方网站下载并安装 `kubectl`。

### OS X

```sh
curl -o kubectl https://storage.googleapis.com/kubernetes-release/release/v1.18.6/bin/darwin/amd64/kubectl
chmod +x kubectl
sudo mv kubectl /usr/local/bin/
```

### Linux

```sh
wget https://storage.googleapis.com/kubernetes-release/release/v1.18.6/bin/linux/amd64/kubectl
chmod +x kubectl
sudo mv kubectl /usr/local/bin/
```

### 验证

验证 `kubectl` 的安装版本为 1.18.6 或是更高

```sh
kubectl version --client
```

> 输出为

```sh
Client Version: version.Info{Major:"1", Minor:"18", GitVersion:"v1.18.6", GitCommit:"dff82dc0de47299ab66c83c626e08b245ab19037", GitTreeState:"clean", BuildDate:"2020-07-15T16:58:53Z", GoVersion:"go1.13.9", Compiler:"gc", Platform:"linux/amd64"}
```

下一步： [准备计算资源](03-compute-resources.md)
