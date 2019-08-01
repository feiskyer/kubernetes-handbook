# StatefulSet

StatefulSet 是為了解決有狀態服務的問題（對應 Deployments 和 ReplicaSets 是為無狀態服務而設計），其應用場景包括

- 穩定的持久化存儲，即 Pod 重新調度後還是能訪問到相同的持久化數據，基於 PVC 來實現
- 穩定的網絡標誌，即 Pod 重新調度後其 PodName 和 HostName 不變，基於 Headless Service（即沒有 Cluster IP 的 Service）來實現
- 有序部署，有序擴展，即 Pod 是有順序的，在部署或者擴展的時候要依據定義的順序依次依序進行（即從 0 到 N-1，在下一個 Pod 運行之前所有之前的 Pod 必須都是 Running 和 Ready 狀態），基於 init containers 來實現
- 有序收縮，有序刪除（即從 N-1 到 0）

從上面的應用場景可以發現，StatefulSet 由以下幾個部分組成：

- 用於定義網絡標誌（DNS domain）的 Headless Service
- 用於創建 PersistentVolumes 的 volumeClaimTemplates
- 定義具體應用的 StatefulSet

StatefulSet 中每個 Pod 的 DNS 格式為 `statefulSetName-{0..N-1}.serviceName.namespace.svc.cluster.local`，其中

- `serviceName` 為 Headless Service 的名字
- `0..N-1` 為 Pod 所在的序號，從 0 開始到 N-1
- `statefulSetName` 為 StatefulSet 的名字
- `namespace` 為服務所在的 namespace，Headless Service 和 StatefulSet 必須在相同的 namespace
- `.cluster.local` 為 Cluster Domain

## API 版本對照表

| Kubernetes 版本 |   Apps 版本   |
| ------------- | ------------------ |
|   v1.6-v1.7   | apps/v1beta1 |
|     v1.8      |   apps/v1beta2     |
|     v1.9      |      apps/v1       |

## 簡單示例

以一個簡單的 nginx 服務 [web.yaml](web.txt) 為例：

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx
  labels:
    app: nginx
spec:
  ports:
  - port: 80
    name: web
  clusterIP: None
  selector:
    app: nginx
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: web
spec:
  serviceName: "nginx"
  replicas: 2
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: k8s.gcr.io/nginx-slim:0.8
        ports:
        - containerPort: 80
          name: web
        volumeMounts:
        - name: www
          mountPath: /usr/share/nginx/html
  volumeClaimTemplates:
  - metadata:
      name: www
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 1Gi
```

```sh
$ kubectl create -f web.yaml
service "nginx" created
statefulset "web" created

# 查看創建的 headless service 和 statefulset
$ kubectl get service nginx
NAME      CLUSTER-IP   EXTERNAL-IP   PORT(S)   AGE
nginx     None         <none>        80/TCP    1m
$ kubectl get statefulset web
NAME      DESIRED   CURRENT   AGE
web       2         2         2m

# 根據 volumeClaimTemplates 自動創建 PVC（在 GCE 中會自動創建 kubernetes.io/gce-pd 類型的 volume）
$ kubectl get pvc
NAME        STATUS    VOLUME                                     CAPACITY   ACCESSMODES   AGE
www-web-0   Bound     pvc-d064a004-d8d4-11e6-b521-42010a800002   1Gi        RWO           16s
www-web-1   Bound     pvc-d06a3946-d8d4-11e6-b521-42010a800002   1Gi        RWO           16s

# 查看創建的 Pod，他們都是有序的
$ kubectl get pods -l app=nginx
NAME      READY     STATUS    RESTARTS   AGE
web-0     1/1       Running   0          5m
web-1     1/1       Running   0          4m

# 使用 nslookup 查看這些 Pod 的 DNS
$ kubectl run -i --tty --image busybox dns-test --restart=Never --rm /bin/sh
/ # nslookup web-0.nginx
Server:    10.0.0.10
Address 1: 10.0.0.10 kube-dns.kube-system.svc.cluster.local

Name:      web-0.nginx
Address 1: 10.244.2.10
/ # nslookup web-1.nginx
Server:    10.0.0.10
Address 1: 10.0.0.10 kube-dns.kube-system.svc.cluster.local

Name:      web-1.nginx
Address 1: 10.244.3.12
/ # nslookup web-0.nginx.default.svc.cluster.local
Server:    10.0.0.10
Address 1: 10.0.0.10 kube-dns.kube-system.svc.cluster.local

