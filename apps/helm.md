# Helm

[Helm](https://github.com/kubernetes/helm) 是一个类似于 yum/apt/[homebrew](https://brew.sh/) 的 Kubernetes 应用管理工具。Helm 使用 [Chart](https://github.com/kubernetes/charts) 来管理 Kubernetes manifest 文件。

## Helm 基本使用

安装 `helm` 客户端

```sh
brew install kubernetes-helm
```

初始化 Helm 并安装 `Tiller` 服务（需要事先配置好 kubectl）

```sh
helm init
```

对于 Kubernetes v1.16.0 以上的版本，有可能会碰到 `Error: error installing: the server could not find the requested resource` 的错误。这是由于 `extensions/v1beta1` 已经被 `apps/v1` 替代，解决方法是

```sh
kubectl create serviceaccount --namespace kube-system tiller
kubectl create clusterrolebinding tiller --clusterrole=cluster-admin --serviceaccount=kube-system:tiller
helm init --service-account tiller --override spec.selector.matchLabels.'name'='tiller',spec.selector.matchLabels.'app'='helm' --output yaml | sed 's@apiVersion: extensions/v1beta1@apiVersion: apps/v1@' | kubectl apply -f -
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

更多命令的使用方法可以参考下面的 "Helm 命令参考" 部分。

## Helm 工作原理

### 基本概念

Helm 的三个基本概念

- Chart：Helm 应用（package），包括该应用的所有 Kubernetes manifest 模版，类似于 YUM RPM 或 Apt dpkg 文件
- Repository：Helm package 存储仓库
- Release：chart 的部署实例，每个 chart 可以部署一个或多个 release

### Helm 工作原理

Helm 包括两个部分，`helm` 客户端和 `tiller` 服务端。

> the client is responsible for managing charts, and the server is responsible for managing releases.

#### helm 客户端

helm 客户端是一个命令行工具，负责管理 charts、repository 和 release。它通过 gPRC API（使用 `kubectl port-forward` 将 tiller 的端口映射到本地，然后再通过映射后的端口跟 tiller 通信）向 tiller 发送请求，并由 tiller 来管理对应的 Kubernetes 资源。

`helm` 命令的使用方法可以参考下面的 "Helm 命令参考" 部分。

#### tiller 服务端

tiller 接收来自 helm 客户端的请求，并把相关资源的操作发送到 Kubernetes，负责管理（安装、查询、升级或删除等）和跟踪 Kubernetes 资源。为了方便管理，tiller 把 release 的相关信息保存在 kubernetes 的 ConfigMap 中。

tiller 对外暴露 gRPC API，供 helm 客户端调用。

## Helm Charts

Helm 使用 [Chart](https://github.com/kubernetes/charts) 来管理 Kubernetes manifest 文件。每个 chart 都至少包括

- 应用的基本信息 `Chart.yaml`
- 一个或多个 Kubernetes manifest 文件模版（放置于 templates / 目录中），可以包括 Pod、Deployment、Service 等各种 Kubernetes 资源

### Chart.yaml 示例

```yaml
name: The name of the chart (required)
version: A SemVer 2 version (required)
description: A single-sentence description of this project (optional)
keywords:
  - A list of keywords about this project (optional)
home: The URL of this project's home page (optional)
sources:
  - A list of URLs to source code for this project (optional)
maintainers: # (optional)
  - name: The maintainer's name (required for each maintainer)
    email: The maintainer's email (optional for each maintainer)
engine: gotpl # The name of the template engine (optional, defaults to gotpl)
icon: A URL to an SVG or PNG image to be used as an icon (optional).
```

### 依赖管理

Helm 支持两种方式管理依赖的方式：

- 直接把依赖的 package 放在 `charts/` 目录中
- 使用 `requirements.yaml` 并用 `helm dep up foochart` 来自动下载依赖的 packages

```yaml
dependencies:
  - name: apache
    version: 1.2.3
    repository: http://example.com/charts
  - name: mysql
    version: 3.2.1
    repository: http://another.example.com/charts
```

### Chart 模版

Chart 模板基于 Go template 和 [Sprig](https://github.com/Masterminds/sprig)，比如

```yaml
apiVersion: v1
kind: ReplicationController
metadata:
  name: deis-database
  namespace: deis
  labels:
    heritage: deis
spec:
  replicas: 1
  selector:
    app: deis-database
  template:
    metadata:
      labels:
        app: deis-database
    spec:
      serviceAccount: deis-database
      containers:
        - name: deis-database
          image: {{.Values.imageRegistry}}/postgres:{{.Values.dockerTag}}
          imagePullPolicy: {{.Values.pullPolicy}}
          ports:
            - containerPort: 5432
          env:
            - name: DATABASE_STORAGE
              value: {{default "minio" .Values.storage}}
```

模版参数的默认值必须放到 `values.yaml` 文件中，其格式为

```yaml
imageRegistry: "quay.io/deis"
dockerTag: "latest"
pullPolicy: "alwaysPull"
storage: "s3"

# 依赖的 mysql chart 的默认参数
mysql:
  max_connections: 100
  password: "secret"
```

### Helm 插件

插件提供了扩展 Helm 核心功能的方法，它在客户端执行，并放在 `$(helm home)/plugins` 目录中。

一个典型的 helm 插件格式为

```sh
$(helm home)/plugins/
  |- keybase/
      |
      |- plugin.yaml
      |- keybase.sh
```

而 plugin.yaml 格式为

```yaml
name: "keybase"
version: "0.1.0"
usage: "Integreate Keybase.io tools with Helm"
description: |-
  This plugin provides Keybase services to Helm.
ignoreFlags: false
useTunnel: false
command: "$HELM_PLUGIN_DIR/keybase.sh"
```

这样，就可以用 `helm keybase` 命令来使用这个插件。

## Helm 命令参考

### 查询 charts

```sh
helm search
helm search mysql
```

### 查询 package 详细信息

```sh
helm inspect stable/mariadb
```

### 部署 package

```sh
helm install stable/mysql
```

部署之前可以自定义 package 的选项：

```sh
# 查询支持的选项
helm inspect values stable/mysql

# 自定义 password
echo "mysqlRootPassword: passwd" > config.yaml
helm install -f config.yaml stable/mysql
```

另外，还可以通过打包文件（.tgz）或者本地 package 路径（如 path/foo）来部署应用。

### 查询服务 (Release) 列表

```sh
➜  ~ helm ls
NAME            	REVISION	UPDATED                 	STATUS  	CHART      	NAMESPACE
quieting-warthog	1       	Tue Feb 21 20:13:02 2017	DEPLOYED	mysql-0.2.5	default
```

### 查询服务 (Release) 状态

```sh
➜  ~ helm status quieting-warthog
LAST DEPLOYED: Tue Feb 21 16:13:02 2017
NAMESPACE: default
STATUS: DEPLOYED

RESOURCES:
==> v1/Secret
NAME                    TYPE    DATA  AGE
quieting-warthog-mysql  Opaque  2     9m

==> v1/PersistentVolumeClaim
NAME                    STATUS  VOLUME                                    CAPACITY  ACCESSMODES  AGE
quieting-warthog-mysql  Bound   pvc-90af9bf9-f80d-11e6-930a-42010af00102  8Gi       RWO          9m

==> v1/Service
NAME                    CLUSTER-IP    EXTERNAL-IP  PORT(S)   AGE
quieting-warthog-mysql  10.3.253.105  <none>       3306/TCP  9m

==> extensions/v1beta1/Deployment
NAME                    DESIRED  CURRENT  UP-TO-DATE  AVAILABLE  AGE
quieting-warthog-mysql  1        1        1           1          9m


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

### 升级和回滚 Release

```sh
# 升级
cat "mariadbUser: user1" >panda.yaml
helm upgrade -f panda.yaml happy-panda stable/mariadb

# 回滚
helm rollback happy-panda 1
```

### 删除 Release

```sh
helm delete quieting-warthog
```

### repo 管理

```sh
# 添加 incubator repo
helm repo add incubator https://kubernetes-charts-incubator.storage.googleapis.com/

# 查询 repo 列表
helm repo list

# 生成 repo 索引（用于搭建 helm repository）
helm repo index
```

### chart 管理

```sh
# 创建一个新的 chart
helm create deis-workflow

# validate chart
helm lint

# 打包 chart 到 tgz
helm package deis-workflow
```

## Helm UI

[Kubeapps](https://github.com/kubeapps/kubeapps) 提供了一个开源的 Helm UI 界面，方便以图形界面的形式管理 Helm 应用。

```sh
curl -s https://api.github.com/repos/kubeapps/kubeapps/releases/latest | grep -i $(uname -s) | grep browser_download_url | cut -d '"' -f 4 | wget -i -
sudo mv kubeapps-$(uname -s| tr '[:upper:]' '[:lower:]')-amd64 /usr/local/bin/kubeapps
sudo chmod +x /usr/local/bin/kubeapps

kubeapps up
kubeapps dashboard
```

更多使用方法请参考 [Kubeapps 官方网站](https://kubeapps.com/)。

## Helm Repository

官方 repository:

* https://hub.helm.sh/
* https://github.com/kubernetes/charts

第三方 repository:

* https://github.com/coreos/prometheus-operator/tree/master/helm
* https://github.com/deis/charts
* https://github.com/bitnami/charts
* https://github.com/att-comdev/openstack-helm
* https://github.com/sapcc/openstack-helm
* https://github.com/helm/charts
* https://github.com/jackzampolin/tick-charts

## 常用 Helm 插件

1. [helm-tiller](https://github.com/adamreese/helm-tiller) - Additional commands to work with Tiller
2. [Technosophos's Helm Plugins](https://github.com/technosophos/helm-plugins) - Plugins for GitHub, Keybase, and GPG
3. [helm-template](https://github.com/technosophos/helm-template) - Debug/render templates client-side
4. [Helm Value Store](https://github.com/skuid/helm-value-store) - Plugin for working with Helm deployment values
5. [Drone.io Helm Plugin](http://plugins.drone.io/ipedrazas/drone-helm/) - Run Helm inside of the Drone CI/CD system
