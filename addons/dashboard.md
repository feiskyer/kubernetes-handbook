# Kubernetes Dashboard

Kubernetes Dashboard 的部署非常簡單，只需要運行

```sh
kubectl apply -f https://raw.githubusercontent.com/kubernetes/dashboard/v1.10.1/src/deploy/recommended/kubernetes-dashboard.yaml
```

稍等一會，dashborad 就會創建好

```sh
$ kubectl -n kube-system get service kubernetes-dashboard
NAME                   CLUSTER-IP       EXTERNAL-IP   PORT(S)        AGE
kubernetes-dashboard   10.101.211.212   <nodes>       80:32729/TCP   1m
$ kubectl -n kube-system describe service kubernetes-dashboard
Name:            kubernetes-dashboard
Namespace:        kube-system
Labels:            app=kubernetes-dashboard
Annotations:        <none>
Selector:        app=kubernetes-dashboard
Type:            NodePort
IP:            10.101.211.212
Port:            <unset>    80/TCP
NodePort:        <unset>    32729/TCP
Endpoints:        10.244.1.3:9090
Session Affinity:    None
Events:            <none>
```

然後就可以通過 `http://nodeIP:32729` 來訪問了。

## 登錄認證

### 導入證書登錄

在 v1.7 之前的版本中，Dashboard 並不提供登陸的功能。而通常情況下，Dashboard 服務都是以 https 的方式運行，所以可以在訪問它之前將證書導入系統中:

```sh
openssl pkcs12 -export -in apiserver-kubelet-client.crt -inkey apiserver-kubelet-client.key -out kube.p12
curl -sSL -E ./kube.p12:password -k https://nodeIP:6443/api/v1/proxy/namespaces/kube-system/services/kubernetes-dashboard
```

將 kube.p12 導入系統就可以用瀏覽器來訪問了。注意，如果 nodeIP 不在證書 CN 裡面，則需要做個 hosts 映射。

### 使用 kubeconfig 配置文件登錄

從 v1.7.0 版本開始，Dashboard 支持以 kubeconfig 配置文件的方式登錄。打開 Dashboard 頁面會自動跳轉到登錄的界面，選擇 Kubeconfig 方式，並選擇本地的 kubeconfig 配置文件即可。

![](https://user-images.githubusercontent.com/2285385/30416718-8ee657d8-992d-11e7-84c8-9ba5f4c78bb2.png)

### 使用 Token 登錄

從 v1.7.0 版本開始，Dashboard 支持以 Token 的方式登錄。注意從 Kubernetes 中取得的 Token 需要以 Base64 解碼後才可以用來登錄。

下面是一個在開啟 RBAC 時創建一個只可以訪問 demo namespace 的 service account token 示例：

```sh
# 創建 demo namespace
kubectl create namespace demo

# 創建並限制只可以訪問 demo namespace
cat <<EOF | kubectl apply -f -
kind: Role
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  namespace: demo
  name: default-role
rules:
  - apiGroups:
    - '*'
    resources:
    - '*'
    verbs:
    - '*'
EOF
kubectl create rolebinding default-rolebinding --serviceaccount=demo:default --namespace=demo --role=default-role

# 獲取 token
secret=$(kubectl -n demo get sa default -o jsonpath='{.secrets[0].name}')
kubectl -n demo get secret $secret -o jsonpath='{.data.token}' | base64 -d
```

注意，由於使用該 token 僅可以訪問 demo namespace，故而需要登錄後將訪問 URL 中的 default 改成 demo。

## 其他用戶界面

除了 Kubernetes 社區提供的 Dashboard，還可以使用下列用戶界面來管理 Kubernetes 集群

- [Cabin](https://github.com/bitnami-labs/cabin)：Android/iOS App，用於在移動端管理 Kubernetes
- [Kubernetic](http://kubernetic.com/)：Kubernetes 桌面客戶端
- [Kubernator](https://github.com/smpio/kubernator)：低級（low-level） Web 界面，用於直接管理 Kubernetes 的資源對象（即 YAML 配置）

![kubernator](images/kubernator.png)
