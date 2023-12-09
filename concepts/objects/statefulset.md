# Making Services Stateful with StatefulSet

StatefulSet is specifically designed to address issues related to stateful services (while Deployments and ReplicaSets cater to stateless services), making it an essential tool when dealing with

* Stable, persistent storage allowing Pods to access the same persistent data even after rescheduling, using Persistent Volumes Claims (PVC) to implement.
* Stable networking IDs, meaning that the PodName and HostName remain unchanged even after a Pod is rescheduled, achieved through Headless Service (a Service without a Cluster IP).
* Sequential Deployment and Scaling, indicating an orderly deployed or scaled Pod, guided by a predefined sequence (from 0 to N-1, where all preceding Pods have to be in Running and Ready status before the next Pod is run), implemented using init containers.
* An ordered scale-down and deletion (from N-1 to 0).

From these application scenarios, we can deduce that a StatefulSet consists of:

* A Headless Service defining a networking ID (DNS domain).
* volumeClaimTemplates used for creating PersistentVolumes.
* The StatefulSet explicitly defining the application.

Each Pod within a StatefulSet follows this DNS format: `statefulSetName-{0..N-1}.serviceName.namespace.svc.cluster.local`, where:

* `serviceName` refers to the name of the Headless Service.
* `0..N-1` is the sequence number of the Pod, starting from 0 and continuing to N-1.
* `statefulSetName` is the name of the StatefulSet.
* `namespace` indicates the namespace where the service resides. The Headless Service and StatefulSet need to be in the same namespace.
* `.cluster.local` is the Cluster Domain.

## API version comparison table

| Kubernetes Version | Deployment Version |
| :--- | :--- |
| v1.5-v1.6 | extensions/v1beta1 |
| v1.7-v1.15 | apps/v1beta1 |
| v1.8-v1.15 | apps/v1beta2 |
| v1.9+ | apps/v1 |

## Simple Example

Let's consider a simple example using an nginx service [web.yaml](https://github.com/feiskyer/kubernetes-handbook/tree/549e0e3c9ba0175e64b2d4719b5a46e9016d532b/concepts/web.txt):

[Code snippet omitted for brevity]

You can perform other operations as well:

```bash
# Scaling up
$ kubectl scale statefulset web --replicas=5

# Scaling down
$ kubectl patch statefulset web -p '{"spec":{"replicas":3}}'

# Image updating (currently, direct image updates are unsupported, patchwork is used to achieve it indirectly)
$ kubectl patch statefulset web --type='json' -p='[{"op":"replace","path":"/spec/template/spec/containers/0/image","value":"gcr.io/google_containers/nginx-slim:0.7"}]'

# Deleting a StatefulSet and Headless Service 
$ kubectl delete statefulset web
$ kubectl delete service nginx

# After the StatefulSet is deleted, the PVC will remain. If the data is no longer needed, it should be removed as well
$ kubectl delete pvc www-web-0 www-web-1
```

## Updating a StatefulSet

From v1.7 and onwards, Kubernetes supports automatic updating of StatefulSets via the `spec.updateStrategy` setting. Currently, two strategies are supported:

* OnDelete: When `.spec.template` is updated, old Pods aren't deleted immediately. Instead, users need to manually delete these old Pods, after which new Pods are automatically created. This is the default update strategy and is compatible with the behavior in versions v1.6 and earlier.
* RollingUpdate: When `.spec.template` is updated, old Pods are automatically deleted, and new Pods are created simultaneously. In the update process, these Pods go through deletion, creation, and stabilization into Ready status one at a time in reverse order, before moving on to the next Pod update.

### Partitions

RollingUpdate also supports Partitions, which can be set using `.spec.updateStrategy.rollingUpdate.partition`. Once partition is set, only Pods with a sequence number equal to or greater than the partition will be rolled out for `.spec.template` updates, while the remaining Pods are left unchanged (even when deleted, they will be recreated using the previous version).

[Example and code snippet omitted for brevity]

## Pod Management Policies

From v1.7 and onwards, you can set the Pod management policy using `.spec.podManagementPolicy`, with two options available:

* OrderedReady: This default policy sequentially creates each Pod and waits for it to be Ready before creating the next one.
* Parallel: Pods are created or deleted simultaneously without waiting for other Pods to reach Ready status before launching all Pods.

### Parallel Example

[Code snippet omitted for brevity]

You can observe that all Pods are created simultaneously.

[Code snippet omitted for brevity]

## Zookeeper

Another example showing the StatefulSet's powerful functions is [zookeeper.yaml](https://github.com/feiskyer/kubernetes-handbook/tree/549e0e3c9ba0175e64b2d4719b5a46e9016d532b/concepts/zookeeper.txt).

[Code snippet omitted for brevity]

```bash
kubectl create -f zookeeper.yaml
```

Detailed usage instructions can be found at the [zookeeper stateful application](https://kubernetes.io/docs/tutorials/stateful-application/zookeeper/) tutorial.

## Caveats for StatefulSets

1. Recommended for use in Kubernetes v1.9 or later.
2. All Pod Volumes must either use PersistentVolumes or be pre-created by an administrator.
3. To ensure data safety, deleting a StatefulSet does not delete the Volumes.
4. A StatefulSet requires a Headless Service to define the DNS domain. This should be created before the StatefulSet.
