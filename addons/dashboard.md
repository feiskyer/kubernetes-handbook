# Kubernetes Dashboard

Kubernetes Dashboard 的部署非常简单，只需要运行

```sh
kubectl apply -f https://raw.githubusercontent.com/kubernetes/dashboard/v2.0.0-beta8/aio/deploy/recommended.yaml
```

稍等一会，dashborad 就会创建好

```sh
$ kubectl -n kubernetes-dashboard get pod
NAME                                         READY   STATUS    RESTARTS   AGE
dashboard-metrics-scraper-76585494d8-xhhzx   1/1     Running   0          20m
kubernetes-dashboard-5996555fd8-snzh9        1/1     Running   0          20m
$ kubectl -n kubernetes-dashboard get service
NAME                        TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)    AGE
dashboard-metrics-scraper   ClusterIP   10.0.58.210    <none>        8000/TCP   20m
kubernetes-dashboard        ClusterIP   10.0.182.172   <none>        443/TCP    20m
```

然后运行 `kubectl proxy` 之后就可以通过下面的链接来访问了：

```sh
http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/
```

## 登录认证

### 通过导入 API Server 的证书登录

在 v1.7 之前的版本中，Dashboard 并不提供登陆的功能，并且以 http 的方式来运行，所以你可以直接通过 `kubectl port-forard` 或者 `kubectl proxy` 来访问它。

当然也可以直接通过 API Server 的代理地址来访问，即 `kubectl cluster-info` 输出中 kubernetes-dashboard 的地址。由于 kubernetes API Server 是以 https 的方式运行，所以在访问时需要把证书导入系统中：

```sh
# generate p12 cert
kubectl config view --flatten -o jsonpath='{.users[?(.name == "username")].user.client-key-data}' | base64 -d > client.key
kubectl config view --flatten -o jsonpath='{.users[?(.name == "username")].user.client-certificate-data}' | base64 -d > client.crt
openssl pkcs12 -export -in client.crt -inkey client.key -out client.p12
```

将 kube.p12 导入系统就可以用浏览器来直接访问 `https://<apiserver-url>/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/#/overview` 了。

### 使用 kubeconfig 配置文件登录

从 v1.7.0 版本开始，Dashboard 支持以 kubeconfig 配置文件的方式登录。打开 Dashboard 页面会自动跳转到登录的界面，选择 Kubeconfig 方式，并选择本地的 kubeconfig 配置文件即可。

![](https://user-images.githubusercontent.com/2285385/30416718-8ee657d8-992d-11e7-84c8-9ba5f4c78bb2.png)

### 使用受限 Token 登录

从 v1.7.0 版本开始，Dashboard 支持以 Token 的方式登录。注意从 Kubernetes 中取得的 Token 需要以 Base64 解码后才可以用来登录。

下面是一个在开启 RBAC 时创建一个只可以访问 demo namespace 的 service account token 示例：

```sh
# 创建 demo namespace
kubectl create namespace demo

# 创建并限制只可以访问 demo namespace
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

# 获取 token
secret=$(kubectl -n demo get sa default -o jsonpath='{.secrets[0].name}')
kubectl -n demo get secret $secret -o jsonpath='{.data.token}' | base64 -d
```

注意，由于使用该 token 仅可以访问 demo namespace，故而需要登录后将访问 URL 中的 default 改成 demo。

## 使用 admin token 登录

跟上一步类似，也可以创建一个 admin 用户的 token 来登录 dashboard：

```sh
kubectl create serviceaccount admin
kubectl create clusterrolebinding dash-admin --clusterrole=cluster-admin --serviceaccount=default:admin
secret=$(kubectl get sa admin -o jsonpath='{.secrets[0].name}')
kubectl get secret $secret -o go-template='{{ .data.token | base64decode }}'
```

## 其他用户界面

除了 Kubernetes 社区提供的 Dashboard，还可以使用下列用户界面来管理 Kubernetes 集群

- [Cabin](https://github.com/bitnami-labs/cabin)：Android/iOS App，用于在移动端管理 Kubernetes
- [Kubernetic](http://kubernetic.com/)：Kubernetes 桌面客户端
- [Kubernator](https://github.com/smpio/kubernator)：低级（low-level） Web 界面，用于直接管理 Kubernetes 的资源对象（即 YAML 配置）

![kubernator](images/kubernator.png)
