# Cloud Provider扩展

当Kubernetes集群运行在云平台内部时，Cloud Provider使得Kubernetes可以直接利用云平台实现持久化卷、负载均衡、网络路由、DNS解析以及横向扩展等功能。

## 如何开发Cloud Provider扩展

Kubernetes的Cloud Provider目前正在重构中

- v1.6 已经独立出`cloud-controller-manager`服务
- v1.7 将继续重构`cloud-controller-manager`，解耦Controller Manager与Cloud Controller的代码逻辑，为Cloud Controller独立做准备
- v1.8 Cloud Controller将独立出来

目前，可以参考`cloud-controller-manager`来开发其他的Cloud Provider。

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