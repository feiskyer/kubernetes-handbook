# Operator

The Operator, brought to you by CoreOS, is a framework designed to simplify and streamline the management of complex, stateful applications. It is a controller that perceives the status of applications, extending Kubernetes API for automated creation, management, and configuration of application instances.

You can identify some recommended Operator examples within the Kubernetes community on [OperatorHub.io](https://www.operatorhub.io/).

## The Mechanics of the Operator

The Operator works by extending new application resources through CustomResourceDefinition (CRD) and ensuring the application is in the desired state by using a controller. For instance, the etcd operator emulates the behavior of etcd cluster management through the following three steps:

1. Observing the current state of the cluster via the Kubernetes API;
2. Analyzing the differences between the current state and the desired state;
3. Modifying these discrepancies by calling the etcd cluster management API or the Kubernetes API.

![etcd](../../.gitbook/assets/etcd%20%282%29.png)

## Creating an Operator

Since an Operator is a controller that's attentive to application states, the key to implementing an Operator is to encapsulate all the operations managing the application state into the configuration resources and the controller. Generally speaking, Operator needs to comprise the following features:

* Deploy the Operator itself as a Deployment
* Automate the creation of a CustomResourceDefinition (CRD) resource type, and the user can use this type to create application instances
* Use built-in Service/Deployment in Kubernetes to manage applications
* Be backward-compatible and its carry-over or deletion should not affect the state of the application
* Support application version update
* Test Pod failure, configuration error, network error, and other abnormal situations

The simplest way to create a new Operator is to utilize the [Operator Framework](https://github.com/operator-framework). For instance, creating the most basic Operator only requires these steps:

(1) Install the operator-sdk tool:

```bash
$ mkdir -p $GOPATH/src/github.com/operator-framework
$ cd $GOPATH/src/github.com/operator-framework
$ git clone https://github.com/operator-framework/operator-sdk
$ cd operator-sdk
$ git checkout master
$ make dep
$ make install
```

(2) Initialize the project:

```bash
$ mkdir memcached-operator
$ cd memcached-operator
$ operator-sdk init --domain example.com --repo github.com/example/memcached-operator
```

(3) Add CRD definition and controller:

```bash
$ operator-sdk create api --group cache --version v1alpha1 --kind Memcached --resource --controller
```

(4) Implement Controller, Reconciler, and other control logics.

(5) Deploy Operator to the Kubernetes cluster and create resources through customized CRD.

You can refer to this [example](https://github.com/operator-framework/operator-sdk/tree/master/testdata) for a complete guide.

## Using an Operator

For ease of description, we will use Etcd Operator as an example - [Etcd Operator](https://coreos.com/operators/etcd/docs/latest).

Deploy the Operator in Kubernetes: You can deploy the corresponding Operator by creating a Deploymet instance in the Kubernetes cluster. Here is an example of a Yaml：

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: admin
  namespace: default

---
kind: ClusterRoleBinding
apiVersion: rbac.authorization.k8s.io/v1alpha1
metadata:
  name: admin
subjects:
  - kind: ServiceAccount
    name: admin
    namespace: default
roleRef:
  kind: ClusterRole
  name: cluster-admin
  apiGroup: rbac.authorization.k8s.io
---
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: etcd-operator
spec:
  replicas: 1
  template:
    metadata:
      labels:
        name: etcd-operator
    spec:
      serviceAccountName: admin
      containers:
      - name: etcd-operator
        image: quay.io/coreos/etcd-operator:v0.4.2
        env:
        - name: MY_POD_NAMESPACE
          valueFrom:
            fieldRef:
              fieldPath: metadata.namespace
        - name: MY_POD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
```

```bash
# kubectl create -f deployment.yaml
serviceaccount "admin" created
clusterrolebinding "admin" created
deployment "etcd-operator" created

# kubectl  get pod
NAME                            READY     STATUS    RESTARTS   AGE
etcd-operator-334633986-3nzk1   1/1       Running   0          31s
```

Check if the operator is successfully deployed:

```bash
# kubectl get thirdpartyresources
NAME                      DESCRIPTION             VERSION(S)
cluster.etcd.coreos.com   Managed etcd clusters   v1beta1
```

Here is an example of a yaml file for a stateful service:

```yaml
apiVersion: "etcd.coreos.com/v1beta1"
kind: "Cluster"
metadata:
  name: "example-etcd-cluster"
spec:
  size: 3
  version: "3.1.8"
```

Deploy the corresponding stateful service:

```bash
# kubectl create -f example-etcd-cluster.yaml
Cluster "example-etcd-cluster" created

# kubectl get  cluster
NAME                                        KIND
example-etcd-cluster   Cluster.v1beta1.etcd.coreos.com

# kubectl get  service
NAME                          CLUSTER-IP      EXTERNAL-IP   PORT(S)
example-etcd-cluster          None            <none>        2379/TCP,2380/TCP
example-etcd-cluster-client   10.105.90.190   <none>        2379/TCP

# kubectl get pod
NAME                            READY     STATUS    RESTARTS   AGE
example-etcd-cluster-0002       1/1       Running   0          5h
example-etcd-cluster-0003       1/1       Running   0          4h
example-etcd-cluster-0004       1/1       Running   0          4h
```

## Additional Examples

* [Prometheus Operator](https://coreos.com/operators/prometheus/docs/latest)
* [Rook Operator](https://github.com/rook/rook): Cloud-native storage orchestrator
* [Tectonic Operators](https://coreos.com/tectonic)
* [https://github.com/sapcc/kubernetes-operators](https://github.com/sapcc/kubernetes-operators)
* [https://github.com/kbst/memcached](https://github.com/kbst/memcached)
* [https://github.com/Yolean/kubernetes-kafka](https://github.com/Yolean/kubernetes-kafka)
* [https://github.com/krallistic/kafka-operator](https://github.com/krallistic/kafka-operator)
* [https://github.com/huawei-cloudfederation/redis-operator](https://github.com/huawei-cloudfederation/redis-operator)
* [https://github.com/upmc-enterprises/elasticsearch-operator](https://github.com/upmc-enterprises/elasticsearch-operator)
* [https://github.com/pires/nats-operator](https://github.com/pires/nats-operator)
* [https://github.com/rosskukulinski/rethinkdb-operator](https://github.com/rosskukulinski/rethinkdb-operator)
* [https://github.com/jxlwqq/wordpress-operator](https://github.com/jxlwqq/wordpress-operator)
* [https://github.com/jxlwqq/guestbook-operator](https://github.com/jxlwqq/guestbook-operator)
* [https://github.com/jxlwqq/visitors-operator](https://github.com/jxlwqq/visitors-operator)
* [https://istio.io/](https://istio.io/)

## Relationship with Other Tools

* StatefulSets: StatefulSets provide DNS, persistent storage, etc., for stateful services, while Operator can automatically handle complex scenarios such as service failure, backup, reconfiguration, etc.
* Puppet: Puppet is a static configuration tool, while Operator can keep the application in the desired state in real time and dynamically.
* Helm: Helm is a packaging tool that can deploy multiple applications together, while Operator can be considered a supplement to Helm, used to dynamically ensure the normal operation of these applications.

## Reference

* [Kubernetes Operators](https://coreos.com/operators)
* [Operator Framework](https://github.com/operator-framework)
* [OperatorHub.io](https://www.operatorhub.io/)
* [KubeDB: Run production-grade databases easily on Kubernetes](https://kubedb.com/)