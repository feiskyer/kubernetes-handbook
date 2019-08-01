# Federation

在雲計算環境中，服務的作用距離範圍從近到遠一般可以有：同主機（Host，Node）、跨主機同可用區（Available Zone）、跨可用區同地區（Region）、跨地區同服務商（Cloud Service Provider）、跨雲平臺。K8s 的設計定位是單一集群在同一個地域內，因為同一個地區的網絡性能才能滿足 K8s 的調度和計算存儲連接要求。而集群聯邦（Federation）就是為提供跨 Region 跨服務商 K8s 集群服務而設計的。

每個 Federation 有自己的分佈式存儲、API Server 和 Controller Manager。用戶可以通過 Federation 的 API Server 註冊該 Federation 的成員 K8s Cluster。當用戶通過 Federation 的 API Server 創建、更改 API 對象時，Federation API Server 會在自己所有註冊的子 K8s Cluster 都創建一份對應的 API 對象。在提供業務請求服務時，K8s Federation 會先在自己的各個子 Cluster 之間做負載均衡，而對於發送到某個具體 K8s Cluster 的業務請求，會依照這個 K8s Cluster 獨立提供服務時一樣的調度模式去做 K8s Cluster 內部的負載均衡。而 Cluster 之間的負載均衡是通過域名服務的負載均衡來實現的。

![](images/federation-service.png)

所有的設計都儘量不影響 K8s Cluster 現有的工作機制，這樣對於每個子 K8s 集群來說，並不需要更外層的有一個 K8s Federation，也就是意味著所有現有的 K8s 代碼和機制不需要因為 Federation 功能有任何變化。

![](images/federation-api-4x.png)

Federation 主要包括三個組件

- federation-apiserver：類似 kube-apiserver，但提供的是跨集群的 REST API
- federation-controller-manager：類似 kube-controller-manager，但提供多集群狀態的同步機制
- kubefed：Federation 管理命令行工具

Federation 的代碼維護在 <https://github.com/kubernetes/federation>。

## Federation 部署方法

### 下載 kubefed 和 kubectl

kubefed 下載

```sh
# Linux
curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/kubernetes-client-linux-amd64.tar.gz
tar -xzvf kubernetes-client-linux-amd64.tar.gz

# OS X
curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/kubernetes-client-darwin-amd64.tar.gz
tar -xzvf kubernetes-client-darwin-amd64.tar.gz

# Windows
curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/kubernetes-client-windows-amd64.tar.gz
tar -xzvf kubernetes-client-windows-amd64.tar.gz
```

