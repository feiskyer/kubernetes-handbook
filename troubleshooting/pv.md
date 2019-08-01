# PV 異常排錯

本章介紹持久化存儲異常（PV、PVC、StorageClass等）的排錯方法。

一般來說，無論 PV 處於什麼異常狀態，都可以執行 `kubectl describe pv/pvc <pod-name>` 命令來查看當前 PV 的事件。這些事件通常都會有助於排查 PV 或 PVC 發生的問題。

```sh
kubectl get pv
kubectl get pvc
kubectl get sc

kubectl describe pv <pv-name>
kubectl describe pvc <pvc-name>
kubectl describe sc <storage-class-name>
```

