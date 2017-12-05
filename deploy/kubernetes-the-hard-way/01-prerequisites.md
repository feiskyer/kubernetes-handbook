
# 事前準备

## Google Cloud Platform

这份教学文件使用了[Google Cloud Platform](https://cloud.google.com/)当作kubernetes丛集的环境平台。[注册](https://cloud.google.com/free/) 即可获得300美元的试用金。
[估计](https://cloud.google.com/products/calculator/#id=78df6ced-9c50-48f8-a670-bc5003f2ddaa)完成教学的花费金额: 每小时$0.22 (每天$5.39 ).

> 这份教学需求的计算资源会超出试用金的额度。

## Google Cloud Platform SDK

### 安装 Google Cloud SDK
按照Google Cloud SDK [documentation](https://cloud.google.com/sdk/)的步骤去安装以及设定`gcloud`的指令
验证Google Cloud SDK 版本为 173.0.0 或更高:


```
gcloud version
```

### 设定一个 Default Compute Region 和 Zone

这个部份假设你的 defalut compute region 与 zone都已经被设定好了

如果你第一次使用`gcloud`指令工具,`init` 是一个最简单的设定方式:

```
gcloud init
```

手动设定default compute region:

```
gcloud config set compute/region us-west1
```
设定compute zone
```
gcloud config set compute/zone us-west1-c
```

> 使用 `gcloud compute zones list` 指令来查询 其他的region 和 zone

Next: [安装 Client 工具](02-client-tools.md)


