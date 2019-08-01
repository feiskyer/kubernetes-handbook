# Kubernetes 集群

![](architecture.png)

一個 Kubernetes 集群由分佈式存儲 etcd、控制節點 controller 以及服務節點 Node 組成。

- 控制節點主要負責整個集群的管理，比如容器的調度、維護資源的狀態、自動擴展以及滾動更新等
- 服務節點是真正運行容器的主機，負責管理鏡像和容器以及 cluster 內的服務發現和負載均衡
- etcd 集群保存了整個集群的狀態

詳細的介紹請參考 [Kubernetes 架構](../architecture/architecture.md)。

## 集群聯邦

集群聯邦（Federation）用於跨可用區的 Kubernetes 集群，需要配合雲服務商（如 GCE、AWS）一起實現。

![](federation.png)

詳細的介紹請參考 [Federation](../components/federation.md)。

## 創建 Kubernetes 集群

可以參考 [Kubernetes 部署指南](../deploy/index.md) 來部署一套 Kubernetes 集群。而對於初學者或者簡單驗證測試的用戶，則可以使用以下幾種更簡單的方法。

### minikube

創建 Kubernetes cluster（單機版）最簡單的方法是 [minikube](https://github.com/kubernetes/minikube):

```sh
$ minikube start
Starting local Kubernetes cluster...
Kubectl is now configured to use the cluster.
$ kubectl cluster-info
Kubernetes master is running at https://192.168.64.12:8443
kubernetes-dashboard is running at https://192.168.64.12:8443/api/v1/proxy/namespaces/kube-system/services/kubernetes-dashboard

To further debug and diagnose cluster problems, use 'kubectl cluster-info dump'.
```

### play-with-k8s

[Play with Kubernetes](http://play-with-k8s.com) 提供了一個免費的 Kubernetes 體驗環境，直接訪問 < http://play-with-k8s.com > 就可以使用 kubeadm 來創建 Kubernetes 集群。注意，每次創建的集群最長可以使用 4 小時。

Play with Kubernetes 有個非常方便的功能：自動在頁面上顯示所有 NodePort 類型服務的端口，點擊該端口即可訪問對應的服務。

詳細使用方法可以參考 [Play-With-Kubernetes](../appendix/play-with-k8s.md)。

### Katacoda playground

[Katacoda playground](https://www.katacoda.com/courses/kubernetes/playground)也提供了一個免費的 2 節點 Kubernetes 體驗環境，網絡基於 WeaveNet，並且會自動部署整個集群。但要注意，剛打開 [Katacoda playground](https://www.katacoda.com/courses/kubernetes/playground) 頁面時集群有可能還沒初始化完成，可以在 master 節點上運行 `launch.sh` 等待集群初始化完成。

部署並訪問 kubernetes dashboard 的方法：

```sh
# 在 master node 上面運行
kubectl create -f https://raw.githubusercontent.com/kubernetes/dashboard/v1.10.1/src/deploy/recommended/kubernetes-dashboard.yaml
kubectl proxy --address='0.0.0.0' --port=8080 --accept-hosts='^*$'&
```

然後點擊 Terminal Host 1 右邊的➕，從彈出的菜單裡選擇 View HTTP port 8080 on Host 1，即可打開 Kubernetes 的 API 頁面。在該網址後面增加 `/ui` 即可訪問 dashboard。
