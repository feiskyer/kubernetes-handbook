# Introducing Kubernetes

Kubernetes is an open-source container orchestration system released by Google. It's essentially the open-source version of Google's Borg, which represents years of Google's expertise in large-scale container management. Its key capabilities include:

* Applications deployment, maintenance, and rolling updates using containers
* Load balancing and service discovery
* Cluster scheduling across machines and regions
* Autoscaling
* Management of stateless and stateful services
* Extensive support for volumes
* Plug-in mechanism to ensure extensibility

Kubernetes has evolved quickly and has become the leader in the field of container orchestration.

## Kubernetes as a Platform

Kubernetes furnishes a plethora of functionalities that streamline the workflow of applications, thus accelerating development pace. Generally, a successful orchestration system needs robust automation, which is why Kubernetes was designed as a platform to build ecosystems of components and tools, making it easier to deploy, scale, and manage applications.

Users can manage resources in their own way using Labels and customize resource descriptions with Annotations—for example, providing state checks to management tools.

Moreover, Kubernetes Controllers are also built on the same APIs that are used by developers and users. One can write their own Controllers and Schedulers or expand the system's functionality with various plug-in mechanisms.

This design makes it convenient to build a variety of application systems atop Kubernetes.

## What Kubernetes is Not

Kubernetes is not your traditional, all-encompassing PaaS (Platform as a Service) system. It preserves the freedom of choice for its users.

* It does not restrict the types of applications it supports; it doesn't meddle with application frameworks or predetermine supported languages (like Java, Python, Ruby, etc.), with the only requirement being the application should be [12-factor](http://12factor.net/) compliant. Kubernetes aims to support an extraordinarily diverse array of workloads, including stateless, stateful, and data-processing workloads. If an app can run in a container, it should thrive on Kubernetes.
* It doesn't offer built-in middleware (like messaging), data-processing frameworks (like Spark), databases (like mysql), or cluster storage systems (like Ceph) - these apps run on top of Kubernetes.
* It doesn’t provide a click-to-deploy service marketplace.
* It doesn't deploy code or build your app, but you can build the necessary Continuous Integration (CI) workflows on Kubernetes.
* It allows users to opt for their  logging, monitoring, and alerting systems.
* It doesn't provide an application configuration language or system (like [jsonnet](https://github.com/google/jsonnet)).
* It doesn’t provide machine configuration, maintenance, management, or self-healing systems.

Moreover, many PaaS systems operate atop Kubernetes, like [Openshift](https://github.com/openshift/origin), [Deis](http://deis.io/), and [Eldarion](http://eldarion.cloud/). You can build your own PaaS, or simply utilize Kubernetes to manage your container applications.

Indeed, Kubernetes is more than just an "orchestration system"; it obviates the need for orchestration. Kubernetes maintains the desired state of applications through a declarative API and a series of independent, composable controllers, and users do not need to concern themselves with how intermediate states are achieved. This makes the system easier to use and more powerful, reliable, resilient, and scalable.

## Core Components

The core components of Kubernetes include:

* etcd holds the entire cluster state;
* apiserver acts as the front-end to the cluster, providing mechanisms for authentication, authorization, access control, API registration, and discovery;
* controller manager is responsible for maintaining the cluster's state—repairing perturbations, automatically scaling, rolling updates, etc.;
* scheduler dispatches pods to suitable machines according to predefined scheduling policies;
* kubelet is in charge of maintaining the container's lifecycle, and it also manages Volumes (CVI) and networking (CNI);
* Container runtime is responsible for image management and the actual running of Pods and containers (CRI);
* kube-proxy provides service discovery and load balancing within the cluster

![](../.gitbook/assets/architecture%20%2810%29.png)

## Kubernetes Versions

Kubernetes stable versions are supported for 9 months after their release. The support cycle for each version is as follows:

| Kubernetes version | Release month | End-of-life month |
| :----------------: | :-----------: | :---------------: |
|       v1.6.x       |   March 2017  |  December 2017   |
|       v1.7.x       |    June 2017  |     March 2018   |
|       v1.8.x       | September 2017 |      June 2018   |
|       v1.9.x       | December 2017  |  September 2018  |
|      v1.10.x       |   March 2018   |  December 2018   |
|      v1.11.x       |    June 2018   |     March 2019   |

## Reference Documents

* [What is Kubernetes?](https://kubernetes.io/docs/concepts/overview/what-is-kubernetes/)
* [HOW CUSTOMERS ARE REALLY USING KUBERNETES](https://apprenda.com/blog/customers-really-using-kubernetes/)