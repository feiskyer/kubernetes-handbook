# 安装命令行工具

本次实验你将会安装一些实用的命令行工具, 用来完成这份指南，这包括 [cfssl](https://github.com/cloudflare/cfssl)、[cfssljson](https://github.com/cloudflare/cfssl) 以及 [kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl)。

从 [cfssl 网站](https://pkg.cfssl.org)下载 `cfssl` 和 `cfssljson` 并安装：

### OS X

```sh
curl -o cfssl https://pkg.cfssl.org/R1.2/cfssl_darwin-amd64
curl -o cfssljson https://pkg.cfssl.org/R1.2/cfssljson_darwin-amd64
```

```sh
chmod +x cfssl cfssljson
```

```sh
sudo mv cfssl cfssljson /usr/local/bin/
```

### Linux

```sh
wget -q --show-progress --https-only --timestamping \
  https://pkg.cfssl.org/R1.2/cfssl_linux-amd64 \
  https://pkg.cfssl.org/R1.2/cfssljson_linux-amd64
```

```sh
chmod +x cfssl_linux-amd64 cfssljson_linux-amd64
```

```sh
sudo mv cfssl_linux-amd64 /usr/local/bin/cfssl
```

```sh
sudo mv cfssljson_linux-amd64 /usr/local/bin/cfssljson
```

### 验证

验证`cfssl`的版本为 1.2.0 或是更高

```sh
cfssl version
```

> 输出为

```sh
Version: 1.2.0
Revision: dev
Runtime: go1.6
```

> 注意：cfssljson 的指令工具没有提供方法来列出版本。

## 安装kubectl

`kubectl` 命令行工具是用来与 Kubernetes API Server 沟通的，下载并安装`kubectl` 可在官方取得

### OS X

```sh
curl -o kubectl https://storage.googleapis.com/kubernetes-release/release/v1.9.0/bin/darwin/amd64/kubectl
```

```sh
chmod +x kubectl
```

```sh
sudo mv kubectl /usr/local/bin/
```

### Linux

```sh
wget https://storage.googleapis.com/kubernetes-release/release/v1.9.0/bin/linux/amd64/kubectl
chmod +x kubectl
sudo mv kubectl /usr/local/bin/
```

### 验证

验证 `kubectl` 的安装版本为 1.9.0 或是更高

```sh
kubectl version --client
```

> 输出为

```sh
Client Version: version.Info{Major:"1", Minor:"9", GitVersion:"v1.9.0", GitCommit:"925c127ec6b946659ad0fd596fa959be43f0cc05", GitTreeState:"clean", BuildDate:"2017-12-15T21:07:38Z", GoVersion:"go1.9.2", Compiler:"gc", Platform:"darwin/amd64"}
```

下一步： [准备计算资源](03-compute-resources.md)
