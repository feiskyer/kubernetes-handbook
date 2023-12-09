# Version Support

## Kubernetes version support

In Kubernetes, versions are denoted as **x.y.z**, where x refers to the major version, y to the minor version, and z to the patch version. This versioning follows [Semantic Versioning](http://semver.org/), which means:

* Major version: for incompatible changes to the API.
* Minor version: for backward-compatible additions.
* Patch version: for backward-compatible bug fixes.

The Kubernetes project only maintains the latest three minor versions, each kept in a separate release branch. Serious issues and security fixes discovered in upstream versions are backported to these release branches, which are maintained by [Patch Releases](https://kubernetes.io/releases/patch-releases/).

Minor versions are generally released every three months, so each release branch is typically maintained for about nine months.

**Version support for different components**

In Kubernetes, not all components necessarily share the same version. However, there are basic limitations when deploying mixed versions of components.

**kube-apiserver**

In [highly-available (HA) clusters](https://kubernetes.io/docs/setup/independent/high-availability/), the version gap between instances of kube-apiserver can't exceed one minor version. For instance, if the latest kube-apiserver version is 1.13, other instances of kube-apiserver can only be version 1.13 or 1.12.

**kubelet**

The kubelet version can't be higher than the kube-apiserver version, and it can only lag behind the kube-apiserver by up to two minor versions. For example:

* if the `kube-apiserver` version is **1.13**
* then `kubelet` can be version **1.13**, **1.12**, or **1.11**

Furthermore, for a high-availability cluster:

  * if `kube-apiserver` versions are **1.13** and **1.12**
  * then `kubelet` can be version **1.12**, or **1.11** (but **1.13** would not be supported, as it would be higher than kube-apiserver's **1.12**)

**kube-controller-manager, kube-scheduler, and cloud-controller-manager**

The versions of `kube-controller-manager`, `kube-scheduler`, and `cloud-controller-manager` can't be higher than the kube-apiserver version. Typically, they should have the same version as the kube-apiserver, although they can also run with a variant of one minor version. For instance:

* If `kube-apiserver` version is **1.13**
* Then `kube-controller-manager`, `kube-scheduler`, and `cloud-controller-manager` can be versions **1.13** and **1.12**

Similarly, for a high-availability cluster:

  * If `kube-apiserver` versions are **1.13** and **1.12**
  * Then `kube-controller-manager`, `kube-scheduler`, and `cloud-controller-manager` can be version **1.12** (but, **1.13** would not be supported, as it would be higher than apiserver's **1.12**)

**kubectl**

kubectl can differ from kube-apiserver by one minor version, such as:

* if the `kube-apiserver` version is **1.13**
* then `kubectl` can be versions **1.14**, **1.13**, and **1.12**

**Version upgrade order**

When upgrading from version 1.n to 1.(n+1), the following upgrade order must be followed.

**kube-apiserver**

Prerequisites for upgrade include:

* In single-node clusters, kube-apiserver is version 1.n; in HA clusters, kube-apiserver is either version 1.n or 1.(n+1).
* `kube-controller-manager`, `kube-scheduler`, and `cloud-controller-manager` are all version 1.n.
* The kubelet is version 1.n or 1.(n-1).
* All registered injection webhooks can handle requests from the new version, for instance if ValidatingWebhookConfiguration and MutatingWebhookConfiguration have been updated to support the features introduced in version 1.(n+1).

Now the kube-apiserver can be upgraded to 1.(n+1). However, it is important to note that **versions cannot hop over minor versions** during an upgrade.

### kube-controller-manager, kube-scheduler, and cloud-controller-manager

The prerequisites for upgrade are:

* The kube-apiserver has been upgraded to version 1.(n+1).

With these conditions fulfilled, `kube-controller-manager`, `kube-scheduler` and `cloud-controller-manager` can be upgraded to version **1.(n+1)**.

### Kubelet

The prerequisites for upgrade are:

* The kube-apiserver has been upgraded to version 1.(n+1).
* During the upgrade, the version gap between the kubelet and kube-apiserver must not exceed one minor version.

Then the kubelet can be upgraded to version 1.(n+1).

## References

* [Kubernetes Version and Version Skew Support Policy - Kubernetes](https://kubernetes.io/docs/setup/version-skew-policy/)