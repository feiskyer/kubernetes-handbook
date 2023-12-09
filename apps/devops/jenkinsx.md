# Jenkins X

[Jenkins X](http://jenkins-x.io/), sprinkled with the magic of Jenkins and Kubernetes, serves as an effective platform for CI/CD (Continuous Integration and Continuous Delivery) in the realm of cloud-native applications in a microservices structure. It introduces Jenkins, Helm, Draft, GitOps, Github, and similar power tools as components of an infrastructure that offers end-to-end support, right from cluster installation and environment management to continuous integration, deployment, and application publishing.

## Setting Up

### Installing the `jx` Command Line Tool

```bash
# MacOS
brew tap jenkins-x/jx
brew install jx

# Linux
curl -L https://github.com/jenkins-x/jx/releases/download/v1.1.10/jx-linux-amd64.tar.gz | tar xzv
sudo mv jx /usr/local/bin
```

### Deploying Your Kubernetes Cluster

You can skip this step if you already have a deployed Kubernetes cluster.

With the `jx` command, you can thrust your Kubernetes directly into the cloud:

```bash
create cluster aks      # Create a new kubernetes cluster on AKS: Runs on Azure
create cluster aws      # Create a new kubernetes cluster on AWS with kops
create cluster gke      # Create a new kubernetes cluster on GKE: Runs on Google Cloud
create cluster minikube # Create a new kubernetes cluster with minikube: Runs locally
```

### Launching Your Jenkins X Service

Before you introduce Jenkins X service into the mix, make sure that RBAC is activated in your Kubernetes cluster and insecure docker registries are on (`dockerd --insecure-registry=10.0.0.0/16`).

Execute the following command and follow the instructions to configure:

* An Ingress Controller (if not installed)
* Public IP's DNS of Ingress (with `ip.xip.io` as the default)
* Github API token (for conjuring github repos and webhooks)
* The Jenkins-X service
* Demonstration projects such as 'staging' and 'production', including github repo and Jenkins configuration, etc.

```bash
jx install --provider=kubernetes
```

When the installation wraps up, you'll get Jenkins's access point as well as the admin username and password to log into Jenkins.

## App Creation

Jenkins X takes you on a speedy ride to create new applications:

```bash
# To create a Spring Boot application
jx create spring -d web -d actuator

# For a quick start project creation
jx create quickstart  -l go
```

It also offers successful app imports, as long as:

* Github or equivalent git systems manage their source code and have Jenkins webhooks in place.
* Dockerfile, Jenkinsfile, and any required Helm Charts to run the app are added.

```bash
# Import from local
$ cd my-cool-app
$ jx import

# Import from Github
jx import --github --org myname

# Import from URL
jx import --url https://github.com/jenkins-x/spring-boot-web-example.git
```

## Publishing Apps

```bash
# To launch a recent version into the production environment
jx promote myapp --version 1.2.3 --env production
```

![](../../.gitbook/assets/jenkinsx%20%281%29.png)

## Usual Commands

```bash
# Get pipelines
jx get pipelines

# Get pipeline activities
jx get activities

# Get build logs
jx get build logs -f myapp

# Open Jenkins in the browser
jx console

# Get applications
jx get applications

# Get environments
jx get environments
```