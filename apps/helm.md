# Helm

[Helm](https://github.com/kubernetes/helm) 是一個類似於 yum/apt/[homebrew](https://brew.sh/) 的 Kubernetes 應用管理工具。Helm 使用 [Chart](https://github.com/kubernetes/charts) 來管理 Kubernetes manifest 文件。

## Helm 基本使用

安裝 `helm` 客戶端

```sh
brew install kubernetes-helm
```

初始化 Helm 並安裝 `Tiller` 服務（需要事先配置好 kubectl）

```sh
helm init
```

更新 charts 列表

```sh
helm repo update
```

部署服務，比如 mysql

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

更多命令的使用方法可以參考下面的 "Helm 命令參考" 部分。

## Helm 工作原理

### 基本概念

Helm 的三個基本概念

- Chart：Helm 應用（package），包括該應用的所有 Kubernetes manifest 模版，類似於 YUM RPM 或 Apt dpkg 文件
- Repository：Helm package 存儲倉庫
- Release：chart 的部署實例，每個 chart 可以部署一個或多個 release

### Helm 工作原理

Helm 包括兩個部分，`helm` 客戶端和 `tiller` 服務端。

> the client is responsible for managing charts, and the server is responsible for managing releases.

#### helm 客戶端

helm 客戶端是一個命令行工具，負責管理 charts、repository 和 release。它通過 gPRC API（使用 `kubectl port-forward` 將 tiller 的端口映射到本地，然後再通過映射後的端口跟 tiller 通信）向 tiller 發送請求，並由 tiller 來管理對應的 Kubernetes 資源。

`helm` 命令的使用方法可以參考下面的 "Helm 命令參考" 部分。

#### tiller 服務端

tiller 接收來自 helm 客戶端的請求，並把相關資源的操作發送到 Kubernetes，負責管理（安裝、查詢、升級或刪除等）和跟蹤 Kubernetes 資源。為了方便管理，tiller 把 release 的相關信息保存在 kubernetes 的 ConfigMap 中。

tiller 對外暴露 gRPC API，供 helm 客戶端調用。

## Helm Charts

Helm 使用 [Chart](https://github.com/kubernetes/charts) 來管理 Kubernetes manifest 文件。每個 chart 都至少包括

- 應用的基本信息 `Chart.yaml`
- 一個或多個 Kubernetes manifest 文件模版（放置於 templates / 目錄中），可以包括 Pod、Deployment、Service 等各種 Kubernetes 資源

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

### 依賴管理

Helm 支持兩種方式管理依賴的方式：

- 直接把依賴的 package 放在 `charts/` 目錄中
- 使用 `requirements.yaml` 並用 `helm dep up foochart` 來自動下載依賴的 packages

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

Chart 模板基於 Go template 和 [Sprig](https://github.com/Masterminds/sprig)，比如

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

模版參數的默認值必須放到 `values.yaml` 文件中，其格式為

```yaml
imageRegistry: "quay.io/deis"
dockerTag: "latest"
pullPolicy: "alwaysPull"
storage: "s3"

# 依賴的 mysql chart 的默認參數
mysql:
  max_connections: 100
  password: "secret"
```

### Helm 插件

插件提供了擴展 Helm 核心功能的方法，它在客戶端執行，並放在 `$(helm home)/plugins` 目錄中。

一個典型的 helm 插件格式為

```sh
$(helm home)/plugins/
  |- keybase/
      |
      |- plugin.yaml
      |- keybase.sh
```

而 plugin.yaml 格式為

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

這樣，就可以用 `helm keybase` 命令來使用這個插件。

## Helm 命令參考

### 查詢 charts

```sh
helm search
helm search mysql
```

### 查詢 package 詳細信息

```sh
helm inspect stable/mariadb
```

### 部署 package

```sh
helm install stable/mysql
```

部署之前可以自定義 package 的選項：

```sh
# 查詢支持的選項
helm inspect values stable/mysql

# 自定義 password
echo "mysqlRootPassword: passwd" > config.yaml
helm install -f config.yaml stable/mysql
```

另外，還可以通過打包文件（.tgz）或者本地 package 路徑（如 path/foo）來部署應用。

### 查詢服務 (Release) 列表

```sh
➜  ~ helm ls
NAME            	REVISION	UPDATED                 	STATUS  	CHART      	NAMESPACE
quieting-warthog	1       	Tue Feb 21 20:13:02 2017	DEPLOYED	mysql-0.2.5	default
```

### 查詢服務 (Release) 狀態

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

### 升級和回滾 Release

```sh
# 升級
cat "mariadbUser: user1" >panda.yaml
helm upgrade -f panda.yaml happy-panda stable/mariadb

# 回滾
helm rollback happy-panda 1
```

### 刪除 Release

```sh
helm delete quieting-warthog
```

### repo 管理

```sh
# 添加 incubator repo
helm repo add incubator https://kubernetes-charts-incubator.storage.googleapis.com/

# 查詢 repo 列表
helm repo list

# 生成 repo 索引（用於搭建 helm repository）
helm repo index
```

### chart 管理

```sh
# 創建一個新的 chart
helm create deis-workflow

# validate chart
helm lint

# 打包 chart 到 tgz
helm package deis-workflow
```

## Helm UI

[Kubeapps](https://github.com/kubeapps/kubeapps) 提供了一個開源的 Helm UI 界面，方便以圖形界面的形式管理 Helm 應用。

```sh
curl -s https://api.github.com/repos/kubeapps/kubeapps/releases/latest | grep -i $(uname -s) | grep browser_download_url | cut -d '"' -f 4 | wget -i -
sudo mv kubeapps-$(uname -s| tr '[:upper:]' '[:lower:]')-amd64 /usr/local/bin/kubeapps
sudo chmod +x /usr/local/bin/kubeapps

kubeapps up
kubeapps dashboard
```

更多使用方法請參考 [Kubeapps 官方網站](https://kubeapps.com/)。

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
