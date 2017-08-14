# Spark on Kubernetes 
![](https://i.imgur.com/6zYTLL8.png)

如何再kubernetes上佈署spark



官方的[github](https://github.com/kubernetes/examples/tree/master/staging/spark)

由于他的步骤设置有些複杂,这边简化一些部份让大家再装的时候不用去多设定一些东西

[https://github.com/kweisamx/spark-on-kubernetes](https://github.com/kweisamx/spark-on-kubernetes)

## 佈署条件

* 一个kubernetes群集,可参考[集群部署](https://feisky.gitbooks.io/kubernetes/deploy/cluster.html)
* kube-dns正常运作

## 产生一个命名空间

namespace-spark-cluster.yaml
```
apiVersion: v1
kind: Namespace
metadata:
  name: "spark-cluster"
  labels:
    name: "spark-cluster"
```

```
$ kubectl create -f examples/staging/spark/namespace-spark-cluster.yaml
```

这边原文提到需要将kubectl的执行环境转到spark-cluster,这边为了方便我们不这样做,而是将之后的佈署命名空间都加入spark-cluster


## 佈署Master Service

建立一个replication controller,来运行Spark Master服务
```
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


```
$ kubectl create -f spark-master-controller.yaml
```

并提供端口以存取服务


spark-master-service.yaml
```
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
```
$ kubectl create -f spark-master-service.yaml
```

检查Master 是否正常运行
```
$ kubectl get pod -n spark-cluster 
spark-master-controller-qtwm8     1/1       Running   0          6d
```
```
$ kubectl logs spark-master-controller-qtwm8 -n spark-cluster 
17/08/07 02:34:54 INFO Master: Registered signal handlers for [TERM, HUP, INT]
17/08/07 02:34:54 INFO SecurityManager: Changing view acls to: root
17/08/07 02:34:54 INFO SecurityManager: Changing modify acls to: root
17/08/07 02:34:54 INFO SecurityManager: SecurityManager: authentication disabled; ui acls disabled; users with view permissions: Set(root); users with modify permissions: Set(root)
17/08/07 02:34:55 INFO Slf4jLogger: Slf4jLogger started
17/08/07 02:34:55 INFO Remoting: Starting remoting
17/08/07 02:34:55 INFO Remoting: Remoting started; listening on addresses :[akka.tcp://sparkMaster@spark-master:7077]
17/08/07 02:34:55 INFO Utils: Successfully started service 'sparkMaster' on port 7077.
17/08/07 02:34:55 INFO Master: Starting Spark master at spark://spark-master:7077
17/08/07 02:34:55 INFO Master: Running Spark version 1.5.2
17/08/07 02:34:56 INFO Utils: Successfully started service 'MasterUI' on port 8080.
17/08/07 02:34:56 INFO MasterWebUI: Started MasterWebUI at http://10.2.6.12:8080
17/08/07 02:34:56 INFO Utils: Successfully started service on port 6066.
17/08/07 02:34:56 INFO StandaloneRestServer: Started REST server for submitting applications on port 6066
17/08/07 02:34:56 INFO Master: I have been elected leader! New state: ALIVE
```


若master 已经被建立与运行,我们可以透过Spark开发的webUI来察看我们spark的群集状况,我们将佈署[specialized proxy](https://github.com/aseigneurin/spark-ui-proxy)


spark-ui-proxy-controller.yaml
```
kind: ReplicationController
apiVersion: v1
metadata:
  name: spark-ui-proxy-controller
  namespace: spark-cluster
spec:
  replicas: 1
  selector:
    component: spark-ui-proxy
  template:
    metadata:
      labels:
        component: spark-ui-proxy
    spec:
      containers:
        - name: spark-ui-proxy
          image: elsonrodriguez/spark-ui-proxy:1.0
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: 100m
          args:
            - spark-master:8080
          livenessProbe:
              httpGet:
                path: /
                port: 80
              initialDelaySeconds: 120
              timeoutSeconds: 5
```

```
$ kubectl create -f spark-ui-proxy-controller.yaml
```

提供一个service做存取,这边原文是使用LoadBalancer type,这边我们改成NodePort,如果你的kubernetes运行环境是在cloud provider,也可以参考原文作法

spark-ui-proxy-service.yaml
```
kind: Service
apiVersion: v1
metadata:
  name: spark-ui-proxy
  namespace: spark-cluster
spec:
  ports:
    - port: 80
      targetPort: 80
      nodePort: 30080
  selector:
    component: spark-ui-proxy
  type: NodePort
```
```
$ kubectl create -f spark-ui-proxy-service.yaml
```

不数完后你可以利用[kubecrl proxy](https://kubernetes.io/docs/tasks/access-kubernetes-api/http-proxy-access-api/)来察看你的Spark群集状态

```
$ kubectl proxy --port=8001
```

可以透过[http://localhost:8001/api/v1/proxy/namespaces/spark-cluster/services/spark-master:8080](http://localhost:8001/api/v1/proxy/namespaces/spark-cluster/services/spark-master:8080/)
察看,若kubectl中断就无法这样观察了,但我们再先前有设定nodeport
所以也可以透过任意台node的端口30080去察看
例如：http://10.201.2.34:30080
10.201.2.34是群集的其中一台node,这边可换成你自己的


## 佈署 Spark workers

要先确定Matser是再运行的状态

spark-worker-controller.yaml
```
kind: ReplicationController
apiVersion: v1
metadata:
  name: spark-worker-controller
  namespace: spark-cluster
spec:
  replicas: 2
  selector:
    component: spark-worker
  template:
    metadata:
      labels:
        component: spark-worker
    spec:
      containers:
        - name: spark-worker
          image: gcr.io/google_containers/spark:1.5.2_v1
          command: ["/start-worker"]
          ports:
            - containerPort: 8081
          resources:
            requests:
              cpu: 100m
```

```
$ kubectl create -f spark-worker-controller.yaml
replicationcontroller "spark-worker-controller" created
```

透过指令察看运行状况

```
$ kubectl get pod -n spark-cluster 
spark-master-controller-qtwm8     1/1       Running   0          6d
spark-worker-controller-4rxrs     1/1       Running   0          6d
spark-worker-controller-z6f21     1/1       Running   0          6d
spark-ui-proxy-controller-d4br2   1/1       Running   4          6d

```

也可以透过上面建立的WebUI服务去察看

基本上到这边Spark的群集已经建立完成了


## 建立 Zeppelin UI 来运行工作

我们可以利用Zeppelin UI经由web notebook直接去执行我们的任务,
详情可以看[Zeppelin UI](http://zeppelin.apache.org/)与[ Spark architecture](https://spark.apache.org/docs/latest/cluster-overview.html)

zeppelin-controller.yaml
```
kind: ReplicationController
apiVersion: v1
metadata:
  name: zeppelin-controller
  namespace: spark-cluster
spec:
  replicas: 1
  selector:
    component: zeppelin
  template:
    metadata:
      labels:
        component: zeppelin
    spec:
      containers:
        - name: zeppelin
          image: gcr.io/google_containers/zeppelin:v0.5.6_v1
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: 100m
```


```
$ kubectl create -f zeppelin-controller.yaml
replicationcontroller "zeppelin-controller" created
```

然后一样佈署Service

zeppelin-service.yaml
```
kind: Service
apiVersion: v1
metadata:
  name: zeppelin
  namespace: spark-cluster
spec:
  ports:
    - port: 80
      targetPort: 8080
      nodePort: 30081
  selector:
    component: zeppelin
  type: NodePort
```

```

$ kubectl create -f zeppelin-service.yaml
```

可以看到我们把NodePort设再30081,一样可以透过任意台node的30081 port 察看zeppelin UI

若熟悉文字介面的朋友也可以用下方的方式去使用,记得pod要换成你自己佈署的

```
$ kubectl exec -it zeppelin-controller-8f14f -n spark-cluster pyspark
Python 2.7.9 (default, Mar  1 2015, 12:57:24) 
[GCC 4.9.2] on linux2
Type "help", "copyright", "credits" or "license" for more information.
17/08/14 01:59:22 WARN Utils: Service 'SparkUI' could not bind on port 4040. Attempting port 4041.
Welcome to
      ____              __
     / __/__  ___ _____/ /__
    _\ \/ _ \/ _ `/ __/  '_/
   /__ / .__/\_,_/_/ /_/\_\   version 1.5.2
      /_/

Using Python version 2.7.9 (default, Mar  1 2015 12:57:24)
SparkContext available as sc, HiveContext available as sqlContext.
>>> 
```

接着就能使用Spark的服务了,如有错误都欢迎更正

## zeppelin常见问题
* zeppelin的Pod非常大,所以再pull时会花上一些时间,而size大小的问题现在也正在解决中,详情可参考 issue #17231 
* 再GKE的平台上,`kubectl post-forward`可能有些不稳定,如果你看现zeppelin 的状态为`Disconnected`,`port-forward`可能已经失败你需要去重新启动它,详情可参考 #12179
