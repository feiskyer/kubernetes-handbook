# kubectl客户端

kubectl的安装方法

## OSX

可以使用Homebrew或者curl下载kubectl

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

## kubectl使用方法

kubectl的详细使用方法请参考[kubectl指南](../components/kubectl.md)。
