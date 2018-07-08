# kubectl 安装

本章介绍 kubectl 的安装方法。

## OSX

可以使用 Homebrew 或者 `curl` 下载 kubectl：

```sh
brew install kubectl
```

或者

```sh
curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/darwin/amd64/kubectl
```

## Linux

```sh
curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/amd64/kubectl
```

## Windows

```sh
curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/windows/amd64/kubectl.exe
```

或者使用 Chocolatey 来安装：

```sh
choco install kubernetes-cli
```

## kubectl 使用方法

kubectl 的详细使用方法请参考 [kubectl 指南](../components/kubectl.md)。
