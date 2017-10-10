# Cloud Provider扩展

当Kubernetes集群运行在云平台内部时，Cloud Provider使得Kubernetes可以直接利用云平台实现持久化卷、负载均衡、网络路由、DNS解析以及横向扩展等功能。

## 常见Cloud Provider

Kubenretes内置的Cloud Provider包括

- GCE
- AWS
- Azure
- Mesos
- OpenStack
- CloudStack
- Ovirt
- Photon
- Rackspace
- Vsphere

## 如何开发Cloud Provider扩展

Kubernetes的Cloud Provider目前正在重构中

- v1.6添加了独立的`cloud-controller-manager`服务，云提供商可以构建自己的`cloud-controller-manager`而无须修改Kubernetes核心代码
- v1.7和v1.8进一步重构`cloud-controller-manager`，解耦了Controller Manager与Cloud Controller的代码逻辑

构建一个新的云提供商的Cloud Provider步骤为

- 编写实现[cloudprovider.Interface](https://github.com/kubernetes/kubernetes/blob/master/pkg/cloudprovider/cloud.go)的cloudprovider代码
- 将该cloudprovider链接到`cloud-controller-manager`
  - 在`cloud-controller-manager`中导入新的cloudprovider：`import "pkg/new-cloud-provider"`
  - 初始化时传入新cloudprovider的名字，如`cloudprovider.InitCloudProvider("rancher", s.CloudConfigFile)`
- 配置kube-controller-manager `--cloud-provider=external`
- 启动`cloud-controller-manager`

具体实现方法可以参考[rancher-cloud-controller-manager](https://github.com/rancher/rancher-cloud-controller-manager) 和 [cloud-controller-manager](https://github.com/kubernetes/kubernetes/blob/master/cmd/cloud-controller-manager/controller-manager.go)。

