# Kubernetes Dashboard

Kubernetes Dashboard的部署非常简单，只需要运行

```sh
kubectl apply -f https://raw.githubusercontent.com/kubernetes/dashboard/master/src/deploy/recommended/kubernetes-dashboard.yaml
```

稍等一会，dashborad就会创建好

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

然后就可以通过`http://nodeIP:32729`来访问了。

## 登录认证

### 导入证书登录

在v1.7之前的版本中，Dashboard并不提供登陆的功能。而通常情况下，Dashboard服务都是以https的方式运行，所以可以下访问它之前将证书导入系统中:

```sh
openssl pkcs12 -export -in apiserver-kubelet-client.crt -inkey apiserver-kubelet-client.key -out kube.p12
curl -sSL -E ./kube.p12:password -k https://nodeIP:6443/api/v1/proxy/namespaces/kube-system/services/kubernetes-dashboard
```

将kube.p12导入系统就可以用浏览器来访问了。注意，如果nodeIP不在证书CN里面，则需要做个hosts映射。

### 使用 kubeconfig 配置文件登录

从 v1.7.0 版本开始，Dashboard 支持以 kubeconfig 配置文件的方式登录。打开 Dashboard 页面会自动跳转到登录的界面，选择 Kubeconfig 方式，并选择本地的 kubeconfig配置文件即可。

![](https://user-images.githubusercontent.com/2285385/30416718-8ee657d8-992d-11e7-84c8-9ba5f4c78bb2.png)

### 使用 Token 登录

从 v1.7.0 版本开始，Dashboard 支持以 Token 的方式登录。注意从 Kubernetes 中取得的 Token 需要以 Base64 解码后才可以用来登录。

下面是一个在开启 RBAC 时创建一个尽可以访问 demo namespace 的 service account token 示例：

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

# 获取token
secret=$(kubectl -n demo get sa default -o jsonpath='{.secrets[0].name}')
kubectl -n demo get secret $secret -o jsonpath='{.data.token}' | base64 -d
```

注意，由于使用该 token 仅可以访问 demo namespace，故而需要登录后将访问 URL 中的 default 改成 demo。
