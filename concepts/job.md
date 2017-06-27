# Job

Job负责批量处理短暂的一次性任务 (short lived one-off tasks)，即仅执行一次的任务，它保证批处理任务的一个或多个Pod成功结束。

Kubernetes支持以下几种Job：

- 非并行Job：通常创建一个Pod直至其成功结束
- 固定结束次数的Job：设置`.spec.completions`，创建多个Pod，直到`.spec.completions`个Pod成功结束
- 带有工作队列的并行Job：设置`.spec.Parallelism`但不设置`.spec.completions`，当所有Pod结束并且至少一个成功时，Job就认为是成功

根据`.spec.completions`和`.spec.Parallelism`的设置，可以将Job划分为以下几种pattern：

|Job类型|使用示例|行为|completions|Parallelism|
|-------|------|----|----------|-----------|
|一次性Job|数据库迁移|创建一个Pod直至其成功结束|1|1|
|固定结束次数的Job|处理工作队列的Pod|依次创建一个Pod运行直至completions个成功结束|2+|1|
|固定结束次数的并行Job|多个Pod同时处理工作队列|依次创建多个Pod运行直至completions个成功结束|2+|2+|
|并行Job|多个Pod同时处理工作队列|创建一个或多个Pod直至有一个成功结束| 1|2+|

## Job Controller

Job Controller负责根据Job Spec创建Pod，并持续监控Pod的状态，直至其成功结束。如果失败，则根据restartPolicy（只支持OnFailure和Never，不支持Always）决定是否创建新的Pod再次重试任务。

![](images/job.png)

## Job Spec格式

- spec.template格式同Pod
- RestartPolicy仅支持Never或OnFailure
- 单个Pod时，默认Pod成功运行后Job即结束
- `.spec.completions`标志Job结束需要成功运行的Pod个数，默认为1
- `.spec.parallelism`标志并行运行的Pod的个数，默认为1
- `spec.activeDeadlineSeconds`标志失败Pod的重试最大时间，超过这个时间不会继续重试

一个简单的例子：

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
# 创建Job
$ kubectl create -f ./job.yaml
job "pi" created
# 查看Job的状态
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

# 使用'job-name=pi'标签查询属于该Job的Pod
# 注意不要忘记'--show-all'选项显示已经成功（或失败）的Pod
$ kubectl get pod --show-all -l job-name=pi
NAME       READY     STATUS      RESTARTS   AGE
pi-nltxv   0/1       Completed   0          3m

# 使用jsonpath获取pod ID并查看Pod的日志
$ pods=$(kubectl get pods --selector=job-name=pi --output=jsonpath={.items..metadata.name})
$ kubectl logs $pods
3.141592653589793238462643383279502...
```

固定结束次数的Job示例

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

所谓Bare Pods是指直接用PodSpec来创建的Pod（即不在ReplicaSets或者ReplicationCtroller的管理之下的Pods）。这些Pod在Node重启后不会自动重启，但Job则会创建新的Pod继续任务。所以，推荐使用Job来替代Bare Pods，即便是应用只需要一个Pod。

## 参考文档

- [Jobs - Run to Completion](https://kubernetes.io/docs/concepts/workloads/controllers/jobs-run-to-completion/)
