# 准备环境

## Google Cloud Platform

该指南使用 [Google Cloud Platform](https://cloud.google.com/) 作为 kubernetes 集群的环境平台。[注册](https://cloud.google.com/free/) 即可获得 300 美元的试用金。

[估计](https://cloud.google.com/products/calculator/#id=78df6ced-9c50-48f8-a670-bc5003f2ddaa) 完成教学的花费金额: 每小时 0.22 美元 (每天 5.39 美元).

> 注意：该教程所需要的计算资源会超出 GCP 免费额度。

## Google Cloud Platform SDK

### 安装 Google Cloud SDK

按照 Google Cloud SDK [文档](https://cloud.google.com/sdk/) 的步骤去安装并设置 gcloud` 命令。验证 Google Cloud SDK 版本为 218.0.0 或更高:


```sh
gcloud version
```

### 设置默认 Region 和 Zone

本指南假设你的默认 Region 和 Zone 已经设置好了。如果你第一次使用 `gcloud` 指令工具, `init` 是一个最简单的设定方式:

```sh
gcloud init
```

或者，执行下面的命令手动设定 default compute region:

```sh
gcloud config set compute/region us-west1
```

手动设定 compute zone

```sh
gcloud config set compute/zone us-west1-c
```

> 使用 `gcloud compute zones list` 指令来查询其他的 region 和 zone。

## 使用 tmux 并行执行命令

[tmux](https://github.com/tmux/tmux/wiki) 可以用来在多个虚拟机中并行执行命令。该教程中的某些步骤需要在多台虚拟机中操作，此时可以考虑使用 tmux 来加速执行过程。

> tmux 是可选的，不是该教程的必要工具。

![](images/tmux-screenshot.png)

> 开启 tmux 同步的方法：按下 `ctrb+b` 和 `shift`，接着输入 `set synchronize-panes on`。关闭同步可以输入 `set synchronize-panes off`。

下一步: [安装命令行工具](02-client-tools.md)
