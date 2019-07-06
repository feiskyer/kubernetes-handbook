# Serverless

Serverless，即无服务器架构，将大家从服务器中解放了出来，只需要关注业务逻辑本身。用户只需要关注数据和业务逻辑，无需维护服务器，也不需要关心系统的容量和扩容。Serverless 本质上是一种更简单易用的 PaaS，包含两种含义：

仅依赖云端服务来管理业务逻辑和状态的应用或服务，一般称为 BaaS (Backend as a Service)
事件驱动且短时执行应用或服务，其主要逻辑由开发者完成，但由第三方管理（比如 AWS Lambda），一般称为 FaaS (Function as a Service)。目前大火的 Serverless 一般是指 FaaS。

引入 serverless 可以给应用开发者带来明显的好处

- 用户无需配置和管理服务器
- 用户服务不需要基于特定框架或软件库
- 部署简单，只需要将代码上传到 serverless 平台即可
- 完全自动化的横向扩展
- 事件触发，比如 http 请求触发、文件更新触发、时间触发、消息触发等
- 低成本，比如 AWS Lambda 按执行时间和触发次数收费，在代码未运行时无需付费

当然，serverless 也并非银弹，也有其特有的局限性

- 无状态，服务的任何进程内或主机状态均无法被后续调用所使用，需要借助外部数据库或网络存储管理状态
- 每次函数调用的时间一般都有限制，比如 AWS Lambda 限制每个函数最长只能运行 5 分钟
- 启动延迟，特别是应用不活跃或者突发流量的情况下延迟尤为明显
- 平台依赖，比如服务发现、监控、调试、API Gateway 等都依赖于 serverless 平台提供的功能

## 开源框架

- OpenFaas: https://github.com/openfaas/faas
- Fission: https://github.com/fission/fission
- Kubeless: https://github.com/kubeless/kubeless
- OpenWhisk: https://github.com/apache/incubator-openwhisk
- Fn: https://fnproject.io/

## 商业产品

- AWS Lambda: http://docs.aws.amazon.com/lambda/latest/dg/welcome.html
- AWS Fargate: https://aws.amazon.com/cn/fargate/
- Azure Container Instance (ACI): https://azure.microsoft.com/zh-cn/services/container-instances/
- Azure Functions: https://azure.microsoft.com/zh-cn/services/functions/
- Google Cloud Functions: https://cloud.google.com/functions/
- Huawei CCI: https://www.huaweicloud.com/product/cci.html
- Aliyun Serverless Kubernetes: https://help.aliyun.com/document_detail/71480.html

很多商业产品也可以与 Kubernetes 进行无缝集成，即通过 [Virtual Kubelet](https://github.com/virtual-kubelet/virtual-kubelet) 将商业 Serverless 产品（如 ACI 和 Fargate等）作为 Kubernetes 集群的一个无限 Node 使用，这样就无需考虑 Node 数量的问题。

![](images/virtual-kubelet.png)

## 参考文档

- [Awesome Serverless](https://github.com/anaibol/awesome-serverless)
- [AWS Lambda](http://docs.aws.amazon.com/lambda/latest/dg/welcome.html)
- [Serverless Architectures](https://martinfowler.com/articles/serverless.html)
- [TNS Guide to Serverless Technologies](http://thenewstack.io/tns-guide-serverless-technologies-best-frameworks-platforms-tools/)
- [Serverless blogs and posts](https://github.com/JustServerless/awesome-serverless)
