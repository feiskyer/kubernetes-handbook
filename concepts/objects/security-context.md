# SecurityContext

Security Context 的目的是限制不可信容器的行为，保护系统和其他容器不受其影响。

Kubernetes 提供了三种配置 Security Context 的方法：

* Container-level Security Context：仅应用到指定的容器
* Pod-level Security Context：应用到 Pod 内所有容器以及 Volume
* Pod Security Policies（PSP）：应用到集群内部所有 Pod 以及 Volume

## Container-level Security Context

[Container-level Security Context](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/) 仅应用到指定的容器上，并且不会影响 Volume。比如设置容器运行在特权模式：

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

[Pod-level Security Context](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/) 应用到 Pod 内所有容器，并且还会影响 Volume（包括 fsGroup 和 selinuxOptions）。

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

## Supplemental Groups Policy（补充组策略）

Kubernetes v1.31 引入了 `supplementalGroupsPolicy` 字段作为 alpha 特性，并在 v1.33 中升级为 beta 版本（默认启用）。该特性提供了对容器补充组更精细的控制，特别是在访问卷时能够加强安全态势。

### 背景：容器镜像中的隐式组成员身份

默认情况下，Kubernetes 会将 Pod 中指定的组信息与容器镜像中 `/etc/group` 文件定义的组信息进行**合并**。这种隐式合并可能带来安全风险，因为：

- 策略引擎无法检测或验证这些隐式 GID（它们不在 Pod 清单中）
- 可能导致意外的访问控制问题，特别是在访问卷时

### supplementalGroupsPolicy 字段

该字段允许控制 Kubernetes 如何计算 Pod 内容器进程的补充组。可用的策略包括：

- **Merge**（默认）：容器主用户在 `/etc/group` 中定义的组成员身份将被合并。这是向后兼容的默认行为。
- **Strict**：仅将 `fsGroup`、`supplementalGroups` 或 `runAsGroup` 中指定的组 ID 作为补充组附加到容器进程。忽略容器主用户在 `/etc/group` 中定义的组成员身份。

### 示例：使用 Strict 策略

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: strict-supplementalgroups-policy
spec:
  securityContext:
    runAsUser: 1000
    runAsGroup: 3000
    supplementalGroups: [4000]
    supplementalGroupsPolicy: Strict
  containers:
  - name: ctr
    image: registry.k8s.io/e2e-test-images/agnhost:2.45
    command: [ "sh", "-c", "sleep 1h" ]
    securityContext:
      allowPrivilegeEscalation: false
```

使用 `Strict` 策略时，容器中 `id` 命令的输出将只包含明确指定的组：
```
uid=1000 gid=3000 groups=3000,4000
```

### CRI 运行时要求

`supplementalGroupsPolicy: Strict` 需要支持此功能的 CRI 运行时：

- **containerd**: v2.0 或更高版本
- **CRI-O**: v1.31 或更高版本

可以通过节点的 `.status.features.supplementalGroupsPolicy` 字段查看是否支持：

```yaml
apiVersion: v1
kind: Node
...
status:
  features:
    supplementalGroupsPolicy: true
```

### Beta 版本的行为变化

在 alpha 版本中，当具有 `supplementalGroupsPolicy: Strict` 的 Pod 被调度到不支持该功能的节点时，策略会静默回退到 `Merge`。

在 v1.33 beta 版本中，kubelet 会**拒绝**其节点无法确保指定策略的 Pod。被拒绝时会看到警告事件：

```yaml
apiVersion: v1
kind: Event
...
type: Warning
reason: SupplementalGroupsPolicyNotSupported
message: "SupplementalGroupsPolicy=Strict is not supported in this node"
```

### Pod 状态中的进程身份信息

该特性还通过 `.status.containerStatuses[].user.linux` 字段暴露附加到容器第一个进程的进程身份：

```yaml
status:
  containerStatuses:
  - name: ctr
    user:
      linux:
        gid: 3000
        supplementalGroups:
        - 3000
        - 4000
        uid: 1000
```

## User Namespaces（用户命名空间）

User Namespaces（用户命名空间）是 Kubernetes v1.33 中默认启用的重要安全特性。它通过隔离容器内的用户和组 ID 与主机系统的用户和组 ID，提供了额外的安全隔离层。

### 启用用户命名空间

从 Kubernetes v1.33 开始，用户命名空间功能默认启用，Pod 可以通过设置 `hostUsers: false` 来选择性使用：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: userns-pod
spec:
  hostUsers: false  # 启用用户命名空间
  containers:
  - name: shell
    image: debian
    command: ["sleep", "infinity"]
    securityContext:
      runAsUser: 0  # 容器内以 root 身份运行，但映射到主机的非特权用户
```

### 安全优势

用户命名空间提供以下重要安全改进：

1. **权限隔离**：容器内的 root 用户（UID 0）被映射到主机上的非特权用户，大大降低容器逃逸的风险
2. **横向移动防护**：即使攻击者获得了容器内的 root 权限，也无法访问主机系统或其他容器
3. **文件系统隔离**：通过 idmap 挂载提供文件系统级别的用户 ID 隔离

### 系统要求

