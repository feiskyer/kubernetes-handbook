# PV 排错

本章介绍持久化存储异常（PV、PVC、StorageClass等）的排错方法。

一般来说，无论 PV 处于什么异常状态，都可以执行 `kubectl describe pv/pvc <pod-name>` 命令来查看当前 PV 的事件。这些事件通常都会有助于排查 PV 或 PVC 发生的问题。

```bash
kubectl get pv
kubectl get pvc
kubectl get sc

kubectl describe pv <pv-name>
kubectl describe pvc <pvc-name>
kubectl describe sc <storage-class-name>
```

## 存储资源泄漏问题（v1.33+）

从 Kubernetes v1.33 开始，系统提供了防止 PersistentVolume 资源泄漏的保护机制。以下是相关的排错方法：

### 检查 PV Finalizer

如果 PV 删除时卡在 Terminating 状态，检查是否存在防泄漏 finalizer：

```bash
kubectl get pv <pv-name> -o yaml | grep finalizers -A 5
```

正常的 CSI 动态 PV 应该包含：
```yaml
finalizers:
- kubernetes.io/pv-protection
- external-provisioner.volume.kubernetes.io/finalizer
```

### 验证 CSI External-Provisioner 版本

确保 CSI external-provisioner 版本为 v5.0.1 或更高：

```bash
kubectl get pods -n kube-system | grep provisioner
kubectl describe pod <csi-provisioner-pod> -n kube-system | grep Image
```

### 排查存储后端连接问题

如果 PV 删除挂起，可能是存储后端无法访问：

```bash
# 检查 CSI 驱动程序日志
kubectl logs <csi-provisioner-pod> -n kube-system

# 检查存储后端状态
kubectl get volumeattachments
kubectl describe volumeattachment <attachment-name>
```

### 强制清理泄漏的 PV

**注意：仅在确认存储后端资源已手动清理时使用**

```bash
# 移除防泄漏 finalizer
kubectl patch pv <pv-name> -p '{"metadata":{"finalizers":null}}'

# 或者编辑 PV 移除特定 finalizer
kubectl edit pv <pv-name>
```

### 监控存储资源使用

定期检查是否存在孤立的存储资源：

```bash
# 列出所有 PV 及其状态
kubectl get pv -o wide

# 检查未绑定的 PV
kubectl get pv | grep Available

# 查看存储类配置
kubectl get storageclass -o yaml
```
