# Helm

[Helm](https://github.com/kubernetes/helm) is to Kubernetes what package managers like yum/apt/[homebrew](https://brew.sh/) are to traditional operating systems. It leverages [Charts](https://github.com/kubernetes/charts) to handle Kubernetes manifest files.

## Basic Usage of Helm

To install the `helm` client, simply input

```bash
brew install kubernetes-helm
```

Initialize Helm and install the `Tiller` service (with kubectl preconfigured)

```bash
helm init
```

For Kubernetes versions v1.16.0 and above, you may encounter an `Error: error installing: the server could not find the requested resource`. This results from `extensions/v1beta1` being replaced by `apps/v1`. The resolution is

```bash
kubectl create serviceaccount --namespace kube-system tiller
kubectl create clusterrolebinding tiller --clusterrole=cluster-admin --serviceaccount=kube-system:tiller
helm init --service-account tiller --override spec.selector.matchLabels.'name'='tiller',spec.selector.matchLabels.'app'='helm' --output yaml | sed 's@apiVersion: extensions/v1beta1@apiVersion: apps/v1@' | kubectl apply -f -
```

To update the charts list

```bash
helm repo update
```

To deploy a service, such as MySQL

```bash
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

For more usage of commands, refer to the "Helm Command Reference" section below.

## How Helm Works

### Basic Concepts

Helm centers around three concepts:

* Chart: A Helm application (package), consisting of all associated Kubernetes manifest templates. Analogous to YUM RPM or Apt dpkg files.
* Repository: The storage depot for Helm packages.
* Release: The deployment instance of a chart. Each chart can deploy one or multiple releases.

### Working Principle of Helm

Helm comprises two components: `helm` client and `tiller` server.

> The client is responsible for managing charts, while the server handles release management.

#### helm client

The helm client is a command-line tool responsible for the management of charts, repositories, and releases. It communicates with tiller via a gPRC API (this is done via 'kubectl port-forward' to map tiller's port to the local machine, then communicate with tiller through the mapped port), sending commands for tiller to manage corresponding Kubernetes resources.

Usage of `helm` commands can be found in the "Helm Command Reference" section below.

#### tiller server

Tiller receives requests sent from the helm client and relays the resource operations to Kubernetes, managing (installing, querying, upgrading, or deletion, etc.) and tracking the Kubernetes resources. To facilitate this, tiller saves release-specific information in Kubernetes ConfigMap.

Tiller exposes a gRPC API for the helm client to call.

## Helm Charts

Helm employs [Charts](https://github.com/kubernetes/charts) to manage Kubernetes manifest files. Each chart minimally includes:

* Basic information of the application `Chart.yaml`
* One or more Kubernetes manifest file templates (stored under templates/ directory), encompassing various Kubernetes resources such as Pod, Deployment, Service, and so on.

### Chart.yaml Example

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

### Dependency Management

There are two main ways in which Helm manages dependencies:

* Directly placing dependent packages in `charts/` directory
* Using `requirements.yaml` and `helm dep up foochart` to automatically download dependent packages

```yaml
dependencies:
  - name: apache
    version: 1.2.3
    repository: http://example.com/charts
  - name: mysql
    version: 3.2.1
    repository: http://another.example.com/charts
```

### Chart Templates

Chart templates are built upon Go templates and [Sprig](https://github.com/Masterminds/sprig), for instance,

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

The default values for template parameters should be placed in `values.yaml` file, with the format:

```yaml
imageRegistry: "quay.io/deis"
dockerTag: "latest"
pullPolicy: "alwaysPull"
storage: "s3"

# Default parameters of the dependent MySQL chart
mysql:
  max_connections: 100
  password: "secret"
```

### Helm Plugins

Plugins offer a way to extend the functionality of Helm. They are executed on the client side and located in `$(helm home)/plugins` directory.

A typical format of a Helm plugin is:

```bash
$(helm home)/plugins/
  |- keybase/
      |
      |- plugin.yaml
      |- keybase.sh
```

and the format of plugin.yaml is:

```yaml
name: "keybase"
version: "0.1.0"
usage: "Integrate Keybase.io tools with Helm"
description: |-
  This plugin provides Keybase services to Helm.
ignoreFlags: false
useTunnel: false
command: "$HELM_PLUGIN_DIR/keybase.sh"
```

In this manner, the command `helm keybase` can be used to call this plugin.

## Helm Command Reference

### Querying Charts

```bash
helm search
helm search mysql
```

### Retrieving Package Details

```bash
helm inspect stable/mariadb
```

### Deploying Packages

```bash
helm install stable/mysql
```

Options for packages can also be customized before deployment:

```bash
# Querying possible options
helm inspect values stable/mysql

# Customizing password
echo "mysqlRootPassword: passwd" > config.yaml
helm install -f config.yaml stable/mysql
```

Moreover, you can deploy apps through a package file (i.e., .tgz) or local package path (e.g., path/foo).

### Listing Services \(Releases\)

```bash
➜  ~ helm ls
NAME                REVISION    UPDATED                     STATUS      CHART          NAMESPACE
quieting-warthog    1           Tue Feb 21 20:13:02 2017    DEPLOYED    mysql-0.2.5    default
```

### Checking Service \(Release\) Status

```bash
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

### Upgrading and Rolling Back Releases

```bash
# Upgrading
cat "mariadbUser: user1" >panda.yaml
helm upgrade -f panda.yaml happy-panda stable/mariadb

# Rolling Back
helm rollback happy-panda 1
```

### Deleting Releases

```bash
helm delete quieting-warthog
```

### Repository Management

```bash
# Adding incubator repository
helm repo add incubator https://kubernetes-charts-incubator.storage.googleapis.com/

# Listing Repos
helm repo list

# Create repo index (for setting up helm repository)
helm repo index
```

### Chart Management

```bash
# Creating a New Chart
helm create deis-workflow

# Validate Chart
helm lint

# Packaging Chart into tgz
helm package deis-workflow
```

## Helm UI
[Kubeapps](https://github.com/kubeapps/kubeapps) provides an open-source Helm UI interface, making Helm application management in a graphical interface possible.

```bash
curl -s https://api.github.com/repos/kubeapps/kubeapps/releases/latest | grep -i $(uname -s) | grep browser_download_url | cut -d '"' -f 4 | wget -i -
sudo mv kubeapps-$(uname -s| tr '[:upper:]' '[:lower:]')-amd64 /usr/local/bin/kubeapps
sudo chmod +x /usr/local/bin/kubeapps

kubeapps up
kubeapps dashboard
```

For additional usage instructions, please refer to the [Kubeapps official website](https://kubeapps.com/).

## Helm Repository

Official repositories:

* [https://hub.helm.sh/](https://hub.helm.sh/)
* [https://github.com/kubernetes/charts](https://github.com/kubernetes/charts)

Third-party repositories:

* [https://github.com/coreos/prometheus-operator/tree/master/helm](https://github.com/coreos/prometheus-operator/tree/master/helm)
* [https://github.com/deis/charts](https://github.com/deis/charts)
* [https://github.com/bitnami/charts](https://github.com/bitnami/charts)
* [https://github.com/att-comdev/openstack-helm](https://github.com/att-comdev/openstack-helm)
* [https://github.com/sapcc/openstack-helm](https://github.com/sapcc/openstack-helm)
* [https://github.com/helm/charts](https://github.com/helm/charts)
* [https://github.com/jackzampolin/tick-charts](https://github.com/jackzampolin/tick-charts)

## Popular Helm Plugins

1. [helm-tiller](https://github.com/adamreese/helm-tiller) - Additional commands to work with Tiller
2. [Technosophos's Helm Plugins](https://github.com/technosophos/helm-plugins) - Plugins for GitHub, Keybase, and GPG
3. [helm-template](https://github.com/technosophos/helm-template) - Debug/render templates client-side
4. [Helm Value Store](https://github.com/skuid/helm-value-store) - Plugin for working with Helm deployment values
5. [Drone.io Helm Plugin](http://plugins.drone.io/ipedrazas/drone-helm/) - Run Helm in the Drone CI/CD system