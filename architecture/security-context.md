# Security Context

Security Context的目的是限制不可信容器的行为，保护系统和其他容器不受其影响。

Kubernetes提供了三种配置Security Context的方法：

- Container-level Security Context：仅应用到指定的容器
- Pod-level Security Context：应用到Pod内所有容器以及Volume
- Pod Security Policies（PSP）：应用到集群内部所有Pod以及Volume

## Container-level Security Context

[Container-level Security Context](https://kubernetes.io/docs/api-reference/v1.6/#securitycontext-v1-core)仅应用到指定的容器上，并且不会影响Volume。比如设置容器运行在特权模式：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: hello-world
spec:
  containers:
    - name: hello-world-container
      # The container definition
      # ...
      securityContext:
        privileged: true
```

## Pod-level Security Context

[Pod-level Security Context](https://kubernetes.io/docs/api-reference/v1.6/#podsecuritycontext-v1-core)应用到Pod内所有容器，并且还会影响Volume（包括fsGroup和selinuxOptions）。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: hello-world
spec:
  containers:
  # specification of the pod's containers
  # ...
  securityContext:
    fsGroup: 1234
    supplementalGroups: [5678]
    seLinuxOptions:
      level: "s0:c123,c456"
```

## Pod Security Policies（PSP）

PSP需要API Server开启`extensions/v1beta1/podsecuritypolicy`，并且配置`PodSecurityPolicy` admission控制器。

### 支持的控制项

|控制项|说明|
|-----|---|
|privileged|运行特权容器|
|defaultAddCapabilities|可添加到容器的Capabilities|
|requiredDropCapabilities|会从容器中删除的Capabilities|
|volumes|控制容器可以使用哪些volume|
|hostNetwork|host网络|
|hostPorts|允许的host端口列表|
|hostPID|使用host PID namespace|
|hostIPC|使用host IPC namespace|
|seLinux|SELinux Context|
|runAsUser|user ID|
|supplementalGroups|允许的补充用户组|
|fsGroup|volume FSGroup|
|readOnlyRootFilesystem|只读根文件系统|

### 示例

限制容器的host端口范围为8000-8080：

```yaml
apiVersion: extensions/v1beta1
kind: PodSecurityPolicy
metadata:
  name: permissive
spec:
  seLinux:
    rule: RunAsAny
  supplementalGroups:
    rule: RunAsAny
  runAsUser:
    rule: RunAsAny
  fsGroup:
    rule: RunAsAny
  hostPorts:
  - min: 8000
    max: 8080
  volumes:
  - '*'
```
