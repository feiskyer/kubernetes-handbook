# Helm

[Helm](https://github.com/kubernetes/helm)是一个类似于 yum/apt/[homebrew](https://brew.sh/)的 Kubernetes 应用管理工具。Helm 使用 [Chart](https://github.com/kubernetes/charts) 来管理 Kubernetes manifest 文件。

## Helm 基本使用

安装 `helm` 客户端

```sh
brew install kubernetes-helm
```

初始化 Helm 并安装 `Tiller` 服务（需要事先配置好 kubectl）

```sh
helm init
```

更新 charts 列表

```sh
helm repo update
```

部署服务，比如 mysql

```sh
➜  ~ helm install stable/mysql
NAME:   quieting-warthog
LAST DEPLOYED: Tue Feb 21 16:13:02 2017
NAMESPACE: default
STATUS: DEPLOYED

RESOURCES:
==> v1/Secret
NAME                    TYPE    DATA  AGE
quieting-warthog-mysql  Opaque  2     1s

==> v1/PersistentVolumeClaim
NAME                    STATUS   VOLUME  CAPACITY  ACCESSMODES  AGE
quieting-warthog-mysql  Pending  1s

==> v1/Service
NAME                    CLUSTER-IP    EXTERNAL-IP  PORT(S)   AGE
quieting-warthog-mysql  10.3.253.105  <none>       3306/TCP  1s

==> extensions/v1beta1/Deployment
NAME                    DESIRED  CURRENT  UP-TO-DATE  AVAILABLE  AGE
quieting-warthog-mysql  1        1        1           0          1s


NOTES:
MySQL can be accessed via port 3306 on the following DNS name from within your cluster:
quieting-warthog-mysql.default.svc.cluster.local

To get your root password run:

    kubectl get secret --namespace default quieting-warthog-mysql -o jsonpath="{.data.mysql-root-password}" | base64 --decode; echo

To connect to your database:

1. Run an Ubuntu pod that you can use as a client:

    kubectl run -i --tty ubuntu --image=ubuntu:16.04 --restart=Never -- bash -il

2. Install the mysql client:

    $ apt-get update && apt-get install mysql-client -y

3. Connect using the mysql cli, then provide your password:
    $ mysql -h quieting-warthog-mysql -p
```

更多命令的使用方法可以参考 [Helm 命令参考](helm.md)。

## Helm 工作原理

见 [Helm 工作原理](helm-basic.md)。

## Helm Repository

官方 repository:

* https://github.com/kubernetes/charts

第三方 repository:

* https://github.com/deis/charts
* https://github.com/bitnami/charts
* https://github.com/att-comdev/openstack-helm
* https://github.com/sapcc/openstack-helm
* https://github.com/mgoodness/kube-prometheus-charts
* https://github.com/helm/charts
* https://github.com/jackzampolin/tick-charts

## 常用 Helm 插件

1. [helm-tiller](https://github.com/adamreese/helm-tiller) - Additional commands to work with Tiller
2. [Technosophos's Helm Plugins](https://github.com/technosophos/helm-plugins) - Plugins for GitHub, Keybase, and GPG
3. [helm-template](https://github.com/technosophos/helm-template) - Debug/render templates client-side
4. [Helm Value Store](https://github.com/skuid/helm-value-store) - Plugin for working with Helm deployment values
5. [Drone.io Helm Plugin](http://plugins.drone.io/ipedrazas/drone-helm/) - Run Helm inside of the Drone CI/CD system
