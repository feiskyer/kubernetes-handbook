# Ensuring Safety in Cyberspace: The Role of Security Context

The primary goal of Security Context is to restrict the behavior of untrustworthy containers, shielding the system and other containers from their potential impact.

There are three methods provided by Kubernetes to configure Security Context:

* Container-level Security Context: Applied solely to the specified container
* Pod-level Security Context: Implemented on all containers and Volume within the Pod
* Pod Security Policies (PSP): Applied across all Pods and Volumes within the cluster

## The Nitty-Gritty of Container-level Security Context

[Container-level Security Context](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/) only applies to the assigned container, impacting the Volume not. For instance, setting a container to run in privileged mode can be done like this:

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

## Digging into Pod-level Security Context

[Pod-level Security Context](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/) is applied to all containers inside a Pod, and it also influences the Volume, including fsGroup and selinuxOptions.

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

## Understanding Pod Security Policies (PSP)

Pod Security Policies (PSP) serve as cluster-level Pod security strategies, automatically setting the Security Context for Pods and Volumes within the cluster.

Operating PSP requires the API Server to enable `extensions/v1beta1/podsecuritypolicy`, and to configure the `PodSecurityPolicy` admission controller.

> Note: Due to a lack of flexibility, an imperfect authentication model, and cumbersome configuration updates, PodSecurityPolicy was officially [deprecated](https://kubernetes.io/blog/2021/04/06/podsecuritypolicy-deprecation-past-present-and-future/) in v1.21 and will be removed from the codebase in v1.25. Users currently using PodSecurityPolicy are suggested to migrate to [Open Policy Agent](https://www.openpolicyagent.org/).

### API Version Comparison Table

| Kubernetes Version | Extension Version |
| :--- | :--- |
| v1.5-v1.15 | extensions/v1beta1 |
| v1.10+ | policy/v1beta1 |
| v1.21  | deprecated |

### Supported Controls

| Control | Description |
| :--- | :--- |
| privileged | Operate privileged containers |
| defaultAddCapabilities | Capabilities that can be added to the container |
| requiredDropCapabilities | Capabilities that will be deleted from the container |
| allowedCapabilities | Allowed list of Capabilities |
| volumes | Control which volumes a container can use |
| hostNetwork | Allows the use of the host network |
| hostPorts | Allowed host port list |
| hostPID | Use the host PID namespace |
| hostIPC | Use the host IPC namespace |
| seLinux | SELinux Context |
| runAsUser | user ID |
| supplementalGroups | Allowed supplementary user group |
| fsGroup | volume FSGroup |
| readOnlyRootFilesystem | Read-only root file system |
| allowedHostPaths | Allowed list of paths for the hostPath plugin |
| allowedFlexVolumes | Allowed list of flexVolume plugins |
| allowPrivilegeEscalation | Allow container processes to set [`no_new_privs`](https://www.kernel.org/doc/Documentation/prctl/no_new_privs.txt) |
| defaultAllowPrivilegeEscalation | Default permission for privilege escalation |

### Example

To restrict a container's host port range to 8000-8080, you can do this:

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

To allow only the use of lvm and cifs etc. flexVolume plugins:

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

## A Closer Look at SELinux

SELinux (Security-Enhanced Linux) is an implementation of mandatory access control. It operates under the principle of least privilege, using Linux Security Modules within the Linux kernel. Emmy award-winning SELinux was primarily developed by the United States National Security Agency, and was released to the open source developer community on December 22, 2000.

The security policy for processes can be set using runcon, while the - Z parameter in ls and ps can inspect the security policy applied to files or processes.

### How to Enable or Disable SELinux?

You can edit the / etc/selinux/config file:

* Enable: SELINUX=enforcing
* Disable: SELINUX=disabled

Or use the command for temporary changes:

* Enable: setenforce 1
* Disable: setenforce 0

To check SELinux status:

```text
$ getenforce
```

### Example

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

This generates the following `HostConfig.Binds` for the docker container:

```text
/var/lib/kubelet/pods/f734678c-95de-11e6-89b0-42010a8c0002/volumes/kubernetes.io~empty-dir/test-volume:/mounted_volume:Z
/var/lib/kubelet/pods/f734678c-95de-11e6-89b0-42010a8c0002/volumes/kubernetes.io~secret/default-token-88xxa:/var/run/secrets/kubernetes.io/serviceaccount:ro,Z
/var/lib/kubelet/pods/f734678c-95de-11e6-89b0-42010a8c0002/etc-hosts:/etc/hosts
```

The appropriate Volume also has SELinux properly set:

```text
$ ls -Z /var/lib/kubelet/pods/f734678c-95de-11e6-89b0-42010a8c0002/volumes
drwxr-xr-x. root root unconfined_u:object_r:svirt_sandbox_file_t:s0:c2,c3 kubernetes.io~empty-dir
drwxr-xr-x. root root unconfined_u:object_r:svirt_sandbox_file_t:s0:c2,c3 kubernetes.io~secret
```

## Additional Reading

* [Kubernetes Pod Security Policies](https://kubernetes.io/docs/concepts/policy/pod-security-policy/)