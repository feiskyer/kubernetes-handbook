# 端口映射

在創建 Pod 時，可以指定容器的 hostPort 和 containerPort 來創建端口映射，這樣可以通過 Pod 所在 Node 的 IP:hostPort 來訪問服務。比如

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
spec:
  containers:
  - image: nginx
    name: nginx
    ports:
    - containerPort: 80
      hostPort: 80
  restartPolicy: Always
```

## 注意事項

使用了 hostPort 的容器只能調度到端口不衝突的 Node 上，除非有必要（比如運行一些系統級的 daemon 服務），不建議使用端口映射功能。如果需要對外暴露服務，建議使用 [NodePort Service](../concepts/service.md#Service)。
