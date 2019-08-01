# CronJob

CronJob 即定時任務，就類似於 Linux 系統的 crontab，在指定的時間週期運行指定的任務。

## API 版本對照表

| Kubernetes 版本 | Batch API 版本 | 默認開啟 |
| --------------- | -------------- | -------- |
| v1.5-v1.7       | batch/v2alpha1 | 否       |
| v1.8-v1.9       | batch/v1beta1  | 是       |

注意：使用默認未開啟的 API 時需要在 kube-apiserver 中配置 `--runtime-config=batch/v2alpha1`。

## CronJob Spec

- `.spec.schedule` 指定任務運行週期，格式同 [Cron](https://en.wikipedia.org/wiki/Cron)
- `.spec.jobTemplate` 指定需要運行的任務，格式同 [Job](job.md)
- `.spec.startingDeadlineSeconds` 指定任務開始的截止期限
- `.spec.concurrencyPolicy` 指定任務的併發策略，支持 Allow、Forbid 和 Replace 三個選項

```yaml
apiVersion: batch/v1beta1
kind: CronJob
metadata:
  name: hello
spec:
  schedule: "*/1 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: hello
            image: busybox
            args:
            - /bin/sh
            - -c
            - date; echo Hello from the Kubernetes cluster
          restartPolicy: OnFailure
```

```
$ kubectl create -f cronjob.yaml
cronjob "hello" created
```

當然，也可以用 `kubectl run` 來創建一個 CronJob：

```
kubectl run hello --schedule="*/1 * * * *" --restart=OnFailure --image=busybox -- /bin/sh -c "date; echo Hello from the Kubernetes cluster"
```

```
$ kubectl get cronjob
NAME      SCHEDULE      SUSPEND   ACTIVE    LAST-SCHEDULE
hello     */1 * * * *   False     0         <none>
$ kubectl get jobs
NAME               DESIRED   SUCCESSFUL   AGE
hello-1202039034   1         1            49s
$ pods=$(kubectl get pods --selector=job-name=hello-1202039034 --output=jsonpath={.items..metadata.name} -a)
$ kubectl logs $pods
Mon Aug 29 21:34:09 UTC 2016
Hello from the Kubernetes cluster

# 注意，刪除 cronjob 的時候不會自動刪除 job，這些 job 可以用 kubectl delete job 來刪除
$ kubectl delete cronjob hello
cronjob "hello" deleted
```

## 參考文檔

- [Cron Jobs](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/)