kubectl 的下載可以參考 [這裡](kubectl.md# 附錄)。

### 初始化主集群

選擇一個已部署好的 Kubernetes 集群作為主集群，作為集群聯邦的控制平面，並配置好本地的 kubeconfig。然後運行 `kubefed init` 命令來初始化主集群：

```sh
$ kubefed init fellowship \
    --host-cluster-context=rivendell \   # 部署集群的 kubeconfig 配置名稱
    --dns-provider="google-clouddns" \   # DNS 服務提供商，還支持 aws-route53 或 coredns
    --dns-zone-name="example.com." \     # 域名後綴，必須以. 結束
    --apiserver-enable-basic-auth=true \ # 開啟 basic 認證
    --apiserver-enable-token-auth=true \ # 開啟 token 認證
    --apiserver-arg-overrides="--anonymous-auth=false,--v=4" # federation API server 自定義參數
$ kubectl config use-context fellowship
```

### 自定義 DNS

coredns 需要先部署一套 etcd 集群，可以用 helm 來部署：

```sh
$ helm install --namespace my-namespace --name etcd-operator stable/etcd-operator
$ helm upgrade --namespace my-namespace --set cluster.enabled=true etcd-operator stable/etcd-operator
```

然後部署 coredns

```sh
$ cat Values.yaml
isClusterService: false
serviceType: "LoadBalancer"
middleware:
  kubernetes:
    enabled: false
  etcd:
    enabled: true
    zones:
    - "example.com."
    endpoint: "http://etcd-cluster.my-namespace:2379"

$ helm install --namespace my-namespace --name coredns -f Values.yaml stable/coredns
```

使用 coredns 時，還需要傳入 coredns 的配置

```sh
$ cat $HOME/coredns-provider.conf
[Global]
etcd-endpoints = http://etcd-cluster.my-namespace:2379
zones = example.com.

$ kubefed init fellowship \
    --host-cluster-context=rivendell \   # 部署集群的 kubeconfig 配置名稱
    --dns-provider="coredns" \           # DNS 服務提供商，還支持 aws-route53 或 google-clouddns
    --dns-zone-name="example.com." \     # 域名後綴，必須以. 結束
    --apiserver-enable-basic-auth=true \ # 開啟 basic 認證
    --apiserver-enable-token-auth=true \ # 開啟 token 認證
    --dns-provider-config="$HOME/coredns-provider.conf" \ # coredns 配置
    --apiserver-arg-overrides="--anonymous-auth=false,--v=4" # federation API server 自定義參數
```

### 物理機部署

默認情況下，`kubefed init` 會創建一個 LoadBalancer 類型的 federation API server 服務，這需要 Cloud Provider 的支持。在物理機部署時，可以通過 `--api-server-service-type` 選項將其改成 NodePort：

```sh
$ kubefed init fellowship \
    --host-cluster-context=rivendell \   # 部署集群的 kubeconfig 配置名稱
    --dns-provider="coredns" \           # DNS 服務提供商，還支持 aws-route53 或 google-clouddns
    --dns-zone-name="example.com." \     # 域名後綴，必須以. 結束
    --apiserver-enable-basic-auth=true \ # 開啟 basic 認證
    --apiserver-enable-token-auth=true \ # 開啟 token 認證
    --dns-provider-config="$HOME/coredns-provider.conf" \ # coredns 配置
    --apiserver-arg-overrides="--anonymous-auth=false,--v=4" \ # federation API server 自定義參數
    --api-server-service-type="NodePort" \
    --api-server-advertise-address="10.0.10.20"
```

### 自定義 etcd 存儲

默認情況下，`kubefed init` 通過動態創建 PV 的方式為 etcd 創建持久化存儲。如果 kubernetes 集群不支持動態創建 PV，則可以預先創建 PV，注意 PV 要匹配 `kubefed` 的 PVC:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  annotations:
    volume.alpha.kubernetes.io/storage-class: "yes"
  labels:
    app: federated-cluster
  name: fellowship-federation-apiserver-etcd-claim
  namespace: federation-system
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```

## 註冊集群

除主集群外，其他 kubernetes 集群可以通過 `kubefed join` 命令加入集群聯邦：

```sh
$ kubefed join gondor --host-cluster-context=rivendell --cluster-context=gondor_needs-no_king
```

## 集群查詢

查詢註冊到 Federation 的 kubernetes 集群列表

```sh
$ kubectl --context=federation get clusters
```

## ClusterSelector

v1.7 + 支持使用 annotation `federation.alpha.kubernetes.io/cluster-selector` 為新對象選擇 kubernetes 集群。該 annotation 的值是一個 json 數組，比如

```yaml
  metadata:
    annotations:
      federation.alpha.kubernetes.io/cluster-selector: '[{"key":"pci","operator":
        "In", "values": ["true"]}, {"key": "environment", "operator": "NotIn", "values":
        ["test"]}]'
