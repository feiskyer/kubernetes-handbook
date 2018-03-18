# Helm 工作原理

## 基本概念

Helm 的三个基本概念

- Chart：Helm 应用（package），包括该应用的所有 Kubernetes manifest 模版，类似于 YUM RPM 或 Apt dpkg 文件
- Repository：Helm package 存储仓库
- Release：chart 的部署实例，每个 chart 可以部署一个或多个 release

## Helm 工作原理

Helm 包括两个部分，`helm` 客户端和 `tiller` 服务端。

> the client is responsible for managing charts, and the server is responsible for managing releases.

### helm 客户端

helm 客户端是一个命令行工具，负责管理 charts、repository 和 release。它通过 gPRC API（使用 `kubectl port-forward` 将 tiller 的端口映射到本地，然后再通过映射后的端口跟 tiller 通信）向 tiller 发送请求，并由 tiller 来管理对应的 Kubernetes 资源。

Helm 客户端的使用方法参见 [Helm 命令](helm.html)。

### tiller 服务端

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

## Helm 插件

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
