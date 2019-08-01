# 容器安全

從安全的角度來看，Kubernetes 中包含如下圖所示的潛在攻擊面：

![](images/attach-vectors.png)

（圖片來自《Kubernetes Security - Operating Kubernetes Clusters and Applications Safely》）

為了保證集群以及容器應用的安全，Kubernetes 提供了多種安全機制，限制容器的行為，減少容器和集群的攻擊面，保證整個系統的安全性。

- 集群安全，比如組件（如 kube-apiserver、etcd、kubelet 等）只開放安全 API並開啟 TLS 認證、開啟 RBAC 等；
- Security Context：限制容器的行為，包括 Capabilities、ReadOnlyRootFilesystem、Privileged、RunAsNonRoot、RunAsUser 以及 SELinuxOptions 等；
- Pod Security Policy：集群級的 Pod 安全策略，自動為集群內的 Pod 和 Volume 設置 Security Context；
- Sysctls：允許容器設置內核參數，分為安全 Sysctls 和非安全 Sysctls；
- AppArmor：限制應用的訪問權限；
- Network Policies：精細控制容器應用和集群中的網絡訪問；
- Seccomp：Secure computing mode 的縮寫，限制容器應用可執行的系統調用。

除此之外，推薦儘量使用較新版本的 Kubernetes，因為它們通常會包含常見安全問題的修復。你可以參考 [kubernetes-announce](https://groups.google.com/forum/#!forum/kubernetes-announce) 來查詢最新的 Kubernetes 發佈情況，也可以參考 [cvedetails.com](https://www.cvedetails.com/version-list/15867/34016/1/Kubernetes-Kubernetes.html) 查詢 Kubernetes 各個版本的 CVE (Common Vulnerabilities and Exposures) 列表。

## 集群安全

- Kubernetes 組件（如 kube-apiserver、etcd、kubelet 等）只開放安全 API 並開啟 TLS 認證。
- 開啟 RBAC 授權，賦予容器應用最小權限，並開啟 NodeRestriction 准入控制（限制 Kubelet 權限）。
  - RBAC 規則過多或者無法滿足實際需要時，推薦使用 [Open Policy Agent (OPA)](https://www.openpolicyagent.org/) 配置更靈活的訪問策略
- 開啟 Secret 加密存儲（Secret Encryption），並配置 etcd 的 TLS 認證；
- 禁止 Kubelet 的匿名訪問和只讀端口，開啟 Kubelet 的證書輪替更新（Certificate Rotation）。
- 禁止默認 ServiceAccount 的 automountServiceAccountToken，並在需要時創建容器應用的專用 ServiceAccount。
- 禁止 Dashboard 的匿名訪問，通過 RBAC 限制 Dashboard 的訪問權限，並確保 Dashboard 僅可在內網訪問（通過 kubectl proxy）。
- 定期運行 [CIS Kubernetes Benchmark](https://www.cisecurity.org/benchmark/kubernetes/)，確保集群的配置或更新符合最佳的安全實踐（使用 [kube-bench](https://github.com/aquasecurity/kube-bench) 和 [kube-hunter](https://github.com/aquasecurity/kube-hunter)）。
- 在多租戶場景中，還可以使用 Kata Containers、gVisor 等對容器進程進行強隔離，或者使用 Istio、Linkerd 等對容器應用之間的通信也進行自動加密。

## Security Context 和 Pod Security Policy

```yaml
apiVersion: extensions/v1beta1
kind: PodSecurityPolicy
metadata:
  name: restricted
  annotations:
    # Seccomp v1.11 使用 'runtime/default'，而 v1.10 及更早版本使用 'docker/default'
    seccomp.security.alpha.kubernetes.io/allowedProfileNames: 'runtime/default'
    seccomp.security.alpha.kubernetes.io/defaultProfileName:  'runtime/default'
    apparmor.security.beta.kubernetes.io/allowedProfileNames: 'runtime/default'
    apparmor.security.beta.kubernetes.io/defaultProfileName:  'runtime/default'
spec:
  privileged: false
  # Required to prevent escalations to root.
  allowPrivilegeEscalation: false
  # This is redundant with non-root + disallow privilege escalation,
  # but we can provide it for defense in depth.
  requiredDropCapabilities:
    - ALL
  # Allow core volume types.
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    # Assume that persistentVolumes set up by the cluster admin are safe to use.
    - 'persistentVolumeClaim'
  hostNetwork: false
  hostIPC: false
  hostPID: false
  runAsUser:
    # Require the container to run without root privileges.
    rule: 'MustRunAsNonRoot'
  seLinux:
    # This policy assumes the nodes are using AppArmor rather than SELinux.
    rule: 'RunAsAny'
  supplementalGroups:
    rule: 'MustRunAs'
    ranges:
      # Forbid adding the root group.
      - min: 1
        max: 65535
  fsGroup:
    rule: 'MustRunAs'
    ranges:
      # Forbid adding the root group.
      - min: 1
        max: 65535
  readOnlyRootFilesystem: false
```

完整參考見[這裡](../concepts/security-context.md)。

## Sysctls

Sysctls 允許容器設置內核參數，分為安全 Sysctls 和非安全 Sysctls

- 安全 Sysctls：即設置後不影響其他 Pod 的內核選項，只作用在容器 namespace 中，默認開啟。包括以下幾種
  - `kernel.shm_rmid_forced`
  - `net.ipv4.ip_local_port_range`
  - `net.ipv4.tcp_syncookies`
- 非安全 Sysctls：即設置好有可能影響其他 Pod 和 Node 上其他服務的內核選項，默認禁止。如果使用，需要管理員在配置 kubelet 時開啟，如 `kubelet --experimental-allowed-unsafe-sysctls 'kernel.msg*,net.ipv4.route.min_pmtu'`

Sysctls 在 v1.11 升級為 Beta 版，可以通過 PSP spec 直接設置，如

```yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: sysctl-psp
spec:
  allowedUnsafeSysctls:
  - kernel.msg*
  forbiddenSysctls:
  - kernel.shm_rmid_forced
```

而 v1.10 及更早版本則為 Alpha 階段，需要通過 Pod annotation 設置，如：

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

[AppArmor(Application Armor)](http://wiki.apparmor.net/index.php/AppArmor_Core_Policy_Reference) 是 Linux 內核的一個安全模塊，允許系統管理員將每個程序與一個安全配置文件關聯，從而限制程序的功能。通過它你可以指定程序可以讀、寫或運行哪些文件，是否可以打開網絡端口等。作為對傳統 Unix 的自主訪問控制模塊的補充，AppArmor 提供了強制訪問控制機制。

在使用 AppArmor 之前需要注意

- Kubernetes 版本 >=v1.4
- apiserver 和 kubelet 已開啟 AppArmor 特性，`--feature-gates=AppArmor=true`
- 已開啟 apparmor 內核模塊，通過 `cat /sys/module/apparmor/parameters/enabled` 查看
- 僅支持 docker container runtime
- AppArmor profile 已經加載到內核，通過 `cat /sys/kernel/security/apparmor/profiles` 查看

AppArmor 還在 alpha 階段，需要通過 Pod annotation `container.apparmor.security.beta.kubernetes.io/<container_name>` 來設置。可選的值包括

- `runtime/default`: 使用 Container Runtime 的默認配置
- `localhost/<profile_name>`: 使用已加載到內核的 AppArmor profile

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
    command: ["sh", "-c", "echo'Hello AppArmor!'&& sleep 1h"]
EOF
pod "hello-apparmor" created

$ kubectl exec hello-apparmor cat /proc/1/attr/current
k8s-apparmor-example-deny-write (enforce)

$ kubectl exec hello-apparmor touch /tmp/test
touch: /tmp/test: Permission denied
error: error executing remote command: command terminated with non-zero exit code: Error executing in Docker Container: 1
```

## Seccomp

[Seccomp](https://www.kernel.org/doc/Documentation/prctl/seccomp_filter.txt) 是 Secure computing mode 的縮寫，它是 Linux 內核提供的一個操作，用於限制一個進程可以執行的系統調用．Seccomp 需要有一個配置文件來指明容器進程允許和禁止執行的系統調用。

在 Kubernetes 中，需要將 seccomp 配置文件放到 `/var/lib/kubelet/seccomp` 目錄中（可以通過 kubelet 選項 `--seccomp-profile-root` 修改）。比如禁止 chmod 的格式為

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

Seccomp 還在 alpha 階段，需要通過 Pod annotation 設置，包括

- `security.alpha.kubernetes.io/seccomp/pod`：應用到該 Pod 的所有容器
- `security.alpha.kubernetes.io/seccomp/container/<container name>`：應用到指定容器

而 value 有三個選項

- `runtime/default`: 使用 Container Runtime 的默認配置
- `unconfined`: 允許所有系統調用
- `localhost/<profile-name>`: 使用 Node 本地安裝的 seccomp，需要放到 `/var/lib/kubelet/seccomp` 目錄中

比如使用剛才創建的 seccomp 配置：

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

## kube-bench

[kube-bench](https://github.com/aquasecurity/kube-bench) 提供了一個簡單的工具來檢查 Kubernetes 的配置（包括 master 和 node）是否符合最佳的安全實踐（基於 [CIS Kubernetes Benchmark](https://www.cisecurity.org/benchmark/kubernetes/)）。

**推薦所有生產環境的 Kubernetes 集群定期運行 kube-bench，保證集群配置符合最佳的安全實踐。**

安裝 `kube-bench`：

```sh
$ docker run --rm -v `pwd`:/host aquasec/kube-bench:latest install
$ ./kube-bench <master|node>
```

當然，kube-bench 也可以直接在容器內運行，比如通常對 Master 和 Node 的檢查命令分別為：

```sh
$ kubectl apply -f https://github.com/feiskyer/kubernetes-handbook/raw/master/examples/job-master.yaml
job.batch/kube-bench-master created

$ kubectl apply -f https://github.com/feiskyer/kubernetes-handbook/raw/master/examples/job-node.yaml
job.batch/kube-bench-node created

# Wait for a few seconds for the job to complete
$ kubectl get pods
NAME                      READY   STATUS      RESTARTS   AGE
kube-bench-master-k7jdd   0/1     Completed   0          2m15s
kube-bench-node-p9sl9     0/1     Completed   0          2m15s

# The results are held in the pod's logs
$ kubectl logs kube-bench-master-k7jdd
[INFO] 1 Master Node Security Configuration
[INFO] 1.1 API Server
...
```

## 鏡像安全

[Clair](https://github.com/coreos/clair/) 是 CoreOS 開源的容器安全工具，用來靜態分析鏡像中潛在的安全問題。推薦將 Clair 集成到 Devops 流程中，自動對所有鏡像進行安全掃描。

安裝 Clair 的方法為：

```sh
git clone https://github.com/coreos/clair
cd clair/contrib/helm
helm dependency update clair
helm install clair
```

Clair 項目本身只提供了 API，在實際使用中還需要一個[客戶端（或集成Clair的服務）](https://github.com/coreos/clair/blob/master/Documentation/integrations.md)配合使用。比如，使用 [reg](https://github.com/genuinetools/reg) 的方法為

```sh
# Install
$ go get github.com/genuinetools/reg

# Vulnerability Reports
$ reg vulns --clair https://clair.j3ss.co r.j3ss.co/chrome

# Generating Static Website for a Registry
$ $ reg server --clair https://clair.j3ss.co
```

其他鏡像安全掃描工具還有：

- [National Vulnerability Database](https://nvd.nist.gov/)
- [OpenSCAP tools](https://www.open-scap.org/tools/)
- [coreos/clair](https://github.com/coreos/clair)
- [aquasecurity/microscanner](https://github.com/aquasecurity/microscanner)
- [Docker Registry Server](https://docs.docker.com/registry/deploying/)
- [GitLab Container Registry](https://docs.gitlab.com/ee/user/project/container_registry.html)
- [Red Hat Quay container registry](https://www.openshift.com/products/quay)
- [Amazon Elastic Container Registry](https://aws.amazon.com/ecr/)
- [theupdateframework/notary](https://github.com/theupdateframework/notary)
- [weaveworks/flux](https://github.com/weaveworks/flux)
- [IBM/portieris](https://github.com/IBM/portieris)
- [Grafeas](https://grafeas.io/)
- [in-toto](https://in-toto.github.io/)

## 其他安全工具

開源產品：

- [falco](https://github.com/falcosecurity/falco)：容器運行時安全行為監控工具。
- [docker-bench-security](https://github.com/docker/docker-bench-security)：Docker 環境安全檢查工具。
- [kube-hunter](https://github.com/aquasecurity/kube-hunter)：Kubernetes 集群滲透測試工具。
- <https://github.com/shyiko/kubesec>
- [Istio](https://istio.io/)
- [Linkerd](https://linkerd.io/)
- [Open Vulnerability and Assessment Language](https://oval.mitre.org/index.html)
- [aporeto-inc/trireme-kubernetes](https://github.com/aporeto-inc/trireme-kubernetes)
- [jetstack/cert-manager](https://github.com/jetstack/cert-manager/)
- [Kata Containers](https://katacontainers.io/)
- [google/gvisor](https://github.com/google/gvisor)
- [SPIFFE](https://spiffe.io/)
- [Open Policy Agent](https://www.openpolicyagent.org/)

商業產品

- [Twistlock](https://www.twistlock.com/)
- [Aqua Container Security Platform](https://www.aquasec.com/)
- [Sysdig Secure](https://sysdig.com/products/secure/)
- [Neuvector](https://neuvector.com/)

## 參考文檔

- [Securing a Kubernetes cluster](https://kubernetes.io/docs/tasks/administer-cluster/securing-a-cluster/)
- [kube-bench](https://github.com/aquasecurity/kube-bench)
- [Kubernetes Security - Operating Kubernetes Clusters and Applications Safely](https://kubernetes-security.info)
- [Kubernetes Security - Best Practice Guide](https://github.com/freach/kubernetes-security-best-practice)
