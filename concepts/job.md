# Job

Job 負責批量處理短暫的一次性任務 (short lived one-off tasks)，即僅執行一次的任務，它保證批處理任務的一個或多個 Pod 成功結束。

## API 版本對照表

| Kubernetes 版本 | Batch API 版本 | 默認開啟 |
| --------------- | -------------- | -------- |
| v1.5+           | batch/v1       | 是       |

## Job 類型

Kubernetes 支持以下幾種 Job：

- 非並行 Job：通常創建一個 Pod 直至其成功結束
- 固定結束次數的 Job：設置 `.spec.completions`，創建多個 Pod，直到 `.spec.completions` 個 Pod 成功結束
- 帶有工作隊列的並行 Job：設置 `.spec.Parallelism` 但不設置 `.spec.completions`，當所有 Pod 結束並且至少一個成功時，Job 就認為是成功

根據 `.spec.completions` 和 `.spec.Parallelism` 的設置，可以將 Job 劃分為以下幾種 pattern：

|Job 類型 | 使用示例 | 行為 | completions|Parallelism|
|-------|------|----|----------|-----------|
| 一次性 Job | 數據庫遷移 | 創建一個 Pod 直至其成功結束 | 1|1|
| 固定結束次數的 Job | 處理工作隊列的 Pod | 依次創建一個 Pod 運行直至 completions 個成功結束 | 2+|1|
| 固定結束次數的並行 Job | 多個 Pod 同時處理工作隊列 | 依次創建多個 Pod 運行直至 completions 個成功結束 | 2+|2+|
| 並行 Job | 多個 Pod 同時處理工作隊列 | 創建一個或多個 Pod 直至有一個成功結束 | 1|2+|

## Job Controller

Job Controller 負責根據 Job Spec 創建 Pod，並持續監控 Pod 的狀態，直至其成功結束。如果失敗，則根據 restartPolicy（只支持 OnFailure 和 Never，不支持 Always）決定是否創建新的 Pod 再次重試任務。

![](images/job.png)

## Job Spec 格式

- spec.template 格式同 Pod
- RestartPolicy 僅支持 Never 或 OnFailure
- 單個 Pod 時，默認 Pod 成功運行後 Job 即結束
- `.spec.completions` 標誌 Job 結束需要成功運行的 Pod 個數，默認為 1
- `.spec.parallelism` 標誌並行運行的 Pod 的個數，默認為 1
- `spec.activeDeadlineSeconds` 標誌失敗 Pod 的重試最大時間，超過這個時間不會繼續重試

一個簡單的例子：

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: pi
spec:
  template:
    metadata:
      name: pi
    spec:
      containers:
      - name: pi
        image: perl
        command: ["perl",  "-Mbignum=bpi", "-wle", "print bpi(2000)"]
      restartPolicy: Never
```

```sh
# 創建 Job
$ kubectl create -f ./job.yaml
job "pi" created
# 查看 Job 的狀態
$ kubectl describe job pi
Name:		pi
Namespace:	default
Selector:	controller-uid=cd37a621-5b02-11e7-b56e-76933ddd7f55
Labels:		controller-uid=cd37a621-5b02-11e7-b56e-76933ddd7f55
		job-name=pi
Annotations:	<none>
Parallelism:	1
Completions:	1
Start Time:	Tue, 27 Jun 2017 14:35:24 +0800
Pods Statuses:	0 Running / 1 Succeeded / 0 Failed
Pod Template:
  Labels:	controller-uid=cd37a621-5b02-11e7-b56e-76933ddd7f55
		job-name=pi
  Containers:
   pi:
    Image:	perl
    Port:
    Command:
      perl
      -Mbignum=bpi
      -wle
      print bpi(2000)
    Environment:	<none>
    Mounts:		<none>
  Volumes:		<none>
Events:
  FirstSeen	LastSeen	Count	From		SubObjectPath	Type		Reason			Message
  ---------	--------	-----	----		-------------	--------	------			-------
  2m		2m		1	job-controller			Normal		SuccessfulCreate	Created pod: pi-nltxv

# 使用'job-name=pi'標籤查詢屬於該 Job 的 Pod
# 注意不要忘記'--show-all'選項顯示已經成功（或失敗）的 Pod
$ kubectl get pod --show-all -l job-name=pi
NAME       READY     STATUS      RESTARTS   AGE
pi-nltxv   0/1       Completed   0          3m

# 使用 jsonpath 獲取 pod ID 並查看 Pod 的日誌
$ pods=$(kubectl get pods --selector=job-name=pi --output=jsonpath={.items..metadata.name})
$ kubectl logs $pods
3.141592653589793238462643383279502...
```

固定結束次數的 Job 示例

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: busybox
spec:
  completions: 3
  template:
    metadata:
      name: busybox
    spec:
      containers:
      - name: busybox
        image: busybox
        command: ["echo", "hello"]
      restartPolicy: Never
```

## Bare Pods

所謂 Bare Pods 是指直接用 PodSpec 來創建的 Pod（即不在 ReplicaSets 或者 ReplicationCtroller 的管理之下的 Pods）。這些 Pod 在 Node 重啟後不會自動重啟，但 Job 則會創建新的 Pod 繼續任務。所以，推薦使用 Job 來替代 Bare Pods，即便是應用只需要一個 Pod。

## 參考文檔

- [Jobs - Run to Completion](https://kubernetes.io/docs/concepts/workloads/controllers/jobs-run-to-completion/)
