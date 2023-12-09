# Virtual Clockwork: The CronJob

Imagine a virtual timekeeper, ticking along to the Linux system's crontab, triggering particular tasks to run at the precise time designated. This is the idea behind 'CronJob'.

## API Version Cheat Sheet

| Kubernetes Version | Batch API Version | Activated By Default? |
| :--- | :--- | :--- |
| v1.5-v1.7 | batch/v2alpha1 | No |
| v1.8-v1.20 | batch/v1beta1 | Yes |
| v1.21+    | batch/v1 | Yes |

A word of caution: when executing APIs that aren't activated by default, users must configure `--runtime-config=batch/v2alpha1` in the kube-apiserver.

## CronJob Specs

* `.spec.schedule` outlines the schedule of task execution, akin to the [Cron](https://en.wikipedia.org/wiki/Cron) format.
* `.spec.jobTemplate` lists the tasks that need running, and mirrors the [Job](job.md) format. 
* `.spec.startingDeadlineSeconds` specifies the deadline for initiating tasks. 
* `.spec.concurrencyPolicy` delineates the policy for task concurrency, providing three options: Allow, Forbid, and Replace. 

```yaml
apiVersion: batch/v1
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
            imagePullPolicy: IfNotPresent
            command:
            - /bin/sh
            - -c
            - date; echo Hello from the Kubernetes cluster
          restartPolicy: OnFailure
```

```text
$ kubectl create -f cronjob.yaml
cronjob "hello" created
```

You can also use `kubectl run` to create a CronJob:

```text
kubectl run hello --schedule="*/1 * * * *" --restart=OnFailure --image=busybox -- /bin/sh -c "date; echo Hello from the Kubernetes cluster"
```

```text
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

# When deleting a cronjob, it will also delete its created jobs and pods and stop the creation of new jobs.
$ kubectl delete cronjob hello
cronjob "hello" deleted
```

## Additional Resources

* [Cron Jobs](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/)