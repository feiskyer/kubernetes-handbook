# HugePage

HugePage is a new feature introduced in v1.9 (v1.9 Alpha, v1.10 Beta) that enables direct use of HugePages on a Node within containers.

## Configuration

* Enable the feature by setting `--feature-gates=HugePages=true`
* Pre-allocate HugePages on the Node with commands like:

```bash
mount -t hugetlbfs \
    -o uid=<value>,gid=<value>,mode=<value>,pagesize=<value>,size=<value>,\
    min_size=<value>,nr_inodes=<value> none /mnt/huge
```

## Usage

Here's a sample configuration of a Pod that uses HugePages:

```yaml
apiVersion: v1
kind: Pod
metadata:
  generateName: hugepages-volume-
spec:
  containers:
  - image: fedora:latest
    command:
    - sleep
    - inf
    name: example
    volumeMounts:
    - mountPath: /hugepages
      name: hugepage
    resources:
      limits:
        hugepages-2Mi: 100Mi
  volumes:
  - name: hugepage
    emptyDir:
      medium: HugePages
```

Please Note:

* The request for HugePages and the limit must be the same.
* HugePage provides Pod-level isolation, but not yet at the container level.
* EmptyDir volumes based on HugePage can only use the HugePage memory requested.
* Usage of HugePages can be restricted through ResourceQuota.
* When obtaining HugePages within a container application using `shmget(SHM_HUGETLB)`, it is essential to configure the user group to match the one in `proc/sys/vm/hugetlb_shm_group` (`securityContext.SupplementalGroups`).


---

# HugePages Unleashed

Unlocking the Power of Massive Memory Pages in Containers

## Setting the Stage for HugePages

HugePage is a savvy innovation ushered in with v1.9 (Alpha in v1.9, Beta in v1.10), designed to let containers harness the might of Node-level HugePages without a hitch.

## Config Sheet for the Tech-Savvy

To get started with HugePages:
* Flick on the HugePages feature with a simple flag: `--feature-gates=HugePages=true`
* Next, line up your HugePages on the Node like ducks in a row with a command akin to:

```bash
mount -t hugetlbfs \
    -o uid=<value>,gid=<value>,mode=<value>,pagesize=<value>,size=<value>,\
    min_size=<value>,nr_inodes=<value> none /mnt/huge
```

## Entering the HugePages Era

Craft your Pod with a flair for the huge—here's a blueprint to get you rolling:

```yaml
apiVersion: v1
kind: Pod
metadata:
  generateName: hugepages-volume-
spec:
  containers:
  - image: fedora:latest
    command:
    - sleep
    - inf
    name: example
    volumeMounts:
    - mountPath: /hugepages
      name: hugepage
    resources:
      limits:
        hugepages-2Mi: 100Mi
  volumes:
  - name: hugepage
    emptyDir:
      medium: HugePages
```

A Few Pro Tips:

* When dealing with HugePages, make sure your requests match your limits.
* Think of HugePages as a Pod-exclusive club—no container can crash this party alone.
* Your EmptyDir drawers will be custom-fitted just for those HugePages you've asked for.
* Keep a leash on those HugePages with wise ResourceQuota policies.
* Want to snag HugePages in your container's app? Sync up with the user group vibe set by `proc/sys/vm/hugetlb_shm_group` by tweaking `securityContext.SupplementalGroups`.