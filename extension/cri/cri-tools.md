# CRI-tools: The Debugging and Troubleshooting Companion

Conventionally, container engines come equipped with a command-line tool to help users debug applications and simplify troubleshooting. For instance, when Docker is employed as the container runtime, you can use the `docker` command to inspect the status of containers and images and verify the accuracy of a container's configuration. But what if you're using other container engines? Here's when `crictl` comes in as an outstanding substitute for the `docker` tool.

`Crictl` is a part of [cri-tools](https://github.com/kubernetes-incubator/cri-tools) and functions much like the `docker` command line. It offers the direct advantage of being able to communicate with the container runtime via CRI, without the need for Kubelet. Designed specifically for Kubernetes, it is efficient at managing resources such as Pods, containers, and images. It aids both developers and users in debugging application issues and troubleshooting anomalies. `Crictl` can be used with all container runtimes implementing CRI interfaces.

But don't mistake `crictl` as a substitution for `kubectl`; it solely communicates with the container runtime via the CRI and is useful for debugging and troubleshooting, not for executing containers. While `crictl` does have commands to run Pods and containers, it's recommended to use them for debugging purposes only. Be cautious; if you create new Pods on a Kubernetes Node, Kubelet will stop and delete them.

Moving beyond `crictl`, cri-tools also provides a validation test tool `critest`, which checks whether the container runtime has implemented the necessary CRI features. `Critest` ensures that the implementation of the container runtime aligns with Kubelet's requirements by conducting an array of tests. This highly recommended tool should run its tests on all container runtimes before release. In most cases, `critest` is a part of integrated container runtime testing, ensuring that any code updates won't damage CRI functionality.

CRI-tools officially had their General Availability (GA) release in Version 1.11. For detailed usage techniques, please refer to [kubernetes-sigs/cri-tools](https://github.com/kubernetes-sigs/cri-tools) and [Debugging Kubernetes nodes with crictl](https://kubernetes.io/docs/tasks/debug-application-cluster/crictl/).

## A Sneak Peek at crictl in Action

### Querying a Pod

```bash
$ crictl pods --name nginx-65899c769f-wv2gp
POD ID              CREATED             STATE               NAME                     NAMESPACE           ATTEMPT
4dccb216c4adb       2 minutes ago       Ready               nginx-65899c769f-wv2gp   default             0
```

### Listing Pods

```bash
$ crictl pods
POD ID              CREATED              STATE               NAME                         NAMESPACE           ATTEMPT
926f1b5a1d33a       About a minute ago   Ready               sh-84d7dcf559-4r2gq          default             0
4dccb216c4adb       About a minute ago   Ready               nginx-65899c769f-wv2gp       default             0
a86316e96fa89       17 hours ago         Ready               kube-proxy-gblk4             kube-system         0
919630b8f81f1       17 hours ago         Ready               nvidia-device-plugin-zgbbv   kube-system         0
```

### Listing Images

```bash
$ crictl images
IMAGE                                     TAG                 IMAGE ID            SIZE
busybox                                   latest              8c811b4aec35f       1.15MB
k8s-gcrio.azureedge.net/hyperkube-amd64   v1.10.3             e179bbfe5d238       665MB
k8s-gcrio.azureedge.net/pause-amd64       3.1                 da86e6ba6ca19       742kB
nginx                                     latest              cd5239a0906a6       109MB
```

### Listing Containers

```bash
$ crictl ps -a
CONTAINER ID        IMAGE                                                                                                             CREATED             STATE               NAME                       ATTEMPT
1f73f2d81bf98       busybox@sha256:141c253bc4c3fd0a201d32dc1f493bcf3fff003b6df416dea4f41046e0f37d47                                   7 minutes ago       Running             sh                         1
9c5951df22c78       busybox@sha256:141c253bc4c3fd0a201d32dc1f493bcf3fff003b6df416dea4f41046e0f37d47                                   8 minutes ago       Exited              sh                         0
87d3992f84f74       nginx@sha256:d0a8828cccb73397acb0073bf34f4d7d8aa315263f1e7806bf8c55d8ac139d5f                                     8 minutes ago       Running             nginx                      0
1941fb4da154f       k8s-gcrio.azureedge.net/hyperkube-amd64@sha256:00d814b1f7763f4ab5be80c58e98140dfc69df107f253d7fdd714b30a714260a   18 hours ago        Running             kube-proxy                 0
```

### Executing a Command Inside a Container

```bash
$ crictl exec -i -t 1f73f2d81bf98 ls
bin   dev   etc   home  proc  root  sys   tmp   usr   var
```

### Checking Container Logs

```bash
crictl logs 87d3992f84f74
10.240.0.96 - - [06/Jun/2018:02:45:49 +0000] "GET / HTTP/1.1" 200 612 "-" "curl/7.47.0" "-"
10.240.0.96 - - [06/Jun/2018:02:45:50 +0000] "GET / HTTP/1.1" 200 612 "-" "curl/7.47.0" "-"
10.240.0.96 - - [06/Jun/2018:02:45:51 +0000] "GET / HTTP/1.1" 200 612 "-" "curl/7.47.0" "-"
```

## Learn More

* [Debugging Kubernetes nodes with crictl](https://kubernetes.io/docs/tasks/debug-application-cluster/crictl/)
* [https://github.com/kubernetes-sigs/cri-tools](https://github.com/kubernetes-sigs/cri-tools)