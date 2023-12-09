## Distributed Load Testing

This tutorial explains how to conduct distributed load balancing tests within [Kubernetes](http://kubernetes.io) environment, including a web application, docker images, and Kubernetes controllers/services. For additional information, please refer to [Distributed Load Testing Using Kubernetes](http://cloud.google.com/solutions/distributed-load-testing-using-kubernetes).

## Preparation

**You do not need GCE or other components; a Kubernetes cluster suffices.**

If you do not have a Kubernetes cluster, you can deploy one by following the [kubernetes-handbook](https://www.gitbook.com/book/feisky/kubernetes).

## Deploying the Web Application

The `sample-webapp` directory contains a simple web test application. We will build it into a docker image to run in Kubernetes. You can build it yourself, or directly use the image I have built: `index.tenxcloud.com/jimmy/k8s-sample-webapp:latest`.

Deploy the sample-webapp on Kubernetes.

```bash
$ cd kubernetes-config
$ kubectl create -f sample-webapp-controller.yaml
$ kubectl create -f sample-webapp-service.yaml
```

## Deploying Controllers and Services for Locust

`locust-master` and `locust-worker` utilize the same docker image. Modify the `spec.template.spec.containers.env` field value within the controller to the name of your `sample-webapp` service.

    - name: TARGET_HOST
      value: http://sample-webapp:8000

### Creating the Controller Docker Image (Optional)

Both `locust-master` and `locust-worker` controllers use the `locust-tasks` docker image. You may directly download `gcr.io/cloud-solutions-images/locust-tasks`, or compile it yourself. Compiling it yourself may take several minutes, with the image size being 820M.

    $ docker build -t index.tenxcloud.com/jimmy/locust-tasks:latest .
    $ docker push index.tenxcloud.com/jimmy/locust-tasks:latest

**Note**: I am using an image repository from Tenxcloud.

Each controller's yaml `spec.template.spec.containers.image` field specifies my image:

    image: index.tenxcloud.com/jimmy/locust-tasks:latest
### Deploying locust-master

```bash
$ kubectl create -f locust-master-controller.yaml
$ kubectl create -f locust-master-service.yaml
```

### Deploying locust-worker

Now deploy the `locust-worker-controller`:

```bash
$ kubectl create -f locust-worker-controller.yaml
```
You can easily scale up the workers using the command line:

```bash
$ kubectl scale --replicas=20 replicationcontrollers locust-worker
```
Alternatively, you can scale through the WebUI: Dashboard - Workloads - Replication Controllers - **ServiceName** - Scale.

![dashboard-scale](images/dashbaord-scale.jpg)

### Configuring Traefik

Refer to the [Traefik ingress installation in Kubernetes](https://github.com/feiskyer/kubernetes-handbook/blob/master/practice/service-discovery-lb/traefik-ingress-installation.md) and add the following configuration to `ingress.yaml`:

```Yaml
  - host: traefik.locust.io
    http:
      paths:
      - path: /
        backend:
          serviceName: locust-master
          servicePort: 8089
```

Then execute `kubectl replace -f ingress.yaml` to update Traefik.

The newly added `traefik.locust.io` node can be observed through Traefik's dashboard.

![traefik-dashboard-locust](images/traefik-dashboard-locust.jpg)

## Conducting the Test

Open the `http://traefik.locust.io` page, click `Edit` to enter the number of simulated users and the request rate per second, then click `Start Swarming` to begin testing.

![locust-start-swarming](images/locust-start-swarming.jpg)

During the test, adjust the number of `sample-webapp` pods (1 pod set by default) and observe changes in the pod load.

![sample-webapp-rc](images/sample-webapp-rc.jpg)

Over a period of observation, it becomes evident that the load is evenly distributed among the three pods.

You can watch the load testing process in real-time on the locust page or download the test results.

![locust-dashboard](images/locust-dashboard.jpg)

---

## Conducting Distributed Load Experiments With Ease in Kubernetes

Ever wondered how your web application withstands heavy traffic? This hands-on guide walks you through performing distributed load tests using [Kubernetes](http://kubernetes.io). Whether you're testing a new app or stress-testing an existing one, you'll find valuable insights. For a complete picture, visit [Distributed Load Testing Using Kubernetes](http://cloud.google.com/solutions/distributed-load-testing-using-kubernetes).

## Getting Started

**Forget GCE or other add-ons. All you need is a Kubernetes cluster.**

Don't have a cluster yet? No worries. You can easily set one up using the [kubernetes-handbook](https://www.gitbook.com/book/feisky/kubernetes).

## Setting Up Your Web Application

Inside the `sample-webapp` folder lies a straightforward web testing application. Dockerize it to spin up on Kubernetes — build it yourself or pull my ready-to-go image: `index.tenxcloud.com/jimmy/k8s-sample-webapp:latest`.

It's time to deploy the sample-webapp to Kubernetes:

```bash
$ cd kubernetes-config
$ kubectl create -f sample-webapp-controller.yaml
$ kubectl create -f sample-webapp-service.yaml
```

## Unleashing Locust: Deployment of Controllers and Services

`locust-master` and `locust-worker` share a Docker image. Just swap in your `sample-webapp` service name for the `spec.template.spec.containers.env` value:

    - name: TARGET_HOST
      value: http://sample-webapp:8000

### Craft Your Own Controller Docker Image (If You Wish)

Dive into Docker for `locust-master` and `locust-worker` with the `locust-tasks` image. Snag `gcr.io/cloud-solutions-images/locust-tasks` or DIY. If you opt to DIY, you're looking at a few minutes and an 820MB image.

    $ docker build -t index.tenxcloud.com/jimmy/locust-tasks:latest .
    $ docker push index.tenxcloud.com/jimmy/locust-tasks:latest

**Heads up**: These instructions are tailored for Tenxcloud's image hub.

Controllers are all about my image in the yaml's `spec.template.spec.containers.image`:

    image: index.tenxcloud.com/jimmy/locust-tasks:latest
### Lay the Groundwork for locust-master

```bash
$ kubectl create -f locust-master-controller.yaml
$ kubectl create -f locust-master-service.yaml
```

### Deploying the locust-worker

Get the `locust-worker-controller` up and running next:

```bash
$ kubectl create -f locust-worker-controller.yaml
```
Scaling workers is a breeze via command line:

```bash
$ kubectl scale --replicas=20 replicationcontrollers locust-worker
```
Or take the scenic route via WebUI: Dashboard - Workloads - Replication Controllers - **ServiceName** - Scale.

![dashboard-scale](images/dashbaord-scale.jpg)

### Seamless Traefik Integration

Take cues from [Kubernetes' Traefik ingress setup](https://github.com/feiskyer/kubernetes-handbook/blob/master/practice/service-discovery-lb/traefik-ingress-installation.md) and slip these settings into `ingress.yaml`:

```Yaml
  - host: traefik.locust.io
    http:
      paths:
      - path: /
        backend:
          serviceName: locust-master
          servicePort: 8089
```

Execute `kubectl replace -f ingress.yaml` and voilà — Traefik's updated.

Your `traefik.locust.io` node will gleam on Traefik's dashboard.

![traefik-dashboard-locust](images/traefik-dashboard-locust.jpg)

## Putting It to the Test

Launch `http://traefik.locust.io`, hit `Edit` to dial in the synthetic user count and hatch rate, then press `Start Swarming` to kick off the test.

![locust-start-swarming](images/locust-start-swarming.jpg)

Play with the `sample-webapp` pod numbers as the test runs — defaulting to a solo pod — and monitor the workload's ebb and flow.

![sample-webapp-rc](images/sample-webapp-rc.jpg)

Soon enough, you'll notice the load spreading evenly across three pods.

Stay on top of the action with locust's live updates, or grab the results post-test.

![locust-dashboard](images/locust-dashboard.jpg)