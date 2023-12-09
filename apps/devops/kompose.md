# Kompose

Ever wondered if there's a wizarding tool capable of transmuting your Docker-compose configurations into Kubernetes manifests? Well, Ka-pow! Meet Kompose. Its magic lies in performing this exact transformation. You can find more about this incantation at [http://kompose.io/](http://kompose.io/).

## The Summoning of Kompose

The path to brings Kompose into being varies across different operating systems, but fret not, it's straightforward and can be done with a simple curl command:

```bash
# Linux
$ curl -L https://github.com/kubernetes-incubator/kompose/releases/download/v0.5.0/kompose-linux-amd64 -o kompose

# macOS
$ curl -L https://github.com/kubernetes-incubator/kompose/releases/download/v0.5.0/kompose-darwin-amd64 -o kompose

# Windows
$ curl -L https://github.com/kubernetes-incubator/kompose/releases/download/v0.5.0/kompose-windows-amd64.exe -o kompose.exe

# Zap it into your PATH
$ chmod +x kompose
$ sudo mv ./kompose /usr/local/bin/kompose
```

## How to Conjure With Kompose

Here’s an example of how you can convert a docker-compose.yaml configuration to Kubernetes syntax:

```yaml
version: "2"

services:

  redis-master:
    image: gcr.io/google_containers/redis:e2e
    ports:
      - "6379"

  redis-slave:
    image: gcr.io/google_samples/gb-redisslave:v1
    ports:
      - "6379"
    environment:
      - GET_HOSTS_FROM=dns

  frontend:
    image: gcr.io/google-samples/gb-frontend:v4
    ports:
      - "80:80"
    environment:
      - GET_HOSTS_FROM=dns
    labels:
      kompose.service.type: LoadBalancer
```

## Kompose Up

With a simple incantation of "kompose up", Kompose magically creates Kubernetes Deployments, Services, and PersistentVolumeClaims for your Dockerized application:

```bash
$ kompose up
We are going to create Kubernetes Deployments, Services and PersistentVolumeClaims for your Dockerized application.
If you need different kind of resources, use the 'kompose convert' and 'kubectl create -f' commands instead.

INFO Successfully created Service: redis
INFO Successfully created Service: web
INFO Successfully created Deployment: redis
INFO Successfully created Deployment: web

Your application has been deployed to Kubernetes. You can run 'kubectl get deployment,svc,pods,pvc' for details.
```

## kompose convert

But what if you need a different type of resources? No worries, Kompose has got you covered. The "kompose convert" command allows you to convert your Docker-compose configuration into Kubernetes friendly API objects:

```bash
$ kompose convert
INFO file "frontend-service.yaml" created
INFO file "redis-master-service.yaml" created
INFO file "redis-slave-service.yaml" created
INFO file "frontend-deployment.yaml" created
INFO file "redis-master-deployment.yaml" created
INFO file "redis-slave-deployment.yaml" created
```

So, in a nutshell, Kompose is an incredibly handy tool enabling the transformation of Docker-compose files into Kubernetes' language. Whether you need to scale a method or streamline deployment processes, Kompose is a powerful ally in the cloud orchestra.
