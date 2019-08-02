# Security Context 和 Pod Security Policy

Security Context 的目的是限制不可信容器的行为，保护系统和其他容器不受其影响。

Kubernetes 提供了三种配置 Security Context 的方法：

- Container-level Security Context：仅应用到指定的容器
- Pod-level Security Context：应用到 Pod 内所有容器以及 Volume
- Pod Security Policies（PSP）：应用到集群内部所有 Pod 以及 Volume

## Container-level Security Context

[Container-level Security Context](https://kubernetes.io/docs/api-reference/v1.15/#securitycontext-v1-core) 仅应用到指定的容器上，并且不会影响 Volume。比如设置容器运行在特权模式：

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

[Pod-level Security Context](https://kubernetes.io/docs/api-reference/v1.15/#podsecuritycontext-v1-core) 应用到 Pod 内所有容器，并且还会影响 Volume（包括 fsGroup 和 selinuxOptions）。

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

Pod Security Policies（PSP）是集群级的 Pod 安全策略，自动为集群内的 Pod 和 Volume 设置 Security Context。

使用 PSP 需要 API Server 开启 `extensions/v1beta1/podsecuritypolicy`，并且配置 `PodSecurityPolicy` admission 控制器。

### API 版本对照表

| Kubernetes 版本 | Extension 版本     |
| --------------- | ------------------ |
| v1.5-v1.15      | extensions/v1beta1 |
| v1.10+          | policy/v1beta1     |

### 支持的控制项

| 控制项 | 说明 |
|-----|---|
|privileged | 运行特权容器 |
|defaultAddCapabilities | 可添加到容器的 Capabilities|
|requiredDropCapabilities | 会从容器中删除的 Capabilities|
|allowedCapabilities | 允许使用的 Capabilities 列表 |
|volumes | 控制容器可以使用哪些 volume|
|hostNetwork|允许使用 host 网络 |
|hostPorts | 允许的 host 端口列表 |
|hostPID | 使用 host PID namespace|
|hostIPC | 使用 host IPC namespace|
|seLinux|SELinux Context|
|runAsUser|user ID|
|supplementalGroups | 允许的补充用户组 |
|fsGroup|volume FSGroup|
|readOnlyRootFilesystem | 只读根文件系统 |
|allowedHostPaths | 允许 hostPath 插件使用的路径列表 |
|allowedFlexVolumes | 允许使用的 flexVolume 插件列表 |
|allowPrivilegeEscalation | 允许容器进程设置  [`no_new_privs`](https://www.kernel.org/doc/Documentation/prctl/no_new_privs.txt) |
|defaultAllowPrivilegeEscalation | 默认是否允许特权升级 |

### 示例

限制容器的 host 端口范围为 8000-8080：

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

限制只允许使用 lvm 和 cifs 等 flexVolume 插件：

```yaml
apiVersion: extensions/v1beta1
kind: PodSecurityPolicy
metadata:
  name: allow-flex-volumes
spec:
  fsGroup:
    rule: RunAsAny
  runAsUser:
    rule: RunAsAny
  seLinux:
    rule: RunAsAny
  supplementalGroups:
    rule: RunAsAny
  volumes:
    - flexVolume
  allowedFlexVolumes:
    - driver: example/lvm
    - driver: example/cifs
```

## SELinux

SELinux (Security-Enhanced Linux) 是一种强制访问控制（mandatory access control）的实现。它的作法是以最小权限原则（principle of least privilege）为基础，在 Linux 核心中使用 Linux 安全模块（Linux Security Modules）。SELinux 主要由美国国家安全局开发，并于 2000 年 12 月 22 日发行给开放源代码的开发社区。

可以通过 runcon 来为进程设置安全策略，ls 和 ps 的 - Z 参数可以查看文件或进程的安全策略。

### 开启与关闭 SELinux

修改 / etc/selinux/config 文件方法：

- 开启：SELINUX=enforcing
- 关闭：SELINUX=disabled

通过命令临时修改：

- 开启：setenforce 1
- 关闭：setenforce 0

查询 SELinux 状态：

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

这会自动给 docker 容器生成如下的 `HostConfig.Binds`:

```
/var/lib/kubelet/pods/f734678c-95de-11e6-89b0-42010a8c0002/volumes/kubernetes.io~empty-dir/test-volume:/mounted_volume:Z
/var/lib/kubelet/pods/f734678c-95de-11e6-89b0-42010a8c0002/volumes/kubernetes.io~secret/default-token-88xxa:/var/run/secrets/kubernetes.io/serviceaccount:ro,Z
/var/lib/kubelet/pods/f734678c-95de-11e6-89b0-42010a8c0002/etc-hosts:/etc/hosts
```

对应的 volume 也都会正确设置 SELinux：

```
$ ls -Z /var/lib/kubelet/pods/f734678c-95de-11e6-89b0-42010a8c0002/volumes
drwxr-xr-x. root root unconfined_u:object_r:svirt_sandbox_file_t:s0:c2,c3 kubernetes.io~empty-dir
drwxr-xr-x. root root unconfined_u:object_r:svirt_sandbox_file_t:s0:c2,c3 kubernetes.io~secret
```

## 参考文档

- [Kubernetes Pod Security Policies](https://kubernetes.io/docs/concepts/policy/pod-security-policy/)
