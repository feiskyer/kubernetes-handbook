# 容器安全

Kubernetes提供了多种机制来限制容器的行为，减少容器攻击面，保证系统安全性。

- Security Context：限制容器的行为，包括Capabilities、ReadOnlyRootFilesystem、Privileged、RunAsNonRoot、RunAsUser以及SELinuxOptions等
- Pod Security Policy：集群级的Pod安全策略，自动为集群内的Pod和Volume设置Security Context
- Sysctls：允许容器设置内核参数，分为安全Sysctls和非安全Sysctls
- AppArmor：限制应用的访问权限
- Seccomp：Secure computing mode的缩写，限制容器应用可执行的系统调用

## Security Context和Pod Security Policy

请参考[这里](../concepts/security-context.md)。

## Sysctls

Sysctls允许容器设置内核参数，分为安全Sysctls和非安全Sysctls

- 安全Sysctls：即设置后不影响其他Pod的内核选项，只作用在容器namespace中，默认开启。包括以下几种
  - `kernel.shm_rmid_forced`
  - `net.ipv4.ip_local_port_range`
  - `net.ipv4.tcp_syncookies`
- 非安全Sysctls：即设置好有可能影响其他Pod和Node上其他服务的内核选项，默认禁止。如果使用，需要管理员在配置kubelet时开启，如`kubelet --experimental-allowed-unsafe-sysctls 'kernel.msg*,net.ipv4.route.min_pmtu'`

Sysctls还在alpha阶段，需要通过Pod annotation设置，如：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: sysctl-example
  annotations:
    security.alpha.kubernetes.io/sysctls: kernel.shm_rmid_forced=1
    security.alpha.kubernetes.io/unsafe-sysctls: net.ipv4.route.min_pmtu=1000,kernel.msgmax=1 2 3
spec:
  ...
```

## AppArmor

[AppArmor(Application Armor)](http://wiki.apparmor.net/index.php/AppArmor_Core_Policy_Reference)是Linux内核的一个安全模块，允许系统管理员将每个程序与一个安全配置文件关联，从而限制程序的功能。通过它你可以指定程序可以读、写或运行哪些文件，是否可以打开网络端口等。作为对传统Unix的自主访问控制模块的补充，AppArmor提供了强制访问控制机制。

在使用AppArmor之前需要注意

- Kubernetes版本>=v1.4
- apiserver和kubelet已开启AppArmor特性，`--feature-gates=AppArmor=true`
- 已开启apparmor内核模块，通过`cat /sys/module/apparmor/parameters/enabled`查看
- 仅支持docker container runtime
- AppArmor profile已经加载到内核，通过`cat /sys/kernel/security/apparmor/profiles`查看

AppArmor还在alpha阶段，需要通过Pod annotation `container.apparmor.security.beta.kubernetes.io/<container_name>`来设置。可选的值包括

- `runtime/default`: 使用Container Runtime的默认配置
- `localhost/<profile_name>`: 使用已加载到内核的AppArmor profile

```sh
$ sudo apparmor_parser -q <<EOF
#include <tunables/global>

profile k8s-apparmor-example-deny-write flags=(attach_disconnected) {
  #include <abstractions/base>

  file,

  # Deny all file writes.
  deny /** w,
}
EOF'

$ kubectl create -f /dev/stdin <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: hello-apparmor
  annotations:
    container.apparmor.security.beta.kubernetes.io/hello: localhost/k8s-apparmor-example-deny-write
spec:
  containers:
  - name: hello
    image: busybox
    command: [ "sh", "-c", "echo 'Hello AppArmor!' && sleep 1h" ]
EOF
pod "hello-apparmor" created

$ kubectl exec hello-apparmor cat /proc/1/attr/current
k8s-apparmor-example-deny-write (enforce)

$ kubectl exec hello-apparmor touch /tmp/test
touch: /tmp/test: Permission denied
error: error executing remote command: command terminated with non-zero exit code: Error executing in Docker Container: 1
```

## Seccomp

[Seccomp](https://www.kernel.org/doc/Documentation/prctl/seccomp_filter.txt)是Secure computing mode的缩写，它是Linux内核提供的一个操作，用于限制一个进程可以执行的系统调用．Seccomp需要有一个配置文件来指明容器进程允许和禁止执行的系统调用。

在Kubernetes中，需要将seccomp配置文件放到`/var/lib/kubelet/seccomp`目录中（可以通过kubelet选项`--seccomp-profile-root`修改）。比如禁止chmod的格式为

```sh
$ cat /var/lib/kubelet/seccomp/chmod.json
{
    "defaultAction": "SCMP_ACT_ALLOW",
    "syscalls": [
        {
            "name": "chmod",
            "action": "SCMP_ACT_ERRNO"
        }
    ]
}
```

Seccomp还在alpha阶段，需要通过Pod annotation设置，包括

- `security.alpha.kubernetes.io/seccomp/pod`：应用到该Pod的所有容器
- `security.alpha.kubernetes.io/seccomp/container/<container name>`：应用到指定容器

而value有三个选项

- `runtime/default`: 使用Container Runtime的默认配置
- `unconfined`: 允许所有系统调用
- `localhost/<profile-name>`: 使用Node本地安装的seccomp，需要放到`/var/lib/kubelet/seccomp`目录中

比如使用刚才创建的seccomp配置：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: trustworthy-pod
  annotations:
    seccomp.security.alpha.kubernetes.io/pod: localhost/chmod
spec:
  containers:
    - name: trustworthy-container
      image: sotrustworthy:latest
```
