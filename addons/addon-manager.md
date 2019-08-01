# Addon-manager

附加組件管理器（Addon-manager）是運行在 Kubernetes 集群 Master 節點、用來管理附加組件（Addons）的服務。它管理著 `$ADDON_PATH`（默認是 `/etc/kubernetes/addons/`）目錄中的所有擴展，保證它們始終運行在期望狀態。

Addon-manager 支持兩種標籤

- 對於帶有 `addonmanager.kubernetes.io/mode=Reconcile` 標籤的擴展，無法通過 API 來修改，即
  - 如果通過 API 修改了，則會自動回滾到 `/etc/kubernetes/addons/` 中的配置
  - 如果通過 API 刪除了，則會通過 `/etc/kubernetes/addons/` 中的配置自動重新創建
  - 如果從 `/etc/kubernetes/addons/` 中刪除配置，則 Kubernetes 資源也會刪除
  - 也就是說只能通過修改 `/etc/kubernetes/addons/` 中的配置來修改
- 對於帶有 `addonmanager.kubernetes.io/mode=EnsureExists` 標籤到擴展，僅檢查擴展是否存在而不檢查配置是否更改，即
  - 可以通過 API 來修改配置，不會自動回滾
  - 如果通過 API 刪除了，則會通過 `/etc/kubernetes/addons/` 中的配置自動重新創建
  - 如果從 `/etc/kubernetes/addons/` 中刪除配置，則 Kubernetes 資源不會刪除

## 部署方法

將下面的 YAML 存入所有 Master 節點的 `/etc/kubernetes/manifests/kube-addon-manager.yaml` 文件中：

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

## 源碼

Addon-manager 的源碼維護在 <https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/addon-manager>。
