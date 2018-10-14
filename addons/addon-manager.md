# Addon-manager

附加组件管理器（Addon-manager）是运行在 Kubernetes 集群 Master 节点、用来管理附加组件（Addons）的服务。它管理着 `$ADDON_PATH`（默认是 `/etc/kubernetes/addons/`）目录中的所有扩展，保证它们始终运行在期望状态。

Addon-manager 支持两种标签

- 对于带有 `addonmanager.kubernetes.io/mode=Reconcile` 标签的扩展，无法通过 API 来修改，即
  - 如果通过 API 修改了，则会自动回滚到 `/etc/kubernetes/addons/` 中的配置
  - 如果通过 API 删除了，则会通过 `/etc/kubernetes/addons/` 中的配置自动重新创建
  - 如果从 `/etc/kubernetes/addons/` 中删除配置，则 Kubernetes 资源也会删除
  - 也就是说只能通过修改 `/etc/kubernetes/addons/` 中的配置来修改
- 对于带有 `addonmanager.kubernetes.io/mode=EnsureExists` 标签到扩展，仅检查扩展是否存在而不检查配置是否更改，即
  - 可以通过 API 来修改配置，不会自动回滚
  - 如果通过 API 删除了，则会通过 `/etc/kubernetes/addons/` 中的配置自动重新创建
  - 如果从 `/etc/kubernetes/addons/` 中删除配置，则 Kubernetes 资源不会删除

## 部署方法

将下面的 YAML 存入所有 Master 节点的 `/etc/kubernetes/manifests/kube-addon-manager.yaml` 文件中：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: kube-addon-manager
  namespace: kube-system
  annotations:
    scheduler.alpha.kubernetes.io/critical-pod: ''
    seccomp.security.alpha.kubernetes.io/pod: 'docker/default'
  labels:
    component: kube-addon-manager
spec:
  hostNetwork: true
  containers:
  - name: kube-addon-manager
    # When updating version also bump it in:
    # - test/kubemark/resources/manifests/kube-addon-manager.yaml
    image: k8s.gcr.io/kube-addon-manager:v8.7
    command:
    - /bin/bash
    - -c
    - exec /opt/kube-addons.sh 1>>/var/log/kube-addon-manager.log 2>&1
    resources:
      requests:
        cpu: 3m
        memory: 50Mi
    volumeMounts:
    - mountPath: /etc/kubernetes/
      name: addons
      readOnly: true
    - mountPath: /var/log
      name: varlog
      readOnly: false
    env:
    - name: KUBECTL_EXTRA_PRUNE_WHITELIST
      value: {{kubectl_extra_prune_whitelist}}
  volumes:
  - hostPath:
      path: /etc/kubernetes/
    name: addons
  - hostPath:
      path: /var/log
    name: varlog
```

## 源码

Addon-manager 的源码维护在 <https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/addon-manager>。
