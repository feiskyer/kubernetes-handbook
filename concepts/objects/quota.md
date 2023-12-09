# Handling Resource Quotas

Resource quotas are mechanisms created to constrain the usage of resources by users. This process operates as follows:

* Resource Quotas apply to Namespaces and each Namespace can have a maximum of one `ResourceQuota` object. 
* Once the computational resources quota has been initiated, computational resource requests or limits must be configured when creating the container (default values can also be set using the [LimitRange](https://kubernetes.io/docs/tasks/administer-cluster/cpu-memory-limit/) function). 
* New resources cannot be created if the user exceeds their quota.

## Activating Resource Quota Function

* Firstly, configure admittance control `--admission-control=ResourceQuota` when launching API Server.
* Secondly, create a `ResourceQuota` object in the namespace.

## Types of Resource Quotas

* Computational resources, including CPU and memory
  * CPU, limits.cpu, requests.cpu
  * Memory, limits.memory, requests.memory
* Storage resources, including total storage and specific storage class total
  * Requests.storage: total storage resources, such as 500Gi
  * Persistentvolumeclaims: pvc number
  * .storageclass.storage.k8s.io/requests.storage
  * .storageclass.storage.k8s.io/persistentvolumeclaims
  * Requests.ephemeral-storage and limits.ephemeral-storage (requires v1.8+)
* Object count, meaning the number of creatable objects
  * Pods, replicationcontrollers, configmaps, secrets
  * Resourcequotas, persistentvolumeclaims
  * Services, services.loadbalancers, services.nodeports

Computational resource example:

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute-resources
spec:
  hard:
    pods: "4"
    requests.cpu: "1"
    requests.memory: 1Gi
    limits.cpu: "2"
    limits.memory: 2Gi
```

Object count example:

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: object-counts
spec:
  hard:
    configmaps: "10"
    persistentvolumeclaims: "4"
    replicationcontrollers: "20"
    secrets: "10"
    services: "10"
    services.loadbalancers: "2"
```
## LimitRange

By default, no CPU or memory limits exist for any container in Kubernetes. LimitRange is used to add a resource limit to the Namespace, consisting of minimum, maximum, and default resources. For example,

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: mylimits
spec:
  limits:
  - max:
      cpu: "2"
      memory: 1Gi
    min:
      cpu: 200m
      memory: 6Mi
    type: Pod
  - default:
      cpu: 300m
      memory: 200Mi
    defaultRequest:
      cpu: 200m
      memory: 100Mi
    max:
      cpu: "2"
      memory: 1Gi
    min:
      cpu: 100m
      memory: 3Mi
    type: Container
```

```bash
$ kubectl create -f https://k8s.io/docs/tasks/configure-pod-container/limits.yaml --namespace=limit-example
limitrange "mylimits" created
$ kubectl describe limits mylimits --namespace=limit-example
Name:   mylimits
Namespace:  limit-example
Type        Resource      Min      Max      Default Request      Default Limit      Max Limit/Request Ratio
----        --------      ---      ---      ---------------      -------------      -----------------------
Pod         cpu           200m     2        -                    -                  -
Pod         memory        6Mi      1Gi      -                    -                  -
Container   cpu           100m     2        200m                 300m               -
Container   memory        3Mi      1Gi      100Mi                200Mi              -
```

## Quota Ranges

Several ranges can be specified when creating each quota

| Scope | Description |
| :--- | :--- |
| Terminating | Pod with podSpec.ActiveDeadlineSeconds>=0 |
| NotTerminating | Pod with podSpec.activeDeadlineSeconds=nil |
| BestEffort | Pod where all containers' requests and limits are not set (Best-Effort) |
| NotBestEffort | Opposite of BestEffort |