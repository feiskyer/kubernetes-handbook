# Unleash the Power of Spark on Kubernetes

![](https://i.imgur.com/6zYTLL8.png)

**Since Kubernetes v1.8, native support for Apache Spark applications has been available** [**(requiring Spark to support Kubernetes, e.g., v2.3)**](https://apache-spark-on-k8s.github.io/userdocs/running-on-kubernetes.html)**. You can submit Kubernetes tasks directly with the `spark-submit` command. Here's an example of computing Pi:**

```bash
bin/spark-submit \
  --deploy-mode cluster \
  --class org.apache.spark.examples.SparkPi \
  --master k8s://https://<k8s-apiserver-host>:<k8s-apiserver-port> \
  --kubernetes-namespace default \
  --conf spark.executor.instances=5 \
  --conf spark.app.name=spark-pi \
  --conf spark.kubernetes.driver.docker.image=kubespark/spark-driver:v2.2.0-kubernetes-0.4.0 \
  --conf spark.kubernetes.executor.docker.image=kubespark/spark-executor:v2.2.0-kubernetes-0.4.0 \
  local:///opt/spark/examples/jars/spark-examples_2.11-2.2.0-k8s-0.4.0.jar
```

**Or, the Python version:**

```bash
bin/spark-submit \
  --deploy-mode cluster \
  --master k8s://https://<k8s-apiserver-host>:<k8s-apiserver-port> \
  --kubernetes-namespace <k8s-namespace> \
  --conf spark.executor.instances=5 \
  --conf spark.app.name=spark-pi \
  --conf spark.kubernetes.driver.docker.image=kubespark/spark-driver-py:v2.2.0-kubernetes-0.4.0 \
  --conf spark.kubernetes.executor.docker.image=kubespark/spark-executor-py:v2.2.0-kubernetes-0.4.0 \
  --jars local:///opt/spark/examples/jars/spark-examples_2.11-2.2.0-k8s-0.4.0.jar \
  --py-files local:///opt/spark/examples/src/main/python/sort.py \
  local:///opt/spark/examples/src/main/python/pi.py 10
```

## Deploying Spark on Kubernetes

A detailed method for deploying Spark is provided on the [github Kubernetes examples](https://github.com/kubernetes/examples/tree/master/staging/spark). To simplify some steps for an easier installation, follow the instructions below.

### Deployment Prerequisites

* A Kubernetes cluster, refer to [Cluster Deployment](../../setup/cluster/)
* kube-dns functioning properly

### Creating a Namespace

namespace-spark-cluster.yaml

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: "spark-cluster"
  labels:
    name: "spark-cluster"
```

```bash
$ kubectl create -f examples/staging/spark/namespace-spark-cluster.yaml
```

For simplicity, we will not switch the kubectl context to spark-cluster. Instead, we will add the spark-cluster namespace to subsequent deployments.

### Deploying the Master Service

Create a replication controller to run the Spark Master service.

```yaml
kind: ReplicationController
apiVersion: v1
metadata:
  name: spark-master-controller
  namespace: spark-cluster
spec:
  replicas: 1
  selector:
    component: spark-master
  template:
    metadata:
      labels:
        component: spark-master
    spec:
      containers:
        - name: spark-master
          image: gcr.io/google_containers/spark:1.5.2_v1
          command: ["/start-master"]
          ports:
            - containerPort: 7077
            - containerPort: 8080
          resources:
            requests:
              cpu: 100m
```

```bash
$ kubectl create -f spark-master-controller.yaml
```

**Create the master service.**

spark-master-service.yaml

```yaml
kind: Service
apiVersion: v1
metadata:
  name: spark-master
  namespace: spark-cluster
spec:
  ports:
    - port: 7077
      targetPort: 7077
      name: spark
    - port: 8080
      targetPort: 8080
      name: http
  selector:
    component: spark-master
```

```bash
$ kubectl create -f spark-master-service.yaml
```

**Check if the Master is running properly.**

```bash
$ kubectl get pod -n spark-cluster
```

For observing our Spark cluster via the Spark-developed web UI, deploy [specialized proxy](https://github.com/aseigneurin/spark-ui-proxy).

Deploy Spark workers to ensure the Master is up and running. Also create the Zeppelin UI, which allows direct task execution on our cluster through a web notebook, seen at [Zeppelin UI](https://zeppelin.apache.org) and [Spark architecture](https://spark.apache.org/docs/latest/cluster-overview.html).

Once done, the Spark cluster is established.

### Common Issues with Zeppelin

* The Zeppelin image is quite large and takes some time to pull. Details at issue \#17231.
* `kubectl port-forward` may be unstable on the GKE platform; restart as needed. See issue \#12179 for reference.

## Reference Documents

* [Apache Spark on Kubernetes](https://apache-spark-on-k8s.github.io/userdocs/index.html)
* [https://github.com/kweisamx/spark-on-kubernetes](https://github.com/kweisamx/spark-on-kubernetes)
* [Spark examples](https://github.com/kubernetes/examples/tree/master/staging/spark)