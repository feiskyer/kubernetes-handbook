# Federation

在云计算环境中，服务的作用距离范围从近到远一般可以有：同主机（Host，Node）、跨主机同可用区（Available Zone）、跨可用区同地区（Region）、跨地区同服务商（Cloud Service Provider）、跨云平台。K8s 的设计定位是单一集群在同一个地域内，因为同一个地区的网络性能才能满足 K8s 的调度和计算存储连接要求。而集群联邦（Federation）就是为提供跨 Region 跨服务商 K8s 集群服务而设计的。

每个 Federation 有自己的分布式存储、API Server 和 Controller Manager。用户可以通过 Federation 的 API Server 注册该 Federation 的成员 K8s Cluster。当用户通过 Federation 的 API Server 创建、更改 API 对象时，Federation API Server 会在自己所有注册的子 K8s Cluster 都创建一份对应的 API 对象。在提供业务请求服务时，K8s Federation 会先在自己的各个子 Cluster 之间做负载均衡，而对于发送到某个具体 K8s Cluster 的业务请求，会依照这个 K8s Cluster 独立提供服务时一样的调度模式去做 K8s Cluster 内部的负载均衡。而 Cluster 之间的负载均衡是通过域名服务的负载均衡来实现的。

![](images/federation-service.png)

所有的设计都尽量不影响 K8s Cluster 现有的工作机制，这样对于每个子 K8s 集群来说，并不需要更外层的有一个 K8s Federation，也就是意味着所有现有的 K8s 代码和机制不需要因为 Federation 功能有任何变化。

![](images/federation-api-4x.png)

Federation 主要包括三个组件

- federation-apiserver：类似 kube-apiserver，但提供的是跨集群的 REST API
- federation-controller-manager：类似 kube-controller-manager，但提供多集群状态的同步机制
- kubefed：Federation 管理命令行工具

Federation 的代码维护在 <https://github.com/kubernetes/federation>。

## Federation 部署方法

### 下载 kubefed 和 kubectl

kubefed 下载

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