使用用户命名空间需要满足以下条件：

- **操作系统**：仅支持 Linux 系统
- **内核版本**：推荐 Linux 5.19+，最佳体验需要 6.3+
- **容器运行时**：containerd 2.0+ 或 CRI-O
- **文件系统**：必须支持 idmap 挂载

### 兼容性说明

虽然大多数应用程序无需修改即可使用用户命名空间，但需要注意以下限制：

- 某些特权操作可能不被支持
- NFS 卷当前不支持用户命名空间
- 部分旧版本的容器镜像可能需要调整

### 示例配置

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: secure-app
spec:
  hostUsers: false
  securityContext:
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 2000
  containers:
  - name: app
    image: myapp:latest
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
        - ALL
```

## Pod Security Policies（PSP）

Pod Security Policies（PSP）是集群级的 Pod 安全策略，自动为集群内的 Pod 和 Volume 设置 Security Context。

使用 PSP 需要 API Server 开启 `extensions/v1beta1/podsecuritypolicy`，并且配置 `PodSecurityPolicy` admission 控制器。

> 由于 中从代码库中删除。PodSecurityPolicy API 不够灵活、认证模型不够完善且配置更新繁琐等缺陷，PodSecurityPolicy 已在 v1.21 正式[弃用](https://kubernetes.io/blog/2021/04/06/podsecuritypolicy-deprecation-past-present-and-future/)，并将在 v1.25 中从代码库中删除。已经使用 PodSecurityPolicy 的用户推荐迁移到 [Open Policy Agent](https://www.openpolicyagent.org/)。

### API 版本对照表

| Kubernetes 版本 | Extension 版本 |
| :--- | :--- |
| v1.5-v1.15 | extensions/v1beta1 |
| v1.10+ | policy/v1beta1 |
| v1.21  | deprecated |

### 支持的控制项

| 控制项 | 说明 |
| :--- | :--- |
| privileged | 运行特权容器 |
| defaultAddCapabilities | 可添加到容器的 Capabilities |
| requiredDropCapabilities | 会从容器中删除的 Capabilities |
| allowedCapabilities | 允许使用的 Capabilities 列表 |
| volumes | 控制容器可以使用哪些 volume |
| hostNetwork | 允许使用 host 网络 |
| hostPorts | 允许的 host 端口列表 |
| hostPID | 使用 host PID namespace |
| hostIPC | 使用 host IPC namespace |
| hostUsers | 使用 host user namespace（设为 false 启用用户命名空间隔离）|
| seLinux | SELinux Context |
| runAsUser | user ID |
| supplementalGroups | 允许的补充用户组 |
| supplementalGroupsPolicy | 补充组策略（Merge 或 Strict）|
| fsGroup | volume FSGroup |
| readOnlyRootFilesystem | 只读根文件系统 |
| allowedHostPaths | 允许 hostPath 插件使用的路径列表 |
| allowedFlexVolumes | 允许使用的 flexVolume 插件列表 |
| allowPrivilegeEscalation | 允许容器进程设置  [`no_new_privs`](https://www.kernel.org/doc/Documentation/prctl/no_new_privs.txt) |
| defaultAllowPrivilegeEscalation | 默认是否允许特权升级 |

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

SELinux \(Security-Enhanced Linux\) 是一种强制访问控制（mandatory access control）的实现。它的作法是以最小权限原则（principle of least privilege）为基础，在 Linux 核心中使用 Linux 安全模块（Linux Security Modules）。SELinux 主要由美国国家安全局开发，并于 2000 年 12 月 22 日发行给开放源代码的开发社区。

可以通过 runcon 来为进程设置安全策略，ls 和 ps 的 - Z 参数可以查看文件或进程的安全策略。

### 开启与关闭 SELinux

修改 / etc/selinux/config 文件方法：

* 开启：SELINUX=enforcing
* 关闭：SELINUX=disabled

通过命令临时修改：

* 开启：setenforce 1
* 关闭：setenforce 0

查询 SELinux 状态：

```text
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

```text
/var/lib/kubelet/pods/f734678c-95de-11e6-89b0-42010a8c0002/volumes/kubernetes.io~empty-dir/test-volume:/mounted_volume:Z
/var/lib/kubelet/pods/f734678c-95de-11e6-89b0-42010a8c0002/volumes/kubernetes.io~secret/default-token-88xxa:/var/run/secrets/kubernetes.io/serviceaccount:ro,Z
/var/lib/kubelet/pods/f734678c-95de-11e6-89b0-42010a8c0002/etc-hosts:/etc/hosts
```

对应的 volume 也都会正确设置 SELinux：

```text
$ ls -Z /var/lib/kubelet/pods/f734678c-95de-11e6-89b0-42010a8c0002/volumes
drwxr-xr-x. root root unconfined_u:object_r:svirt_sandbox_file_t:s0:c2,c3 kubernetes.io~empty-dir
drwxr-xr-x. root root unconfined_u:object_r:svirt_sandbox_file_t:s0:c2,c3 kubernetes.io~secret
```

## 参考文档

* [Kubernetes Pod Security Policies](https://kubernetes.io/docs/concepts/policy/pod-security-policy/)
