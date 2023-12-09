# Deis Workflow

> **Workflow is no longer maintained by Deis**
>
> Workflow v2.18 represents the [last release maintained by Deis](https://deis.com/blog/2017/deis-workflow-final-release/), and no further maintenance or updates will be provided. Future updates will be managed by [teamhephy/workflow](https://github.com/teamhephy/workflow).
>
> It is recommended to utilize [Helm](helm.md) for managing Kubernetes applications.

Deis Workflow is a PaaS management platform based on Kubernetes, further simplifying the packaging, deployment, and service discovery for applications.

![](https://deis.com/docs/workflow/diagrams/Git_Push_Flow.png)

## Deis Architecture

![](https://deis.com/docs/workflow/diagrams/Workflow_Overview.png)

![](https://deis.com/docs/workflow/diagrams/Workflow_Detail.png)

![](https://deis.com/docs/workflow/diagrams/Application_Layout.png)

## Installing and Deploying Deis

Firstly, we need to deploy a Kubernetes setup (like minikube, GKE, etc., don’t forget to enable `KUBE_ENABLE_CLUSTER_DNS=true`), configure the kubectl client on the local machine, and then run the following scripts to install Deis:

```sh
# install deis v2 (workflow)
curl -sSL http://deis.io/deis-cli/install-v2.sh | bash
mv deis /usr/local/bin/

# install helm
wget https://storage.googleapis.com/kubernetes-helm/helm-v2.2.1-linux-amd64.tar.gz
tar zxvf helm-v2.2.1-linux-amd64.tar.gz
mv linux-amd64/helm /usr/local/bin/
rm -rf linux-amd64 helm-v2.2.1-linux-amd64.tar.gz
helm init

# deploy helm components
helm repo add deis https://charts.deis.com/workflow
helm install deis/workflow --namespace deis
kubectl --namespace=deis get pods
```

## Basic Use of Deis

### User Registration and Login

```sh
deis register deis-controller.deis.svc.cluster.local
deis login deis-controller.deis.svc.cluster.local
deis perms:create newuser --admin
```

### Deploying Applications

**Please note, most Deis operations must be performed in the application's directory (i.e., `example-dockerfile-http` below).**

```sh
git clone https://github.com/deis/example-dockerfile-http.git
cd example-dockerfile-http
docker build -t deis/example-dockerfile-http .
docker push deis/example-dockerfile-http

# create app
deis create example-dockerfile-http --no-remote
# deploy app
deis pull deis/example-dockerfile-http:latest

# query application status
deis info
```

Scale-up Application

```sh
$ deis scale cmd=3
$ deis ps
=== example-dockerfile-http Processes
--- cmd:
example-dockerfile-http-cmd-4246296512-08124 up (v2)
example-dockerfile-http-cmd-4246296512-40lfv up (v2)
example-dockerfile-http-cmd-4246296512-fx3w3 up (v2)
```

You can also set auto-scaling

```sh
deis autoscale:set example-dockerfile-http --min=3 --max=8 --cpu-percent=75
```

Thus, the application can be accessed through Kubernetes' DNS (and also through load balancing if enabled for public networks):

```sh
$ curl example-dockerfile-http.example-dockerfile-http.svc.cluster.local
Powered by Deis
```

### Domain Names and Routing

```sh
# Be careful to set CNMAE record back to the original address
deis domains:add hello.bacongobbler.com

dig hello.deisapp.com
deis routing:enable
```

This is actually adding virtual hosts to the ngnix configuration of deis-router:

```
    server {
        listen 8080;
        server_name ~^example-dockerfile-http\.(?<domain>.+)$;
        server_name_in_redirect off;
        port_in_redirect off;
        set $app_name "example-dockerfile-http";
        vhost_traffic_status_filter_by_set_key example-dockerfile-http application::*;

        location / {
            proxy_buffering off;
            proxy_set_header Host $host;
            proxy_set_header X-Forwarded-For $remote_addr;
            proxy_set_header X-Forwarded-Proto $access_scheme;
            proxy_set_header X-Forwarded-Port $forwarded_port;
            proxy_redirect off;
            proxy_connect_timeout 30s;
            proxy_send_timeout 1300s;
            proxy_read_timeout 1300s;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;

            proxy_pass http://10.0.0.224:80;
        }
    }

    server {
        listen 8080;
        server_name hello.bacongobbler.com;
        server_name_in_redirect off;
        port_in_redirect off;
        set $app_name "example-dockerfile-http";
        vhost_traffic_status_filter_by_set_key example-dockerfile-http application::*;

        location / {
            proxy_buffering off;
            proxy_set_header Host $host;
            proxy_set_header X-Forwarded-For $remote_addr;
            proxy_set_header X-Forwarded-Proto $access_scheme;
            proxy_set_header X-Forwarded-Port $forwarded_port;
            proxy_redirect off;
            proxy_connect_timeout 30s;
            proxy_send_timeout 1300s;
            proxy_read_timeout 1300s;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_pass http://10.0.0.224:80;
        }
    }
```

### References

- <https://github.com/deis/workflow>
- <https://deis.com/workflow/>
- <https://github.com/teamhephy/workflow>