Name:      web-0.nginx.default.svc.cluster.local
Address 1: 10.244.2.10
```

還可以進行其他的操作

```sh
# 擴容
$ kubectl scale statefulset web --replicas=5

# 縮容
$ kubectl patch statefulset web -p '{"spec":{"replicas":3}}'

# 鏡像更新（目前還不支持直接更新 image，需要 patch 來間接實現）
$ kubectl patch statefulset web --type='json' -p='[{"op":"replace","path":"/spec/template/spec/containers/0/image","value":"gcr.io/google_containers/nginx-slim:0.7"}]'

# 刪除 StatefulSet 和 Headless Service
$ kubectl delete statefulset web
$ kubectl delete service nginx

# StatefulSet 刪除後 PVC 還會保留著，數據不再使用的話也需要刪除
$ kubectl delete pvc www-web-0 www-web-1
```

## 更新 StatefulSet

v1.7 + 支持 StatefulSet 的自動更新，通過 `spec.updateStrategy` 設置更新策略。目前支持兩種策略

- OnDelete：當 `.spec.template` 更新時，並不立即刪除舊的 Pod，而是等待用戶手動刪除這些舊 Pod 後自動創建新 Pod。這是默認的更新策略，兼容 v1.6 版本的行為
- RollingUpdate：當 `.spec.template` 更新時，自動刪除舊的 Pod 並創建新 Pod 替換。在更新時，這些 Pod 是按逆序的方式進行，依次刪除、創建並等待 Pod 變成 Ready 狀態才進行下一個 Pod 的更新。

### Partitions

RollingUpdate 還支持 Partitions，通過 `.spec.updateStrategy.rollingUpdate.partition` 來設置。當 partition 設置後，只有序號大於或等於 partition 的 Pod 會在 `.spec.template` 更新的時候滾動更新，而其餘的 Pod 則保持不變（即便是刪除後也是用以前的版本重新創建）。

```sh
# 設置 partition 為 3
$ kubectl patch statefulset web -p '{"spec":{"updateStrategy":{"type":"RollingUpdate","rollingUpdate":{"partition":3}}}}'
statefulset "web" patched

# 更新 StatefulSet
$ kubectl patch statefulset web --type='json' -p='[{"op":"replace","path":"/spec/template/spec/containers/0/image","value":"gcr.io/google_containers/nginx-slim:0.7"}]'
statefulset "web" patched

# 驗證更新
$ kubectl delete po web-2
pod "web-2" deleted
$ kubectl get po -lapp=nginx -w
NAME      READY     STATUS              RESTARTS   AGE
web-0     1/1       Running             0          4m
web-1     1/1       Running             0          4m
web-2     0/1       ContainerCreating   0          11s
web-2     1/1       Running             0          18s
```

## Pod 管理策略

v1.7 + 可以通過 `.spec.podManagementPolicy` 設置 Pod 管理策略，支持兩種方式

- OrderedReady：默認的策略，按照 Pod 的次序依次創建每個 Pod 並等待 Ready 之後才創建後面的 Pod
- Parallel：並行創建或刪除 Pod（不等待前面的 Pod Ready 就開始創建所有的 Pod）

### Parallel 示例

```yaml
---
apiVersion: v1
kind: Service
metadata:
  name: nginx
  labels:
    app: nginx
spec:
  ports:
  - port: 80
    name: web
  clusterIP: None
  selector:
    app: nginx
---
apiVersion: apps/v1beta1
kind: StatefulSet
metadata:
  name: web
spec:
  serviceName: "nginx"
  podManagementPolicy: "Parallel"
  replicas: 2
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: gcr.io/google_containers/nginx-slim:0.8
        ports:
        - containerPort: 80
          name: web
        volumeMounts:
        - name: www
          mountPath: /usr/share/nginx/html
  volumeClaimTemplates:
  - metadata:
      name: www
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 1Gi
```

可以看到，所有 Pod 是並行創建的

```sh
$ kubectl create -f webp.yaml
service "nginx" created
statefulset "web" created

$ kubectl get po -lapp=nginx -w
NAME      READY     STATUS              RESTARTS  AGE
web-0     0/1       Pending             0         0s
web-0     0/1       Pending             0         0s
web-1     0/1       Pending             0         0s
web-1     0/1       Pending             0         0s
web-0     0/1       ContainerCreating   0         0s
web-1     0/1       ContainerCreating   0         0s
web-0     1/1       Running             0         10s
web-1     1/1       Running             0         10s
```

## zookeeper

另外一個更能說明 StatefulSet 強大功能的示例為 [zookeeper.yaml](zookeeper.txt)。

```yaml
---
apiVersion: v1
kind: Service
metadata:
  name: zk-headless
  labels:
    app: zk-headless
