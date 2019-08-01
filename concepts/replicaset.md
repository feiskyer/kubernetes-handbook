# ReplicationController 和 ReplicaSet

ReplicationController（也簡稱為 rc）用來確保容器應用的副本數始終保持在用戶定義的副本數，即如果有容器異常退出，會自動創建新的 Pod 來替代；而異常多出來的容器也會自動回收。ReplicationController 的典型應用場景包括確保健康 Pod 的數量、彈性伸縮、滾動升級以及應用多版本發佈跟蹤等。

在新版本的 Kubernetes 中建議使用 ReplicaSet（也簡稱為 rs）來取代 ReplicationController。ReplicaSet 跟 ReplicationController 沒有本質的不同，只是名字不一樣，並且 ReplicaSet 支持集合式的 selector（ReplicationController 僅支持等式）。

雖然也 ReplicaSet 可以獨立使用，但建議使用 Deployment 來自動管理 ReplicaSet，這樣就無需擔心跟其他機制的不兼容問題（比如 ReplicaSet 不支持 rolling-update 但 Deployment 支持），並且還支持版本記錄、回滾、暫停升級等高級特性。Deployment 的詳細介紹和使用方法見 [這裡](deployment.md)。

## API 版本對照表

| Kubernetes 版本 |   ReplicaSet API 版本   |   ReplicationController 版本   |
| ------------- | ------------------ | ------------------ |
|   v1.5-v1.7   | extensions/v1beta1 | core/v1 |
|     v1.8      |   apps/v1beta2     | core/v1 |
|     v1.9      |      apps/v1       |   core/v1   |

## ReplicationController 示例

```yaml
apiVersion: v1
kind: ReplicationController
metadata:
  name: nginx
spec:
  replicas: 3
  selector:
    app: nginx
  template:
    metadata:
      name: nginx
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx
        ports:
        - containerPort: 80
```

## ReplicaSet 示例

```yaml
apiVersion: extensions/v1beta1
kind: ReplicaSet
metadata:
  name: frontend
  # these labels can be applied automatically
  # from the labels in the pod template if not set
  # labels:
    # app: guestbook
    # tier: frontend
spec:
  # this replicas value is default
  # modify it according to your case
  replicas: 3
  # selector can be applied automatically
  # from the labels in the pod template if not set,
  # but we are specifying the selector here to
  # demonstrate its usage.
  selector:
    matchLabels:
      tier: frontend
    matchExpressions:
      - {key: tier, operator: In, values: [frontend]}
  template:
    metadata:
      labels:
        app: guestbook
        tier: frontend
    spec:
      containers:
      - name: php-redis
        image: gcr.io/google_samples/gb-frontend:v3
        resources:
          requests:
            cpu: 100m
            memory: 100Mi
        env:
        - name: GET_HOSTS_FROM
          value: dns
          # If your cluster config does not include a dns service, then to
          # instead access environment variables to find service host
          # info, comment out the 'value: dns' line above, and uncomment the
          # line below.
          # value: env
        ports:
        - containerPort: 80
```
