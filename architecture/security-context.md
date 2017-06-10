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

Pod Security Policies（PSP）是集群级的Pod安全策略，自动为集群内的Pod和Volume设置Security Context。

使用PSP需要API Server开启`extensions/v1beta1/podsecuritypolicy`，并且配置`PodSecurityPolicy` admission控制器。

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

## SELinux

SELinux (Security-Enhanced Linux) 是一种强制访问控制（mandatory access control）的实现。它的作法是以最小权限原则（principle of least privilege）为基础，在Linux核心中使用Linux安全模块（Linux Security Modules）。SELinux主要由美国国家安全局开发，并于2000年12月22日发行给开放源代码的开发社区。

可以通过runcon来为进程设置安全策略，ls和ps的-Z参数可以查看文件或进程的安全策略。

### 开启与关闭SELinux

修改/etc/selinux/config文件方法：

- 开启：SELINUX=enforcing
- 关闭：SELINUX=disabled

通过命令临时修改：

- 开启：setenforce 1
- 关闭：setenforce 0

查询SELinux状态：

```
$ getenforce
```

### 示例

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: hello-world
spec:
  containers:
  - image: gcr.io/google_containers/busybox:1.24
    name: test-container
    command:
    - sleep
    - "6000"
    volumeMounts:
    - mountPath: /mounted_volume
      name: test-volume
  restartPolicy: Never
  hostPID: false
  hostIPC: false
  securityContext:
    seLinuxOptions:
      level: "s0:c2,c3"
  volumes:
  - name: test-volume
    emptyDir: {}
```

这会自动给docker容器生成如下的`HostConfig.Binds`:

```
/var/lib/kubelet/pods/f734678c-95de-11e6-89b0-42010a8c0002/volumes/kubernetes.io~empty-dir/test-volume:/mounted_volume:Z
/var/lib/kubelet/pods/f734678c-95de-11e6-89b0-42010a8c0002/volumes/kubernetes.io~secret/default-token-88xxa:/var/run/secrets/kubernetes.io/serviceaccount:ro,Z
/var/lib/kubelet/pods/f734678c-95de-11e6-89b0-42010a8c0002/etc-hosts:/etc/hosts
```

对应的volume也都会正确设置SELinux：

```
$ ls -Z /var/lib/kubelet/pods/f734678c-95de-11e6-89b0-42010a8c0002/volumes
drwxr-xr-x. root root unconfined_u:object_r:svirt_sandbox_file_t:s0:c2,c3 kubernetes.io~empty-dir
drwxr-xr-x. root root unconfined_u:object_r:svirt_sandbox_file_t:s0:c2,c3 kubernetes.io~secret
```
