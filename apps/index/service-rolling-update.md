# Graceful Upgrade Rollouts

Ever confused about how to perform a rolling, seamless upgrade when a new version of the image is released and the new version service goes online?

If you're using pods created by **ReplicationController**, you can smoothly update their version by using the `kubectl rollingupdate` command. However, if your pods are created using **Deployment**, updates are as easy as modifying the yaml file and then running `kubectl apply`.

Deployment has an integrated RollingUpdate strategy, which negates the need for the `kubectl rollingupdate` command. The update process involves creating a new version of the pod, redirecting the traffic to the new pod, and then eliminating the previous version of the pod.

The Rolling Update feature is applicable to both `Deployment` and `Replication Controller`, with the official recommendation swinging towards Deployments over Replication Controllers.

Please refer to the official site for instructions on how to perform a smooth upgrade using the ReplicationController: [https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#rolling-update-deployment](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#rolling-update-deployment)

## The Relationship Between ReplicationController and Deployment

The RollingUpdate command varies slightly between ReplicationController and Deployment, but both implement it with the same underlying mechanism. I've borrowed a few points on these two kinds' relationship from a section in [The Difference Between ReplicationController and Deployment](https://segmentfault.com/a/1190000008232770). For a more detailed comparison, please peruse the original article.

### ReplicationController

The Replication Controller is a key feature of Kubernetes. Once an application is hosted on Kubernetes, it's crucial to ensure its continuous operation. And that's exactly what Replication Controller guarantees. Its major elements are:

* Ensuring the quantity of pods: It ensures that the specified number of Pods are running in Kubernetes. If there don't exist enough pods, the Replication Controller creates new ones. Conversely, if there are too many, it deletes the excess ones to retain the pod count right.
* Ensuring pod health: When a pod is unhealthy or fails to provide services, the Replication Controller abolishes the troubled pods and creates new ones. 
* Elastic scaling: During business peaks and off-peaks, the Replication Controller dynamically adjusts the number of pods to increase resource utilization. Meanwhile, with the configured monitoring function (Hroizontal Pod Autoscaler), it automatically fetches the overall resource usage situation of the pods associated with the Replication Controller from the monitoring platform, achieving automatic scaling.
* Rolling upgrade: Rolling upgrade is a stable upgrade method that ensures the system's overall stability by gradually replacing elements. It helps discover and solve problems promptly when initiating an upgrade to prevent the problem from magnifying.

### Deployment

Deployment, just like ReplicationController, is a core component of Kubernetes, majorly responsible for ensuring the number and health of pods. Despite being quite similar to ReplicationController—almost 90% of functions between the two are identical—Deployment is like the upgraded version of ReplicationController, possessing some additional features:

* Inherits all the functions of Replication Controller: Deployment unifies all the features described above for Replication Controller.
* Event and status viewing: You can view detailed progress and status of the Deployment upgrade.
* Rollback: If an issue is discovered when upgrading the pod image or related parameters, you can revert to the previously stable version or a specified version using the rollback operation.
* Version history: Every operation performed on Deployment is logged, permitting possible future rollbacks.
* Pause and Resume: You can pause and restart each upgrade at any time.
* Variety of upgrade strategies: Recreate—delete all existing pods and create new ones; RollingUpdate—gradually replace the strategy and support more additional parameters, such as setting the maximum unavailable pod count, the shortest upgrade interval, and so forth.

## Creating a Test Image

Let's generate an ultra-simple web service. When you visit the webpage, it will output a version message. By distinguishing this message output, we can verify whether the upgrade is complete.

All configurations and codes are available in the [manifests/test/rolling-update-test](https://github.com/feiskyer/kubernetes-handbook/tree/master/manifests/test/rolling-update-test) directory.

**Coding Web Service main.go**

```go
package main

import (
  "fmt"
  "log"
  "net/http"
)

func sayhello(w http.ResponseWriter, r *http.Request) {
  fmt.Fprintf(w, "This is version 1.") // This writes to w and outputs to the client
}

func main() {
  http.HandleFunc("/", sayhello) // Set up access routing
  log.Println("This is version 1.")
  err := http.ListenAndServe(":9090", nil) // Set the listening port
  if err != nil {
    log.Fatal("ListenAndServe:", err)
  }
}
```

**Creating Dockerfile**

```text
FROM alpine:3.5
ADD hellov2 /
ENTRYPOINT ["/hellov2"]
```

Please ensure to alter the name of the file that you're adding.

 **Creating Makefile**

Modify the image library's address to your private image library address.

Change `TAG` to a new version number in `Makefile`.

```text
all: build push clean
.PHONY: build push clean

TAG = v1

# Build for linux amd64
build:
  GOOS=linux GOARCH=amd64 go build -o hello${TAG} main.go
  docker build -t sz-pg-oam-docker-hub-001.tendcloud.com/library/hello:${TAG} .

# Push to tenxcloud
push:
  docker push sz-pg-oam-docker-hub-001.tendcloud.com/library/hello:${TAG}

# Clean
clean:
  rm -f hello${TAG}
```

 **Compilation**

```text
make all
```

Modify the output statement in main.go, the filename in Dockerfile, and the TAG in Makefile to create images of two different versions.

## Testing

We'll use the Deployment deployment service for testing.

Configuration file `rolling-update-test.yaml`:

```yaml
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
    name: rolling-update-test
spec:
  replicas: 3
  template:
    metadata:
      labels:
        app: rolling-update-test
    spec:
      containers:
      - name: rolling-update-test
        image: sz-pg-oam-docker-hub-001.tendcloud.com/library/hello:v1
        ports:
        - containerPort: 9090
---
apiVersion: v1
kind: Service
metadata:
  name: rolling-update-test
  labels:
    app: rolling-update-test
spec:
  ports:
  - port: 9090
    protocol: TCP
    name: http
  selector:
    app: rolling-update-test
```

 **Deploying service**

```text
kubectl create -f rolling-update-test.yaml
```

 **Modifying traefik ingress configuration**

Add new service configuration to the `ingress.yaml` file.

```yaml
  - host: rolling-update-test.traefik.io
    http:
      paths:
      - path: /
        backend:
          serviceName: rolling-update-test
          servicePort: 9090
```

Amend your local host configuration by adding another configuration:

```text
172.20.0.119 rolling-update-test.traefik.io
```

Note: 172.20.0.119 is the VIP we created earlier using keepalived.

Open a browser and visit `http://rolling-update-test.traefik.io`; you'll see the following output:

```text
This is version 1.
```

 **Rolling Upgrade**

Simply change the `image` in the `rolling-update-test.yaml` file to the new image name and then execute:

```text
kubectl apply -f rolling-update-test.yaml
```

You can also refer to the methods in [Kubernetes Deployment Concept](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) and set a new image directly.

```text
kubectl set image deployment/rolling-update-test rolling-update-test=sz-pg-oam-docker-hub-001.tendcloud.com/library/hello:v2
```

Or use `kubectl edit deployment/rolling-update-test` to save after modifying the image name.

Check the upgrade progress with the following command:

```text
kubectl rollout status deployment/rolling-update-test
```

After the upgrade is completed, refresh `http://rolling-update-test.traefik.io` in your browser and you'll see the following output:

```text
This is version 2.
```

It indicates the success of a rolling upgrade.

## How to Perform a RollingUpdate on Pods Created Using ReplicationController

The above explanation details how to carry out a RollingUpdate on Pods created using **Deployment**. But, what if you have pods created using the traditional **ReplicationController**? How can they be updated?

For instance:

```bash
$ kubectl -n spark-cluster rolling-update zeppelin-controller --image sz-pg-oam-docker-hub-001.tendcloud.com/library/zeppelin:0.7.1
Created zeppelin-controller-99be89dbbe5cd5b8d6feab8f57a04a8b
Scaling up zeppelin-controller-99be89dbbe5cd5b8d6feab8f57a04a8b from 0 to 1, scaling down zeppelin-controller from 1 to 0 (keep 1 pods available, don't exceed 2 pods)
Scaling zeppelin-controller-99be89dbbe5cd5b8d6feab8f57a04a8b up to 1
Scaling zeppelin-controller down to 0
Update succeeded. Deleting old controller: zeppelin-controller
Renaming zeppelin-controller-99be89dbbe5cd5b8d6feab8f57a04a8b to zeppelin-controller
replicationcontroller "zeppelin-controller" rolling updated
```

You just need to specify a new image and configure the RollingUpdate policy as needed.

## Reference

* [Rolling update mechanism analysis](http://dockone.io/article/328)
* [Running a Stateless Application Using a Deployment](https://kubernetes.io/docs/tasks/run-application/run-stateless-application-deployment/)
* [Simple Rolling Update](https://github.com/kubernetes/community/blob/master/contributors/design-proposals/cli/simple-rolling-update.md)
* [Using kubernetes's deployment for RollingUpdate](https://segmentfault.com/a/1190000008232770)