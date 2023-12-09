# Safety and Security

When considering safety from a security perspective, Kubernetes includes potential attack vectors as shown in the image below:

![](../.gitbook/assets/attach-vectors%20%281%29.png)

(Image from "Kubernetes Security - Operating Kubernetes Clusters and Applications Safely")

To ensure the security of the cluster and containerized applications, Kubernetes offers a plethora of security mechanisms. These mechanisms restrict container behavior, minimize the attack surface of containers and clusters, thereby safeguarding the integrity of the entire system.

Cluster Security, for instance, involves components (such as kube-apiserver, etcd, kubelet, etc.) only exposing secure APIs and initiating TLS authentication, and enabling RBAC;
Security Context: Restricting container behavior, including Capabilities, ReadOnlyRootFilesystem, Privileged, RunAsNonRoot, RunAsUser, and SELinuxOptions, among others;
Pod Security Policy: Cluster-level Pod security policies that automatically set the Security Context for Pods and Volumes within the cluster;
Sysctls: Allowing containers to set kernel parameters, subdivided into Safe Sysctls and Unsafe Sysctls;
AppArmor: Restricting application access permissions;
Network Policies: Finely controlling network access for container applications and within the cluster;
Seccomp: An abbreviation for Secure computing mode, which limits the system calls that container applications can execute.