kubectl 的下载可以参考 [这里](kubectl.md# 附录)。

### 初始化主集群

选择一个已部署好的 Kubernetes 集群作为主集群，作为集群联邦的控制平面，并配置好本地的 kubeconfig。然后运行 `kubefed init` 命令来初始化主集群：

```sh
$ kubefed init fellowship \
    --host-cluster-context=rivendell \   # 部署集群的 kubeconfig 配置名称
    --dns-provider="google-clouddns" \   # DNS 服务提供商，还支持 aws-route53 或 coredns
    --dns-zone-name="example.com." \     # 域名后缀，必须以. 结束
    --apiserver-enable-basic-auth=true \ # 开启 basic 认证
    --apiserver-enable-token-auth=true \ # 开启 token 认证
    --apiserver-arg-overrides="--anonymous-auth=false,--v=4" # federation API server 自定义参数
$ kubectl config use-context fellowship
```

### 自定义 DNS

coredns 需要先部署一套 etcd 集群，可以用 helm 来部署：

```sh
$ helm install --namespace my-namespace --name etcd-operator stable/etcd-operator
$ helm upgrade --namespace my-namespace --set cluster.enabled=true etcd-operator stable/etcd-operator
```

然后部署 coredns

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

使用 coredns 时，还需要传入 coredns 的配置

```sh
$ cat $HOME/coredns-provider.conf
[Global]
etcd-endpoints = http://etcd-cluster.my-namespace:2379
zones = example.com.

$ kubefed init fellowship \
    --host-cluster-context=rivendell \   # 部署集群的 kubeconfig 配置名称
    --dns-provider="coredns" \           # DNS 服务提供商，还支持 aws-route53 或 google-clouddns
    --dns-zone-name="example.com." \     # 域名后缀，必须以. 结束
    --apiserver-enable-basic-auth=true \ # 开启 basic 认证
    --apiserver-enable-token-auth=true \ # 开启 token 认证
    --dns-provider-config="$HOME/coredns-provider.conf" \ # coredns 配置
    --apiserver-arg-overrides="--anonymous-auth=false,--v=4" # federation API server 自定义参数
```

### 物理机部署

默认情况下，`kubefed init` 会创建一个 LoadBalancer 类型的 federation API server 服务，这需要 Cloud Provider 的支持。在物理机部署时，可以通过 `--api-server-service-type` 选项将其改成 NodePort：

```sh
$ kubefed init fellowship \
    --host-cluster-context=rivendell \   # 部署集群的 kubeconfig 配置名称
    --dns-provider="coredns" \           # DNS 服务提供商，还支持 aws-route53 或 google-clouddns
    --dns-zone-name="example.com." \     # 域名后缀，必须以. 结束
    --apiserver-enable-basic-auth=true \ # 开启 basic 认证
    --apiserver-enable-token-auth=true \ # 开启 token 认证
    --dns-provider-config="$HOME/coredns-provider.conf" \ # coredns 配置
    --apiserver-arg-overrides="--anonymous-auth=false,--v=4" \ # federation API server 自定义参数
    --api-server-service-type="NodePort" \
    --api-server-advertise-address="10.0.10.20"
```

### 自定义 etcd 存储

默认情况下，`kubefed init` 通过动态创建 PV 的方式为 etcd 创建持久化存储。如果 kubernetes 集群不支持动态创建 PV，则可以预先创建 PV，注意 PV 要匹配 `kubefed` 的 PVC:

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

## 注册集群

除主集群外，其他 kubernetes 集群可以通过 `kubefed join` 命令加入集群联邦：

```sh
$ kubefed join gondor --host-cluster-context=rivendell --cluster-context=gondor_needs-no_king
```

## 集群查询

查询注册到 Federation 的 kubernetes 集群列表

```sh
$ kubectl --context=federation get clusters
```

## ClusterSelector

v1.7 + 支持使用 annotation `federation.alpha.kubernetes.io/cluster-selector` 为新对象选择 kubernetes 集群。该 annotation 的值是一个 json 数组，比如

```yaml
  metadata:
    annotations:
      federation.alpha.kubernetes.io/cluster-selector: '[{"key":"pci","operator":
        "In", "values": ["true"]}, {"key": "environment", "operator": "NotIn", "values":
        ["test"]}]'
```

每条记录包含三个键值

- key：集群的 label 名字
- operator：包括 In, NotIn, Exists, DoesNotExist, Gt, Lt
- values：集群的 label 值

## 策略调度

> 注：仅 v1.7 + 支持策略调度。

开启策略调度的方法

（1）创建 ConfigMap

```sh
kubectl create -f https://raw.githubusercontent.com/kubernetes/kubernetes.github.io/master/docs/tutorials/federation/scheduling-policy-admission.yaml
```

（2） 编辑 federation-apiserver

```
kubectl -n federation-system edit deployment federation-apiserver
```

增加选项：

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

（4）创建 namespace `kube-federation-scheduling-policy` 以供外部策略引擎使用

```
kubectl --context=federation create namespace kube-federation-scheduling-policy
```

（5）创建策略

```
wget https://raw.githubusercontent.com/kubernetes/kubernetes.github.io/master/docs/tutorials/federation/policy.rego
kubectl --context=federation -n kube-federation-scheduling-policy create configmap scheduling-policy --from-file=policy.rego
```

（6）验证策略

```
kubectl --context=federation annotate clusters cluster-name-1 pci-certified=true
kubectl --context=federation create -f https://raw.githubusercontent.com/kubernetes/kubernetes.github.io/master/docs/tutorials/federation/replicaset-example-policy.yaml
kubectl --context=federation get rs nginx-pci -o jsonpath='{.metadata.annotations}'
```

## 集群联邦使用

集群联邦支持以下联邦资源，这些资源会自动在所有注册的 kubernetes 集群中创建：

- Federated ConfigMap
- Federated Service
- Federated DaemonSet
- Federated Deployment
- Federated Ingress
- Federated Namespaces
- Federated ReplicaSets
- Federated Secrets
- Federated Events（仅存在 federation 控制平面）
- Federated Jobs（v1.8+）
- Federated Horizontal Pod Autoscaling (HPA，v1.8+)

比如使用 Federated Service 的方法如下：

```sh
# 这会在所有注册到联邦的 kubernetes 集群中创建服务
$ kubectl --context=federation-cluster create -f services/nginx.yaml

# 添加后端 Pod
$ for CLUSTER in asia-east1-c asia-east1-a asia-east1-b \
                        europe-west1-d europe-west1-c europe-west1-b \
                        us-central1-f us-central1-a us-central1-b us-central1-c \
                        us-east1-d us-east1-c us-east1-b
do
  kubectl --context=$CLUSTER run nginx --image=nginx:1.11.1-alpine --port=80
done

# 查看服务状态
$ kubectl --context=federation-cluster describe services nginx
```

可以通过 DNS 来访问联邦服务，访问格式包括以下几种

- `nginx.mynamespace.myfederation.`
- `nginx.mynamespace.myfederation.svc.example.com.`
- `nginx.mynamespace.myfederation.svc.us-central1.example.com.`

## 删除集群

```sh
$ kubefed unjoin gondor --host-cluster-context=rivendell
```

## 删除集群联邦

集群联邦控制平面的删除功能还在开发中，目前可以通过删除 namespace `federation-system` 的方法来清理（注意 pv 不会删除）：

```sh
$ kubectl delete ns federation-system
```

## 参考文档

- [Kubernetes federation](https://kubernetes.io/docs/concepts/cluster-administration/federation/)
- [kubefed](https://kubernetes.io/docs/tasks/federation/set-up-cluster-federation-kubefed/)
