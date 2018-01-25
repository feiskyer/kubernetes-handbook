# 准备环境

## Google Cloud Platform

这份指南使用了 [Google Cloud Platform](https://cloud.google.com/) 作为 kubernetes 集群的环境平台。[注册](https://cloud.google.com/free/) 即可获得300美元的试用金。

[估计](https://cloud.google.com/products/calculator/#id=78df6ced-9c50-48f8-a670-bc5003f2ddaa)完成教学的花费金额: 每小时 0.22 美元 (每天5.39 美元).

> 注意：这份教学需求的计算资源会超出试用金的额度。

## Google Cloud Platform SDK

### 安装 Google Cloud SDK

按照Google Cloud SDK [文档](https://cloud.google.com/sdk/)的步骤去安装并设置 gcloud` 命令。验证Google Cloud SDK 版本为 183.0.0 或更高:


```sh
gcloud version
```

### 设置默认 Region 和 Zone

本指南假设你的默认 Region 和 Zone 已经设置好了。如果你第一次使用`gcloud`指令工具, `init` 是一个最简单的设定方式:

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

> 使用 `gcloud compute zones list` 指令来查询其他的region 和 zone

下一步: [安装命令行工具](02-client-tools.md)
