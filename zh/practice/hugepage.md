# HugePage

HugePage 是 v1.9 中引入的新特性（v1.9 Alpha，v1.10 Beta），允许在容器中直接使用 Node 上的 HugePage。

## 配置

- `--feature-gates=HugePages=true`
- Node 节点上预先分配好 HugePage，如

```sh
mount -t hugetlbfs \
    -o uid=<value>,gid=<value>,mode=<value>,pagesize=<value>,size=<value>,\
    min_size=<value>,nr_inodes=<value> none /mnt/huge
```

## 使用

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

注意

- HugePage 请求和限制必须相等
- HugePage 提供 Pod 级别的隔离，暂不支持容器级别的隔离
- 基于 HugePage 的 EmptyDir 存储卷仅可使用请求的 HugePage 内存
- 可以通过 ResourceQuota 限制 HugePage 的用量
- 容器应用内使用 `shmget(SHM_HUGETLB)` 获取 HugePage 时，必需配置与 `proc/sys/vm/hugetlb_shm_group` 中一致的用户组（`securityContext.SupplementalGroups`）
