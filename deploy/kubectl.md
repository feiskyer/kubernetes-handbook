# kubectl 安装

本章介绍 kubectl 的安装方法。

## 安装方法

### OSX

可以使用 Homebrew 或者 `curl` 下载 kubectl：

```sh
brew install kubectl
```

或者

```sh
curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/darwin/amd64/kubectl
```

### Linux

```sh
curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/amd64/kubectl
```

### Windows

```sh
curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/windows/amd64/kubectl.exe
```

或者使用 Chocolatey 来安装：

```sh
choco install kubernetes-cli
```

## 使用方法

kubectl 的详细使用方法请参考 [kubectl 指南](../components/kubectl.md)。

## kubectl 插件

你可以使用 krew 来管理 kubectl 插件。

[krew](https://github.com/GoogleContainerTools/krew) 是一个用来管理 kubectl 插件的工具，类似于 apt 或 yum，支持搜索、安装和管理 kubectl 插件。

### 安装

```sh
(
  set -x; cd "$(mktemp -d)" &&
  curl -fsSLO "https://storage.googleapis.com/krew/v0.2.1/krew.{tar.gz,yaml}" &&
  tar zxvf krew.tar.gz &&
  ./krew-"$(uname | tr '[:upper:]' '[:lower:]')_amd64" install \
    --manifest=krew.yaml --archive=krew.tar.gz
)
```

安装完成后，把 krew 的二进制文件加入环境变量 PATH 中：

```sh
export PATH="${KREW_ROOT:-$HOME/.krew}/bin:$PATH"
```

最后，再执行 kubectl 命令确认安装成功：

```sh
$ kubectl plugin list
The following kubectl-compatible plugins are available:

/home/<user>/.krew/bin/kubectl-krew
```

### 使用方法

首次使用前，请执行下面的命令更新插件索引：

```sh
kubectl krew update
```

使用示例：

```sh
kubectl krew search               # show all plugins
kubectl krew install ssh-jump  # install a plugin named "ssh-jump"
kubectl ssh-jump               # use the plugin
kubectl krew upgrade              # upgrade installed plugins
kubectl krew remove ssh-jump   # uninstall a plugin
```

在安装插件后，会输出插件所依赖的外部工具，这些工具需要你自己手动安装。

```sh
Installing plugin: ssh-jump
CAVEATS:
\
 |  This plugin needs the following programs:
 |  * ssh(1)
 |  * ssh-agent(1)
 |
 |  Please follow the documentation: https://github.com/yokawasa/kubectl-plugin-ssh-jump
/
Installed plugin: ssh-jump
```

最后，就可以通过 `kubectl <plugin-name>` 来使用插件了：

```sh
kubectl ssh-jump <node-name> -u <username> -i ~/.ssh/id_rsa -p ~/.ssh/id_rsa.pub
```

### 升级方法

```sh
kubectl krew upgrade
```

## 参考文档

- <https://github.com/GoogleContainerTools/krew>