spec:
  ports:
  - port: 2888
    name: server
  - port: 3888
    name: leader-election
  clusterIP: None
  selector:
    app: zk
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: zk-config
data:
  ensemble: "zk-0;zk-1;zk-2"
  jvm.heap: "2G"
  tick: "2000"
  init: "10"
  sync: "5"
  client.cnxns: "60"
  snap.retain: "3"
  purge.interval: "1"
---
apiVersion: policy/v1beta1
kind: PodDisruptionBudget
metadata:
  name: zk-budget
spec:
  selector:
    matchLabels:
      app: zk
  minAvailable: 2
---
apiVersion: apps/v1beta1
kind: StatefulSet
metadata:
  name: zk
spec:
  serviceName: zk-headless
  replicas: 3
  template:
    metadata:
      labels:
        app: zk
      annotations:
        pod.alpha.kubernetes.io/initialized: "true"
        scheduler.alpha.kubernetes.io/affinity: >
            {
              "podAntiAffinity": {
                "requiredDuringSchedulingRequiredDuringExecution": [{
                  "labelSelector": {
                    "matchExpressions": [{
                      "key": "app",
                      "operator": "In",
                      "values": ["zk-headless"]
                    }]
                  },
                  "topologyKey": "kubernetes.io/hostname"
                }]
              }
            }
    spec:
      containers:
      - name: k8szk
        imagePullPolicy: Always
        image: gcr.io/google_samples/k8szk:v1
        resources:
          requests:
            memory: "4Gi"
            cpu: "1"
        ports:
        - containerPort: 2181
          name: client
        - containerPort: 2888
          name: server
        - containerPort: 3888
          name: leader-election
        env:
        - name : ZK_ENSEMBLE
          valueFrom:
            configMapKeyRef:
              name: zk-config
              key: ensemble
        - name : ZK_HEAP_SIZE
          valueFrom:
            configMapKeyRef:
                name: zk-config
                key: jvm.heap
        - name : ZK_TICK_TIME
          valueFrom:
            configMapKeyRef:
                name: zk-config
                key: tick
        - name : ZK_INIT_LIMIT
          valueFrom:
            configMapKeyRef:
                name: zk-config
                key: init
        - name : ZK_SYNC_LIMIT
          valueFrom:
            configMapKeyRef:
                name: zk-config
                key: tick
        - name : ZK_MAX_CLIENT_CNXNS
          valueFrom:
            configMapKeyRef:
                name: zk-config
                key: client.cnxns
        - name: ZK_SNAP_RETAIN_COUNT
          valueFrom:
            configMapKeyRef:
                name: zk-config
                key: snap.retain
        - name: ZK_PURGE_INTERVAL
          valueFrom:
            configMapKeyRef:
                name: zk-config
                key: purge.interval
        - name: ZK_CLIENT_PORT
          value: "2181"
        - name: ZK_SERVER_PORT
          value: "2888"
        - name: ZK_ELECTION_PORT
          value: "3888"
        command:
        - sh
        - -c
        - zkGenConfig.sh && zkServer.sh start-foreground
        readinessProbe:
          exec:
            command:
            - "zkOk.sh"
          initialDelaySeconds: 15
          timeoutSeconds: 5
        livenessProbe:
          exec:
            command:
            - "zkOk.sh"
          initialDelaySeconds: 15
          timeoutSeconds: 5
        volumeMounts:
        - name: datadir
          mountPath: /var/lib/zookeeper
      securityContext:
        runAsUser: 1000
        fsGroup: 1000
  volumeClaimTemplates:
  - metadata:
      name: datadir
      annotations:
        volume.alpha.kubernetes.io/storage-class: anything
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 20Gi
```

```sh
kubectl create -f zookeeper.yaml
```

詳細的使用說明見 [zookeeper stateful application](https://kubernetes.io/docs/tutorials/stateful-application/zookeeper/)。

## StatefulSet 注意事項

1. 推薦在 Kubernetes v1.9 或以後的版本中使用
2. 所有 Pod 的 Volume 必須使用 PersistentVolume 或者是管理員事先創建好
3. 為了保證數據安全，刪除 StatefulSet 時不會刪除 Volume
4. StatefulSet 需要一個 Headless Service 來定義 DNS domain，需要在 StatefulSet 之前創建好
