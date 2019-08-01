# Spark on Kubernetes

![](https://i.imgur.com/6zYTLL8.png)

**Kubernetes 從 v1.8 開始支持 [原生的 Apache Spark](https://apache-spark-on-k8s.github.io/userdocs/running-on-kubernetes.html) 應用（需要 Spark 支持 Kubernetes，比如 v2.3）**，可以通過 `spark-submit` 命令直接提交 Kubernetes 任務。比如計算圓周率

```sh
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

或者使用 Python 版本

```sh
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

## Spark on Kubernetes 部署

Kubernetes 示例 [github](https://github.com/kubernetes/examples/tree/master/staging/spark) 上提供了一個詳細的 spark 部署方法，由於步驟複雜，這裡簡化一些部分讓大家安裝的時候不用去多設定一些東西。

### 部署條件

* 一個 kubernetes 群集, 可參考 [集群部署](../deploy/cluster.md)
* kube-dns 正常運作

### 創建一個命名空間

namespace-spark-cluster.yaml

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: "spark-cluster"
  labels:
    name: "spark-cluster"
```

```sh
$ kubectl create -f examples/staging/spark/namespace-spark-cluster.yaml
```

這邊原文提到需要將 kubectl 的執行環境轉到 spark-cluster, 這邊為了方便我們不這樣做, 而是將之後的佈署命名空間都加入 spark-cluster


### 部署 Master Service

建立一個 replication controller, 來運行 Spark Master 服務

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


```sh
$ kubectl create -f spark-master-controller.yaml
```

創建 master 服務


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

```sh
$ kubectl create -f spark-master-service.yaml
```

檢查 Master 是否正常運行

```sh
$ kubectl get pod -n spark-cluster
spark-master-controller-qtwm8     1/1       Running   0          6d
```

```sh
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


若 master 已經被建立與運行, 我們可以透過 Spark 開發的 webUI 來察看我們 spark 的群集狀況, 我們將佈署 [specialized proxy](https://github.com/aseigneurin/spark-ui-proxy)


spark-ui-proxy-controller.yaml

```yaml
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

```sh
$ kubectl create -f spark-ui-proxy-controller.yaml
```

提供一個 service 做存取, 這邊原文是使用 LoadBalancer type, 這邊我們改成 NodePort, 如果你的 kubernetes 運行環境是在 cloud provider, 也可以參考原文作法

spark-ui-proxy-service.yaml

```yaml
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

```sh
$ kubectl create -f spark-ui-proxy-service.yaml
```

部署完後你可以利用 [kubecrl proxy](https://kubernetes.io/docs/tasks/access-kubernetes-api/http-proxy-access-api/) 來察看你的 Spark 群集狀態

```sh
$ kubectl proxy --port=8001
```

可以透過 `http://localhost:8001/api/v1/proxy/namespaces/spark-cluster/services/spark-master:8080/` 察看, 若 kubectl 中斷就無法這樣觀察了, 但我們再先前有設定 nodeport 所以也可以透過任意臺 node 的端口 30080 去察看（例如 `http://10.201.2.34:30080`）。

### 部署 Spark workers

要先確定 Matser 是再運行的狀態

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

```sh
$ kubectl create -f spark-worker-controller.yaml
replicationcontroller "spark-worker-controller" created
```

透過指令察看運行狀況

```sh
$ kubectl get pod -n spark-cluster
spark-master-controller-qtwm8     1/1       Running   0          6d
spark-worker-controller-4rxrs     1/1       Running   0          6d
spark-worker-controller-z6f21     1/1       Running   0          6d
spark-ui-proxy-controller-d4br2   1/1       Running   4          6d
```

也可以透過上面建立的 WebUI 服務去察看

基本上到這邊 Spark 的群集已經建立完成了


### 創建 Zeppelin UI

我們可以利用 Zeppelin UI 經由 web notebook 直接去執行我們的任務, 詳情可以看 [Zeppelin UI](https://zeppelin.apache.org) 與 [Spark architecture](https://spark.apache.org/docs/latest/cluster-overview.html)

zeppelin-controller.yaml

```yaml
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


```sh
$ kubectl create -f zeppelin-controller.yaml
replicationcontroller "zeppelin-controller" created
```

然後一樣佈署 Service

zeppelin-service.yaml

```sh
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

```sh
$ kubectl create -f zeppelin-service.yaml
```

可以看到我們把 NodePort 設再 30081, 一樣可以透過任意臺 node 的 30081 port 訪問 zeppelin UI。

通過命令行訪問 pyspark（記得把 pod 名字換成你自己的）：

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

接著就能使用 Spark 的服務了, 如有錯誤歡迎更正。

### zeppelin 常見問題

* zeppelin 的鏡像非常大, 所以再 pull 時會花上一些時間, 而 size 大小的問題現在也正在解決中, 詳情可參考 issue #17231
* 在 GKE 的平臺上, `kubectl post-forward` 可能有些不穩定, 如果你看現 zeppelin 的狀態為 `Disconnected`,`port-forward` 可能已經失敗你需要去重新啟動它, 詳情可參考 #12179

## 參考文檔

- [Apache Spark on Kubernetes](https://apache-spark-on-k8s.github.io/userdocs/index.html)
- [https://github.com/kweisamx/spark-on-kubernetes](https://github.com/kweisamx/spark-on-kubernetes)
- [Spark examples](https://github.com/kubernetes/examples/tree/master/staging/spark)
