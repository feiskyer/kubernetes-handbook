# Romana

Romana是Panic Networks在2016年提出的開源項目，旨在解決Overlay方案給網絡帶來的開銷。

## Kubernetes部署

對使用kubeadm部署的Kubernetes集群：

```sh
kubectl apply -f https://raw.githubusercontent.com/romana/romana/master/docs/kubernetes/romana-kubeadm.yml
```

對使用kops部署的Kubernetes集群:

```sh
kubectl apply -f https://raw.githubusercontent.com/romana/romana/master/docs/kubernetes/romana-kops.yml
```

使用kops時要注意

- 設置網絡插件使用CNI `--networking cni`
- 對於aws還提供`romana-aws`和`romana-vpcrouter`自動配置Node和Zone之間的路由

## 工作原理

![](romana.png)

![](routeagg.png)

- layer 3 networking，消除overlay帶來的開銷
- 基於iptables ACL的網絡隔離
- 基於hierarchy CIDR管理Host/Tenant/Segment ID

![](cidr.png)

## 優點

- 純三層網絡，性能好

## 缺點

- 基於IP管理租戶，有規模上的限制
- 物理設備變更或地址規劃變更麻煩

**參考文檔**

- <http://romana.io/>
- [Romana basics](http://romana.io/how/romana_basics/)
- [Romana Github](https://github.com/romana/romana)
- [Romana 2.0](http://romana.readthedocs.io/en/latest/index.html)

