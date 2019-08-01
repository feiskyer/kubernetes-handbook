# 安裝命令行工具

本次實驗你將會安裝一些實用的命令行工具, 用來完成這份指南，這包括 [cfssl](https://github.com/cloudflare/cfssl)、[cfssljson](https://github.com/cloudflare/cfssl) 以及 [kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl)。

## 安裝 CFSSL

從 [cfssl 網站](https://pkg.cfssl.org) 下載 `cfssl` 和 `cfssljson` 並安裝：

### OS X

```sh
curl -o cfssl https://pkg.cfssl.org/R1.2/cfssl_darwin-amd64
curl -o cfssljson https://pkg.cfssl.org/R1.2/cfssljson_darwin-amd64
chmod +x cfssl cfssljson
sudo mv cfssl cfssljson /usr/local/bin/
```

或者使用 Homebrew 來安裝

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

### 驗證

驗證 `cfssl` 的版本為 1.2.0 或是更高

```sh
cfssl version
```

> 輸出為

```sh
Version: 1.2.0
Revision: dev
Runtime: go1.6
```

> 注意：cfssljson 命令行工具沒有提供查詢版本的方法。

## 安裝 kubectl

`kubectl` 命令行工具用來與 Kubernetes API Server 交互，可以在 Kubernetes 官方網站下載並安裝 `kubectl`。

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

### 驗證

驗證 `kubectl` 的安裝版本為 1.12.0 或是更高

```sh
kubectl version --client
```

> 輸出為

```sh
Client Version: version.Info{Major:"1", Minor:"12", GitVersion:"v1.12.0", GitCommit:"0ed33881dc4355495f623c6f22e7dd0b7632b7c0", GitTreeState:"clean", BuildDate:"2018-09-27T17:05:32Z", GoVersion:"go1.10.4", Compiler:"gc", Platform:"linux/amd64"}
```

下一步： [準備計算資源](03-compute-resources.md)
