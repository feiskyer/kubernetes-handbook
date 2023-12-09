# Let's Get Deployed!

## Quick Overview

Deployments offer a declarative definition for Pods and ReplicaSets, making application management more straightforward as compared to the former ReplicationControllers.

## A Handy Version Guide

| Kubernetes Version | Deployment Version |
| :--- | :--- |
| v1.5-v1.6 | extensions/v1beta1 |
| v1.7-v1.15 | apps/v1beta1 |
| v1.8-v1.15 | apps/v1beta2 |
| v1.9+ | apps/v1 |

For example, you can define a simple nginx application as follows:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
spec:
  replicas: 3
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.7.9
        ports:
        - containerPort: 80
```

Scale up:

```text
kubectl scale deployment nginx-deployment --replicas 10
```

If your cluster supports horizontal pod autoscaling, you can even set automatic expansion for Deployment:

```text
kubectl autoscale deployment nginx-deployment --min=10 --max=15 --cpu-percent=80
```

Updating images is also straightforward:

```text
kubectl set image deployment/nginx-deployment nginx=nginx:1.9.1
```

Roll back:

```text
kubectl rollout undo deployment/nginx-deployment
```

Typical use cases for Deployment include:

* Define Deployment to create Pod and ReplicaSet
* Roll up and roll back applications
* Scale up and scale down
* Pause and resume Deployment

## A Brief Explanation of the Deployment Concept

Deployment provides a declarative update for Pod and ReplicaSet (the next generation of Replication Controller).

You only need to describe what you want the target state to be in the Deployment, and the Deployment controller will help you change the actual state of the Pod and ReplicaSet to your target state. You can define a brand new Deployment, or create a new one to replace the old Deployment.

For example:

* Use Deployment to create a ReplicaSet. ReplicaSet creates pods in the background. Check the startup status to see if it is successful or not.
* Then, declare the new state of the Pod by updating the Deployment's PodTemplateSpec field. This creates a new ReplicaSet, and Deployment will move the pod from the old ReplicaSet to the new ReplicaSet at a controlled rate.
* If the current state is unstable, roll back to the previous Deployment revision. Every rollback updates the Deployment's revision.
* Scale the Deployment to meet higher loads.
* Pause Deployment to apply multiple fixes to PodTemplateSpec and then resume operation.
* Determine whether the launch is hung based on the status of Deployment.
* Clear unnecessary old ReplicaSet.

## Creating a Deployment

The following is an example of Deployment, which creates a ReplicaSet to start 3 nginx pods.

Download the sample file and perform the command:

```bash
$ kubectl create -f docs/user-guide/nginx-deployment.yaml --record
deployment "nginx-deployment" created
```

Setting the `—record` flag of kubectl to `true` can record the command that creates or upgrades the resource in the annotation. This will be useful in the future, for example, to see which commands were executed in each Deployment revision.

Executing `get` immediately afterwards will give the following result:

```bash
$ kubectl get deployments
NAME               DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
nginx-deployment   3         0         0            0           1s
```

The output indicates that our desired number of replicas is 3 (based on the configuration in the deployment's `.spec.replicas`). The current number of replicas (` .status.replicas`) is 0, the newest number of replicas (` .status.updatedReplicas`) is 0, and the available number of replicas (` .status.availableReplicas`) is 0.

A few seconds later, performing the `get` command again will give the following output:

```bash
$ kubectl get deployments
NAME               DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
nginx-deployment   3         3         3            3           18s
```

As you can see, Deployment has created 3 replicas, all of which are updated (contain the latest pod template), and are available (based on Deployment's `.spec.minReadySeconds` declaration, the minimum number of pods in ready status). Executing `kubectl get rs` and `kubectl get pods` will display the created ReplicaSets (RS) and Pods.

```bash
$ kubectl get rs
NAME                          DESIRED   CURRENT   READY   AGE
nginx-deployment-2035384211   3         3         0       18s
```

You may notice that the name of a ReplicaSet is always `<Deployment name>-<pod template hash value>`.

```bash
$ kubectl get pods --show-labels
NAME                                READY     STATUS    RESTARTS   AGE       LABELS
nginx-deployment-2035384211-7ci7o   1/1       Running   0          18s       app=nginx,pod-template-hash=2035384211
nginx-deployment-2035384211-kzszj   1/1       Running   0          18s       app=nginx,pod-template-hash=2035384211
nginx-deployment-2035384211-qqcnn   1/1       Running   0          18s       app=nginx,pod-template-hash=2035384211
```

The newly created ReplicaSet will ensure that there are always 3 nginx pods present.

**Note:** You must specify the correct pod template label (`app = nginx`) in the Deployment selector. Do not mix it up with other controllers, including other Deployments, ReplicaSets, ReplicationController, and so on. Although **Kubernetes itself does not prevent you from doing this**, if you do, these controllers will fight each other and may result in incorrect behavior.

## Updating Deployment

**Note:** Only when the Deployment pod template (such as `.spec.template`) is updated, which includes updating labels or container images in Deployment, will it trigger a rollout. Other updates, such as scaling up the Deployment, do not trigger a rollout.

Assuming we now want to use the `nginx:1.9.1` image instead of the original `nginx:1.7.9` image.

```bash
$ kubectl set image deployment/nginx-deployment nginx=nginx:1.9.1
deployment "nginx-deployment" image updated
```

We can use the `edit` command to edit the Deployment. We modify `.spec.template.spec.containers[0].image`, changing `nginx:1.7.9` to `nginx:1.9.1`.

```bash
$ kubectl edit deployment/nginx-deployment
deployment "nginx-deployment" edited
```

To see the status of the rollout,