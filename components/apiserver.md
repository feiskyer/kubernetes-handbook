# API Server

kube-apiserver 是 Kubernetes 最重要的核心組件之一，主要提供以下的功能

- 提供集群管理的 REST API 接口，包括認證授權、數據校驗以及集群狀態變更等
- 提供其他模塊之間的數據交互和通信的樞紐（其他模塊通過 API Server 查詢或修改數據，只有 API Server 才直接操作 etcd）

## REST API

kube-apiserver 支持同時提供 https（默認監聽在 6443 端口）和 http API（默認監聽在 127.0.0.1 的 8080 端口），其中 http API 是非安全接口，不做任何認證授權機制，不建議生產環境啟用。兩個接口提供的 REST API 格式相同，參考 [Kubernetes API Reference](https://kubernetes.io/docs/reference/#api-reference) 查看所有 API 的調用格式。

![img](assets/API-server-space.png)

（圖片來自 [OpenShift Blog](https://blog.openshift.com/kubernetes-deep-dive-api-server-part-1/)）

在實際使用中，通常通過 [kubectl](https://kubernetes.io/docs/user-guide/kubectl-overview/) 來訪問 apiserver，也可以通過 Kubernetes 各個語言的 client 庫來訪問 apiserver。在使用 kubectl 時，打開調試日誌也可以看到每個 API 調用的格式，比如

```sh
$ kubectl --v=8 get pods
```

可通過 `kubectl api-versions` 和 `kubectl api-resources` 查詢 Kubernetes API 支持的 API 版本以及資源對象。

```sh
$ kubectl api-versions
admissionregistration.k8s.io/v1beta1
apiextensions.k8s.io/v1beta1
apiregistration.k8s.io/v1
apiregistration.k8s.io/v1beta1
apps/v1
apps/v1beta1
apps/v1beta2
authentication.k8s.io/v1
authentication.k8s.io/v1beta1
authorization.k8s.io/v1
authorization.k8s.io/v1beta1
autoscaling/v1
autoscaling/v2beta1
batch/v1
batch/v1beta1
certificates.k8s.io/v1beta1
events.k8s.io/v1beta1
extensions/v1beta1
metrics.k8s.io/v1beta1
networking.k8s.io/v1
policy/v1beta1
rbac.authorization.k8s.io/v1
rbac.authorization.k8s.io/v1beta1
scheduling.k8s.io/v1beta1
storage.k8s.io/v1
storage.k8s.io/v1beta1
v1

$ kubectl api-resources --api-group=storage.k8s.io
NAME                SHORTNAMES   APIGROUP         NAMESPACED   KIND
storageclasses      sc           storage.k8s.io   false        StorageClass
volumeattachments                storage.k8s.io   false        VolumeAttachment
```

## OpenAPI 和 Swagger

通過 `/swaggerapi` 可以查看 Swagger API，`/openapi/v2` 查看 OpenAPI。

開啟 `--enable-swagger-ui=true` 後還可以通過 `/swagger-ui` 訪問 Swagger UI。

根據 OpenAPI 也可以生成各種語言的客戶端，比如可以用下面的命令生成 Go 語言的客戶端：

```sh
git clone https://github.com/kubernetes-client/gen /tmp/gen
cat >go.settings <<EOF
# Kubernetes branch name
export KUBERNETES_BRANCH="release-1.11"

# client version for packaging and releasing.
export CLIENT_VERSION="1.0"

# Name of the release package
export PACKAGE_NAME="client-go"
EOF

/tmp/gen/openapi/go.sh ./client-go ./go.settings
```

## 訪問控制

Kubernetes API 的每個請求都會經過多階段的訪問控制之後才會被接受，這包括認證、授權以及准入控制（Admission Control）等。

![](images/access_control.png)

### 認證

開啟 TLS 時，所有的請求都需要首先認證。Kubernetes 支持多種認證機制，並支持同時開啟多個認證插件（只要有一個認證通過即可）。如果認證成功，則用戶的 `username` 會傳入授權模塊做進一步授權驗證；而對於認證失敗的請求則返回 HTTP 401。

> **Kubernetes 不直接管理用戶**
>
> 雖然 Kubernetes 認證和授權用到了 username，但 Kubernetes 並不直接管理用戶，不能創建 `user` 對象，也不存儲 username。

更多認證模塊的使用方法可以參考 [Kubernetes 認證插件](../plugins/auth.md# 認證)。

### 授權

認證之後的請求就到了授權模塊。跟認證類似，Kubernetes 也支持多種授權機制，並支持同時開啟多個授權插件（只要有一個驗證通過即可）。如果授權成功，則用戶的請求會發送到准入控制模塊做進一步的請求驗證；而對於授權失敗的請求則返回 HTTP 403.

更多授權模塊的使用方法可以參考 [Kubernetes 授權插件](../plugins/auth.md# 授權)。

### 准入控制

准入控制（Admission Control）用來對請求做進一步的驗證或添加默認參數。不同於授權和認證只關心請求的用戶和操作，准入控制還處理請求的內容，並且僅對創建、更新、刪除或連接（如代理）等有效，而對讀操作無效。准入控制也支持同時開啟多個插件，它們依次調用，只有全部插件都通過的請求才可以放過進入系統。

更多准入控制模塊的使用方法可以參考 [Kubernetes 准入控制](../plugins/admission.md)。

## 啟動 apiserver 示例

```sh
kube-apiserver --feature-gates=AllAlpha=true --runtime-config=api/all=true \
    --requestheader-allowed-names=front-proxy-client \
    --client-ca-file=/etc/kubernetes/pki/ca.crt \
    --allow-privileged=true \
    --experimental-bootstrap-token-auth=true \
    --storage-backend=etcd3 \
    --requestheader-username-headers=X-Remote-User \
    --requestheader-extra-headers-prefix=X-Remote-Extra- \
    --service-account-key-file=/etc/kubernetes/pki/sa.pub \
    --tls-cert-file=/etc/kubernetes/pki/apiserver.crt \
    --tls-private-key-file=/etc/kubernetes/pki/apiserver.key \
    --kubelet-client-certificate=/etc/kubernetes/pki/apiserver-kubelet-client.crt \
    --requestheader-client-ca-file=/etc/kubernetes/pki/front-proxy-ca.crt \
    --insecure-port=8080 \
    --admission-control=NamespaceLifecycle,LimitRanger,ServiceAccount,PersistentVolumeLabel,DefaultStorageClass,ResourceQuota,DefaultTolerationSeconds \
    --requestheader-group-headers=X-Remote-Group \
    --kubelet-client-key=/etc/kubernetes/pki/apiserver-kubelet-client.key \
    --secure-port=6443 \
    --kubelet-preferred-address-types=InternalIP,ExternalIP,Hostname \
    --service-cluster-ip-range=10.96.0.0/12 \
    --authorization-mode=RBAC \
    --advertise-address=192.168.0.20 --etcd-servers=http://127.0.0.1:2379
```

## 工作原理

kube-apiserver 提供了 Kubernetes 的 REST API，實現了認證、授權、准入控制等安全校驗功能，同時也負責集群狀態的存儲操作（通過 etcd）。

![](images/kube-apiserver.png)

以 `/apis/batch/v2alpha1/jobs` 為例，GET 請求的處理過程如下圖所示：

![img](assets/API-server-flow.png)

POST 請求的處理過程為：

![img](assets/API-server-storage-flow.png)

（圖片來自 [OpenShift Blog](https://blog.openshift.com/kubernetes-deep-dive-api-server-part-1/)）

## API 訪問

有多種方式可以訪問 Kubernetes 提供的 REST API：

- [kubectl](kubectl.md) 命令行工具
- SDK，支持多種語言
  - [Go](https://github.com/kubernetes/client-go)
  - [Python](https://github.com/kubernetes-incubator/client-python)
  - [Javascript](https://github.com/kubernetes-client/javascript)
  - [Java](https://github.com/kubernetes-client/java)
  - [CSharp](https://github.com/kubernetes-client/csharp)
  - 其他 [OpenAPI](https://www.openapis.org/) 支持的語言，可以通過 [gen](https://github.com/kubernetes-client/gen) 工具生成相應的 client

### kubectl

```sh
kubectl get --raw /api/v1/namespaces
kubectl get --raw /apis/metrics.k8s.io/v1beta1/nodes
kubectl get --raw /apis/metrics.k8s.io/v1beta1/pods
```

### kubectl proxy

```sh
$ kubectl proxy --port=8080 &

$ curl http://localhost:8080/api/
{
  "versions": [
    "v1"
  ]
}
```

### curl

```sh
# In Pods with service account.
$ TOKEN=$(cat /run/secrets/kubernetes.io/serviceaccount/token)
$ CACERT=/run/secrets/kubernetes.io/serviceaccount/ca.crt
$ curl --cacert $CACERT --header "Authorization: Bearer $TOKEN"  https://$KUBERNETES_SERVICE_HOST:$KUBERNETES_SERVICE_PORT/api
{
  "kind": "APIVersions",
  "versions": [
    "v1"
  ],
  "serverAddressByClientCIDRs": [
    {
      "clientCIDR": "0.0.0.0/0",
      "serverAddress": "10.0.1.149:443"
    }
  ]
}
```


```sh
# Outside of Pods.
$ APISERVER=$(kubectl config view | grep server | cut -f 2- -d ":" | tr -d " ")
$ TOKEN=$(kubectl describe secret $(kubectl get secrets | grep default | cut -f1 -d ' ') | grep -E '^token'| cut -f2 -d':'| tr -d '\t')
$ curl $APISERVER/api --header "Authorization: Bearer $TOKEN" --insecure
{
  "kind": "APIVersions",
  "versions": [
    "v1"
  ],
  "serverAddressByClientCIDRs": [
    {
      "clientCIDR": "0.0.0.0/0",
      "serverAddress": "10.0.1.149:443"
    }
  ]
}
```

## API 參考文檔

最近 3 個穩定版本的 API 參考文檔為：

- [v1.13 API Reference](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.13/)
- [v1.12 API Reference](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.12/)
- [v1.11 API Reference](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.11/)
