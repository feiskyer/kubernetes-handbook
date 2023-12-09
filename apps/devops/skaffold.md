# Skaffold

[Skaffold](https://github.com/GoogleCloudPlatform/skaffold) is a tool open-sourced by Google to streamline development of local Kubernetes applications. It automates processes like building images, pushing these images and deploying Kubernetes services, making continuous development of Kubernetes applications easier. Its feature highlights include:

* No server components involved
* Detection of code changes for automatic build, push, and service deployment
* Management of image tags
* Support for existing workflow
* Deploy upon file saving

![](../../.gitbook/assets/skaffold1%20%283%29.png)

## Installation

```bash
# For Linux
curl -Lo skaffold https://storage.googleapis.com/skaffold/releases/latest/skaffold-linux-amd64 && chmod +x skaffold && sudo mv skaffold /usr/local/bin

# For MacOS
curl -Lo skaffold https://storage.googleapis.com/skaffold/releases/latest/skaffold-darwin-amd64 && chmod +x skaffold && sudo mv skaffold /usr/local/bin
```

## Usage

Before using Skaffold, make sure:

* The Kubernetes cluster has been deployed and local kubectl command line is configured.
* The local Docker is running and logged into DockerHub or another Docker Registry.
* The skaffold command line has been downloaded and placed in the system PATH path.

The Skaffold codebase provides a series of [examples](https://github.com/GoogleCloudPlatform/skaffold/tree/master/examples). Let's check out a simple one.

Download an example application:

```bash
$ git clone https://github.com/GoogleCloudPlatform/skaffold
$ cd skaffold/examples/getting-started
```

Modify the images in `k8s-pod.yaml` and `skaffold.yaml` files by replacing `gcr.io/k8s-skaffold` with Docker Registry you're logged into. Then, run skaffold

```bash
$ skaffold dev
Starting build...
Found [minikube] context, using local docker daemon.
Sending build context to Docker daemon  6.144kB
Step 1/5 : FROM golang:1.9.4-alpine3.7
 ---> fb6e10bf973b
Step 2/5 : WORKDIR /go/src/github.com/GoogleCloudPlatform/skaffold/examples/getting-started
 ---> Using cache
 ---> e9d19a54595b
Step 3/5 : CMD ./app
 ---> Using cache
 ---> 154b6512c4d9
Step 4/5 : COPY main.go .
 ---> Using cache
 ---> e097086e73a7
Step 5/5 : RUN go build -o app main.go
 ---> Using cache
 ---> 9c4622e8f0e7
Successfully built 9c4622e8f0e7
Successfully tagged 930080f0965230e824a79b9e7eccffbd:latest
Successfully tagged gcr.io/k8s-skaffold/skaffold-example:9c4622e8f0e7b5549a61a503bf73366a9cf7f7512aa8e9d64f3327a3c7fded1b
Build complete in 657.426821ms
Starting deploy...
Deploying k8s-pod.yaml...
Deploy complete in 173.770268ms
[getting-started] Hello world!
```

At this point, open another terminal. After you modify the contents of `main.go`, Skaffold automatically performs

* Creating a new image (with a unique sha256 TAG)
* Replacing the image in the `k8s-pod.yaml` file with the new TAG
* Redeploying `k8s-pod.yaml`