# The Power of “Job” in Kubernetes

The key component of Kubernetes system that handles batch handling of short-lived, one-off tasks is known as **Job.** This essential function ensures that one or more Pods successfully execute given tasks. 

## API Version Compatibility

| Kubernetes Version | Batch API Version | Default Activation |
| :--- | :--- | :--- |
| v1.5+ | batch/v1 | Yes |

## Job Varieties

Kubernetes supports several types of Jobs:

* Non-parallel Job: typically creates a single Pod until it ends successfully
* Fixed completion Job: Work by setting `.spec.completions`, creating multiple Pods until the number of `.spec.completions` Pods ends successfully. 
* Parallel Job with a task queue: This type of Job sets `.spec.Parallelism` but doesn't set `.spec.completions`. When all Pods are finished and at least one succeeds, the Job is considered successful.

The types of Jobs are categorized based on the settings of `.spec.completions` and `.spec.Parallelism`:

| Job Type | Use Example | Behavior | Completions | Parallelism |
| :--- | :--- | :--- | :--- | :--- |
| One-time Job | Database migration | Creates a single Pod until it ends successfully | 1 | 1 |
| Fixed completion Job | Pod processing work queue | Creates a Pod in sequence until the `completions` finish successfully | 2+ | 1 |
| Fixed completion Parallel Job | Multiple Pods process work queue simultaneously | Creates multiple Pods in sequence until the `completions` finish successfully | 2+ | 2+ |
| Parallel Job | Multiple Pods process the work queue simultaneously | Creates one or more Pods until one ends successfully | 1 | 2+ |

## Job Controller

Job Controller is in charge of creating Pods according to the Job Spec and continually monitoring the status of the Pods until they successfully complete the task. If a failure occurs, the decision to create a new Pod and retry the task is determined by the `restartPolicy` (supports only `OnFailure` and `Never`, and doesn't support `Always`).

![Job](../../.gitbook/assets/job.png)

## Job Spec Format

* The `spec.template` format is the same as Pod
* RestartPolicy only supports `Never` or `OnFailure`
* When a single Pod, the job ends by default after the Pod runs successfully
* `.spec.completions` flags the number of Pods that need to run successfully for the Job to end, and defaults to 1
* `.spec.parallelism` flags the number of Pods running in parallel and defaults to 1
* `spec.activeDeadlineSeconds` flags the maximum retry time for failed Pods. After this time, they will not continue to retry

An example outlining this format:

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
[...example content...]

## Indexed Job

When Job is used to run distributed tasks, an independent system is typically needed to assign tasks among different worker Pods of the Job. A newly added feature in Kubernetes v1.21, **Indexed Job**, assigns a numerical index to each task and exposes it to each Pod via the annotation `batch.kubernetes.io/job-completion-index`. This feature is enabled by setting `completionMode: Indexed` in the Job spec.

## Pod Auto-Cleanup

The TTL Controller is used to automatically clean up Pods that have finished running or are in a failed state. The TTL of a Pod after stopping can be set with `.spec.ttlSecondsAfterFinished`.

This feature requires the system time on all nodes (including control nodes) in the cluster to be synchronized.

## Job Pausing and Resuming

Beginning from v1.21, the function to pause and resume Jobs is enabled via `.spec.suspend`:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: myjob
spec:
  suspend: true
  parallelism: 1
  completions: 5
  template:
    spec:
      ...
```

[...example content...]

## Bare Pods

Bare Pods are directly created Pods that are not managed by ReplicaSets or ReplicationControllers. These Pods are not rebooted automatically after Node restart, but the Job can make a new Pod to continue the task. Hence, it's recommended to replace bare Pods with Jobs, even for applications that require a single Pod only.

## References

* [Jobs - Run to Completion](https://kubernetes.io/docs/concepts/workloads/controllers/jobs-run-to-completion/)