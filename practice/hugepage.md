# HugePage

HugePage 是 v1.9 中引入的新特性（v1.9 Alpha，v1.10 Beta），允許在容器中直接使用 Node 上的 HugePage。

## 配置

- `--feature-gates=HugePages=true`
- Node 節點上預先分配好 HugePage，如

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

- HugePage 請求和限制必須相等
- HugePage 提供 Pod 級別的隔離，暫不支持容器級別的隔離
- 基於 HugePage 的 EmptyDir 存儲卷僅可使用請求的 HugePage 內存
- 可以通過 ResourceQuota 限制 HugePage 的用量
- 容器應用內使用 `shmget(SHM_HUGETLB)` 獲取 HugePage 時，必需配置與 `proc/sys/vm/hugetlb_shm_group` 中一致的用戶組（`securityContext.SupplementalGroups`）