```

每條記錄包含三個鍵值

- key：集群的 label 名字
- operator：包括 In, NotIn, Exists, DoesNotExist, Gt, Lt
- values：集群的 label 值

## 策略調度

> 注：僅 v1.7 + 支持策略調度。

開啟策略調度的方法

（1）創建 ConfigMap

```sh
kubectl create -f https://raw.githubusercontent.com/kubernetes/kubernetes.github.io/master/docs/tutorials/federation/scheduling-policy-admission.yaml
```

（2） 編輯 federation-apiserver

```
kubectl -n federation-system edit deployment federation-apiserver
```

增加選項：

```
--admission-control=SchedulingPolicy
--admission-control-config-file=/etc/kubernetes/admission/config.yml
```

增加 volume：

```
- name: admission-config
  configMap:
    name: admission
```

增加 volumeMounts:

```
volumeMounts:
- name: admission-config
  mountPath: /etc/kubernetes/admission
```

（3）部署外部策略引擎，如 [Open Policy Agent (OPA)](http://www.openpolicyagent.org)

```
kubectl create -f https://raw.githubusercontent.com/kubernetes/kubernetes.github.io/master/docs/tutorials/federation/policy-engine-service.yaml
kubectl create -f https://raw.githubusercontent.com/kubernetes/kubernetes.github.io/master/docs/tutorials/federation/policy-engine-deployment.yaml
```

（4）創建 namespace `kube-federation-scheduling-policy` 以供外部策略引擎使用

```
kubectl --context=federation create namespace kube-federation-scheduling-policy
```

（5）創建策略

```
wget https://raw.githubusercontent.com/kubernetes/kubernetes.github.io/master/docs/tutorials/federation/policy.rego
kubectl --context=federation -n kube-federation-scheduling-policy create configmap scheduling-policy --from-file=policy.rego
```

（6）驗證策略

```
kubectl --context=federation annotate clusters cluster-name-1 pci-certified=true
kubectl --context=federation create -f https://raw.githubusercontent.com/kubernetes/kubernetes.github.io/master/docs/tutorials/federation/replicaset-example-policy.yaml
kubectl --context=federation get rs nginx-pci -o jsonpath='{.metadata.annotations}'
```

## 集群聯邦使用

集群聯邦支持以下聯邦資源，這些資源會自動在所有註冊的 kubernetes 集群中創建：

- Federated ConfigMap
- Federated Service
- Federated DaemonSet
- Federated Deployment
- Federated Ingress
- Federated Namespaces
- Federated ReplicaSets
- Federated Secrets
- Federated Events（僅存在 federation 控制平面）
- Federated Jobs（v1.8+）
- Federated Horizontal Pod Autoscaling (HPA，v1.8+)

比如使用 Federated Service 的方法如下：

```sh
# 這會在所有註冊到聯邦的 kubernetes 集群中創建服務
$ kubectl --context=federation-cluster create -f services/nginx.yaml

# 添加後端 Pod
$ for CLUSTER in asia-east1-c asia-east1-a asia-east1-b \
                        europe-west1-d europe-west1-c europe-west1-b \
                        us-central1-f us-central1-a us-central1-b us-central1-c \
                        us-east1-d us-east1-c us-east1-b
do
  kubectl --context=$CLUSTER run nginx --image=nginx:1.11.1-alpine --port=80
done

# 查看服務狀態
$ kubectl --context=federation-cluster describe services nginx
```

可以通過 DNS 來訪問聯邦服務，訪問格式包括以下幾種

- `nginx.mynamespace.myfederation.`
- `nginx.mynamespace.myfederation.svc.example.com.`
- `nginx.mynamespace.myfederation.svc.us-central1.example.com.`

## 刪除集群

```sh
$ kubefed unjoin gondor --host-cluster-context=rivendell
```

## 刪除集群聯邦

集群聯邦控制平面的刪除功能還在開發中，目前可以通過刪除 namespace `federation-system` 的方法來清理（注意 pv 不會刪除）：

```sh
$ kubectl delete ns federation-system
```

## 參考文檔

- [Kubernetes federation](https://kubernetes.io/docs/concepts/cluster-administration/federation/)
- [kubefed](https://kubernetes.io/docs/tasks/federation/set-up-cluster-federation-kubefed/)
