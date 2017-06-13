# 端口映射

在创建Pod时，可以指定容器的hostPort和containerPort来创建端口映射，这样可以通过Pod所在Node的IP:hostPort来访问服务。比如

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

## 注意事项

使用了hostPort的容器只能调度到端口不冲突的Node上，除非有必要（比如运行一些系统级的daemon服务），不建议使用端口映射功能。如果需要对外暴露服务，建议使用[NodePort Service](../concepts/service.md#Service)。
