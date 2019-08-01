# Security Context 和 Pod Security Policy

Security Context 的目的是限制不可信容器的行為，保護系統和其他容器不受其影響。

Kubernetes 提供了三種配置 Security Context 的方法：

- Container-level Security Context：僅應用到指定的容器
- Pod-level Security Context：應用到 Pod 內所有容器以及 Volume
- Pod Security Policies（PSP）：應用到集群內部所有 Pod 以及 Volume

## Container-level Security Context

[Container-level Security Context](https://kubernetes.io/docs/api-reference/v1.15/#securitycontext-v1-core) 僅應用到指定的容器上，並且不會影響 Volume。比如設置容器運行在特權模式：

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

[Pod-level Security Context](https://kubernetes.io/docs/api-reference/v1.15/#podsecuritycontext-v1-core) 應用到 Pod 內所有容器，並且還會影響 Volume（包括 fsGroup 和 selinuxOptions）。

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

Pod Security Policies（PSP）是集群級的 Pod 安全策略，自動為集群內的 Pod 和 Volume 設置 Security Context。

使用 PSP 需要 API Server 開啟 `extensions/v1beta1/podsecuritypolicy`，並且配置 `PodSecurityPolicy` admission 控制器。

### 支持的控制項

| 控制項 | 說明 |
|-----|---|
|privileged | 運行特權容器 |
|defaultAddCapabilities | 可添加到容器的 Capabilities|
|requiredDropCapabilities | 會從容器中刪除的 Capabilities|
|allowedCapabilities | 允許使用的 Capabilities 列表 |
|volumes | 控制容器可以使用哪些 volume|
|hostNetwork|允許使用 host 網絡 |
|hostPorts | 允許的 host 端口列表 |
|hostPID | 使用 host PID namespace|
|hostIPC | 使用 host IPC namespace|
|seLinux|SELinux Context|
|runAsUser|user ID|
|supplementalGroups | 允許的補充用戶組 |
|fsGroup|volume FSGroup|
|readOnlyRootFilesystem | 只讀根文件系統 |
|allowedHostPaths | 允許 hostPath 插件使用的路徑列表 |
|allowedFlexVolumes | 允許使用的 flexVolume 插件列表 |
|allowPrivilegeEscalation | 允許容器進程設置  [`no_new_privs`](https://www.kernel.org/doc/Documentation/prctl/no_new_privs.txt) |
|defaultAllowPrivilegeEscalation | 默認是否允許特權升級 |

### 示例

限制容器的 host 端口範圍為 8000-8080：

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

限制只允許使用 lvm 和 cifs 等 flexVolume 插件：

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

SELinux (Security-Enhanced Linux) 是一種強制訪問控制（mandatory access control）的實現。它的作法是以最小權限原則（principle of least privilege）為基礎，在 Linux 核心中使用 Linux 安全模塊（Linux Security Modules）。SELinux 主要由美國國家安全局開發，並於 2000 年 12 月 22 日發行給開放源代碼的開發社區。

可以通過 runcon 來為進程設置安全策略，ls 和 ps 的 - Z 參數可以查看文件或進程的安全策略。

### 開啟與關閉 SELinux

修改 / etc/selinux/config 文件方法：

- 開啟：SELINUX=enforcing
- 關閉：SELINUX=disabled

通過命令臨時修改：

- 開啟：setenforce 1
- 關閉：setenforce 0

查詢 SELinux 狀態：

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

這會自動給 docker 容器生成如下的 `HostConfig.Binds`:

```
/var/lib/kubelet/pods/f734678c-95de-11e6-89b0-42010a8c0002/volumes/kubernetes.io~empty-dir/test-volume:/mounted_volume:Z
/var/lib/kubelet/pods/f734678c-95de-11e6-89b0-42010a8c0002/volumes/kubernetes.io~secret/default-token-88xxa:/var/run/secrets/kubernetes.io/serviceaccount:ro,Z
/var/lib/kubelet/pods/f734678c-95de-11e6-89b0-42010a8c0002/etc-hosts:/etc/hosts
```

對應的 volume 也都會正確設置 SELinux：

```
$ ls -Z /var/lib/kubelet/pods/f734678c-95de-11e6-89b0-42010a8c0002/volumes
drwxr-xr-x. root root unconfined_u:object_r:svirt_sandbox_file_t:s0:c2,c3 kubernetes.io~empty-dir
drwxr-xr-x. root root unconfined_u:object_r:svirt_sandbox_file_t:s0:c2,c3 kubernetes.io~secret
```

## 參考文檔

- [Kubernetes Pod Security Policies](https://kubernetes.io/docs/concepts/policy/pod-security-policy/)