In addition, it is recommended to use newer versions of Kubernetes, as they usually contain fixes for common security issues. You can refer to [kubernetes-announce](https://groups.google.com/forum/#!forum/kubernetes-announce) for the latest Kubernetes release information or to [cvedetails.com](https://www.cvedetails.com/version-list/15867/34016/1/Kubernetes-Kubernetes.html) to review the CVE (Common Vulnerabilities and Exposures) list for each version of Kubernetes.

## Cluster Security

* Kubernetes components (such as kube-apiserver, etcd, kubelet, etc.) only expose secure APIs and initiate TLS authentication.
* Enable RBAC authorization, granting container applications the least privileges, and enable NodeRestriction admission control (to limit Kubelet permissions).
  * When there are too many RBAC rules or they fail to meet actual needs, it's recommended to use [Open Policy Agent (OPA)](https://www.openpolicyagent.org/) to configure more flexible access policies.
* Enable encrypted storage of Secrets (Secret Encryption) and configure TLS authentication for etcd;
* Prohibit anonymous access and read-only ports of Kubelet, and initiate certificate rotation updates for Kubelet (Certificate Rotation).
* Disable the default ServiceAccount's automountServiceAccountToken, and create specific ServiceAccounts for container applications when necessary.
* Prohibit anonymous access to the Dashboard, restrict Dashboard access through RBAC, and ensure that the Dashboard can only be accessed over an internal network (via kubectl proxy).
* Run [CIS Kubernetes Benchmark](https://www.cisecurity.org/benchmark/kubernetes/) regularly to ensure that the cluster's configuration or updates comply with the best security practices (using [kube-bench](https://github.com/aquasecurity/kube-bench) and [kube-hunter](https://github.com/aquasecurity/kube-hunter)).
* In multi-tenant scenarios, containerization processes can be strongly isolated using Kata Containers, gVisor, etc., or communication between container applications can be automatically encrypted using Istio, Linkerd, etc.

## TLS Security

To ensure TLS security and avoid [Zombie POODLE and GOLDENDOODLE Vulnerabilities](https://blog.qualys.com/technology/2019/04/22/zombie-poodle-and-goldendoodle-vulnerabilities), disable the CBC (Cipher Block Chaining) mode for TLS 1.2.

You can test TLS security issues with [https://www.ssllabs.com/](https://www.ssllabs.com/).

## Security Context and Pod Security Policy

```yaml
apiVersion: extensions/v1beta1
kind: PodSecurityPolicy
metadata:
  name: restricted
  annotations:
    # Seccomp v1.11 uses 'runtime/default', while v1.10 and previous versions use 'docker/default'
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

For a complete reference, see [here](../concepts/objects/security-context.md).

## Sysctls

Sysctls allow containerized applications to set kernel parameters, which are categorized into Safe Sysctls and Unsafe Sysctls:

* Safe Sysctls: Kernel options that do not affect other Pods after being set and only act within the container namespace, enabled by default. These include:
  * `kernel.shm_rmid_forced`
  * `net.ipv4.ip_local_port_range`
  * `net.ipv4.tcp_syncookies`
* Unsafe Sysctls: Kernel options that may affect other Pods and other services on the Node after being set, disabled by default. If used, administrators need to enable them during kubelet configuration, e.g. `kubelet --experimental-allowed-unsafe-sysctls 'kernel.msg*,net.ipv4.route.min_pmtu'`

Sysctls upgraded to Beta status in v1.11 and can be set directly through PSP specs, like so:

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

For versions v1.10 and earlier at the Alpha stage, they must be set through Pod annotations, such as:

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

[AppArmor (Application Armor)](http://wiki.apparmor.net/index.php/AppArmor_Core_Policy_Reference) is a security module in the Linux kernel that allows system administrators to associate each program with a security configuration file, thus limiting the program's capabilities. It specifies which files a program may read, write, or execute, and whether it can open network ports, among other things. As a supplement to the traditional Unix discretionary access control modules, AppArmor provides a mandatory access control mechanism.

Before using AppArmor, you should note that:

* Kubernetes version >=v1.4
* The apiserver and kubelet have enabled the AppArmor feature, `--feature-gates=AppArmor=true`
* The AppArmor kernel module is enabled, check with `cat /sys/module/apparmor/parameters/enabled`
* Only supports docker container runtime
* AppArmor profiles are already loaded into the kernel, check with `cat /sys/kernel/security/apparmor/profiles`

AppArmor is still in the alpha stage and requires setting via Pod annotation `container.apparmor.security.beta.kubernetes.io/<container_name>` with possible values:

* `runtime/default`: Use the default configuration of the Container Runtime
* `localhost/<profile_name>`: Use an AppArmor profile that has been loaded into the kernel

```bash
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

[Seccomp](https://www.kernel.org/doc/Documentation/prctl/seccomp_filter.txt) stands for Secure computing mode, which is an operation provided by the Linux kernel to limit the system calls a process is allowed to perform. Seccomp requires a configuration file that delineates the system calls permitted and prohibited for container processes.

In Kubernetes, seccomp configuration files should be placed in the `/var/lib/kubelet/seccomp` directory (modifiable via the kubelet option `--seccomp-profile-root`). For instance, to disable chmod:

```bash
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

Seccomp is still in the alpha stage and must be set through Pod annotations, including:

* `security.alpha.kubernetes.io/seccomp/pod`: Applies to all containers in the Pod
* `security.alpha.kubernetes.io/seccomp/container/<container name>`: Applies to a specified container

And the value options are:

* `runtime/default`: Use the default configuration of the Container Runtime
* `unconfined`: Allows all system calls
* `localhost/<profile-name>`: Use seccomp installed locally on the Node, placed in the `/var/lib/kubelet/seccomp` directory

For example, using the seccomp configuration created above:

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

[kube-bench](https://github.com/aquasecurity/kube-bench) provides a straightforward tool to check if Kubernetes configuration (including master and node) aligns with security best practices (based on [CIS Kubernetes Benchmark](https://www.cisecurity.org/benchmark/kubernetes/)).

**It’s recommended that all production Kubernetes clusters run kube-bench regularly to ensure cluster configurations meet best security practices.**

Installing `kube-bench`:

```bash
$ docker run --rm -v `pwd`:/host aquasec/kube-bench:latest install
$ ./kube-bench <master|node>
```

Of course, kube-bench can also be run directly within containers. Standard commands for checking Master and Node respectively usually are:

```bash
$ kubectl apply -f https://github.com/feiskyer/kubernetes-handbook/raw/master/examples/job-master.yaml
job.batch/kube-bench-master created

$ kubectl apply -f https://github.com/feiskyer/kubernetes-handbook/raw/master/examples/job-node.yaml
job.batch/kube-bench-node created

# Wait for a few seconds for the job to complete
$ kubectl get pods
NAME                      READY   STATUS      RESTARTS   AGE
kube-bench-master-k7jdd   0/1     Completed   0          2m15s
kube-bench-node-p9sl9     0/1     Completed   0          2m15s

# The results are stored in the pod's logs
$ kubectl logs kube-bench-master-k7jdd
[INFO] 1 Master Node Security Configuration
[INFO] 1.1 API Server
...
```

## Image Security

### Clair

[Clair](https://github.com/coreos/clair/) is an open-source container security tool by CoreOS that statically analyzes images for potential security vulnerabilities. It is recommended to integrate Clair into DevOps processes to automatically scan all images for security concerns.

The method to install Clair is as follows:

```bash
git clone https://github.com/coreos/clair
cd clair/contrib/helm
helm dependency update clair
helm install clair
```

The Clair project itself only provides an API, so in practice, it requires a [client (or service integrating Clair)](https://quay.github.io/clair/howto/deployment.html) for usage. For instance, using [reg](https://github.com/genuinetools/reg) would be as follows:

```bash
# Install
$ go get github.com/genuinetools/reg

# Vulnerability Reports
$ reg vulns --clair https://clair.j3ss.co r.j3ss.co/chrome

# Generating a Static Website for a Registry
$ reg server --clair https://clair.j3ss.co
```

### trivy

[trivy](https://github.com/aquasecurity/trivy) is an open-source container vulnerability scanner by Aqua Security. Trivy is simpler to use compared to Clair, which makes it more convenient for integration into CI workflows.

```bash
# Install
sudo apt-get install wget apt-transport-https gnupg lsb-release
wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -
echo deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main | sudo tee -a /etc/apt/sources.list.d/trivy.list
sudo apt-get update
sudo apt-get install -y trivy

# Scanning an image
trivy python:3.4-alpine
```

### Other Tools

Other image security scanning tools include:

* [National Vulnerability Database](https://nvd.nist.gov/)
* [OpenSCAP tools](https://www.open-scap.org/tools/)
* [coreos/clair](https://github.com/coreos/clair)
* [aquasecurity/microscanner](https://github.com/aquasecurity/microscanner)
* [Docker Registry Server](https://docs.docker.com/registry/deploying/)
* [GitLab Container Registry](https://docs.gitlab.com/ee/user/project/container_registry.html)
* [Red Hat Quay container registry](https://www.openshift.com/products/quay)
* [Amazon Elastic Container Registry](https://aws.amazon.com/ecr/)
* [theupdateframework/notary](https://github.com/theupdateframework/notary)
* [weaveworks/flux](https://github.com/weaveworks/flux)
* [IBM/portieris](https://github.com/IBM/portieris)
* [Grafeas](https://grafeas.io/)
* [in-toto](https://in-toto.github.io/)

## Security Tools

Open-source products:

* [falco](https://github.com/falcosecurity/falco): Container runtime security monitoring tool.
* [docker-bench-security](https://github.com/docker/docker-bench-security): Security audit tool for Docker environments.
* [kube-hunter](https://github.com/aquasecurity/kube-hunter): Kubernetes cluster penetration testing tool.
* [https://github.com/shyiko/kubesec](https://github.com/shyiko/kubesec)
* [Istio](https://istio.io/)
* [Linkerd](https://linkerd.io/)
* [Open Vulnerability and Assessment Language](https://oval.mitre.org/index.html)
* [jetstack/cert-manager](https://github.com/jetstack/cert-manager/)
* [Kata Containers](https://katacontainers.io/)
* [google/gvisor](https://github.com/google/gvisor)
* [SPIFFE](https://spiffe.io/)
* [Open Policy Agent](https://www.openpolicyagent.org/)

Commercial products:

* [Twistlock](https://www.twistlock.com/)
* [Aqua Container Security Platform](https://www.aquasec.com/)
* [Sysdig Secure](https://sysdig.com/products/secure/)
* [Neuvector](https://neuvector.com/)

## Reference Documents

* [Securing a Kubernetes cluster](https://kubernetes.io/docs/tasks/administer-cluster/securing-a-cluster/)
* [kube-bench](https://github.com/aquasecurity/kube-bench)
* [Kubernetes Security - Operating Kubernetes Clusters and Applications Safely](https://kubernetes-security.info)
* [Kubernetes Security - Best Practice Guide](https://github.com/freach/kubernetes-security-best-practice)