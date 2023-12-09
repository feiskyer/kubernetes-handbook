# Troubleshooting Persistent Storage 

This chapter introduces methods to troubleshoot persistent storage issues – including PV (Persistent Volume), PVC (Persistent Volume Claim), StorageClass, and the like.

Generally speaking, no matter what abnormal state the PV is in, executing the `kubectl describe pv/pvc <pod-name>` command allows you to view the current events of the PV. These events are usually instrumental in diagnosing any issues that may have occurred with the PV or PVC.

```bash
kubectl get pv
kubectl get pvc
kubectl get sc

kubectl describe pv <pv-name>
kubectl describe pvc <pvc-name>
kubectl describe sc <storage-class-name>
```
