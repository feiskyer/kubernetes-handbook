# Node

A Node is the actual host where a Pod runs. This could be a physical or a virtual machine. For Pod management, each Node must at least run a container runtime (like `docker` or `rkt`), `kubelet`, and the `kube-proxy` service.

![node](../../.gitbook/assets/node%20%284%29.png)

## Managing Nodes

Unlike other resources such as Pods and Namespace, Kubernetes doesn't create a Node. It only manages resources on a Node. Although you can create a Node object using a Manifest (as shown in the yaml below), Kubernetes merely checks if such a Node indeed exists. If the check fails, Pod scheduling doesn't proceed.

```yaml
kind: Node
apiVersion: v1
metadata:
  name: 10-240-79-157
  labels:
    name: my-first-k8s-node
```

The Node Controller conducts this check. The Node Controller is responsible for:

* Maintaining Node status
* Synchronizing Node with Cloud Provider
* Assigning container CIDR to Node
* Deleting Pods on the Node with `NoExecute` taint

By default, kubelet registers itself with the master during startup and creates the Node resource.

## Node Status

Each Node includes the following status information:

* Address: Including hostname, public IP, and private IP
* Conditions: They include OutOfDisk, Ready, MemoryPressure, and DiskPressure
* Capacity: Available resources on the Node, including CPU, memory, and the total number of Pods
* Info: It includes kernel version, container engine version, OS type, etc.

## Taints and Tolerations

Taints and Tolerations ensure Pods are not scheduled on inappropriate Nodes. Taint is applied to a Node, and toleration is applied to a Pod (Toleration is optional).

For example, you can use the taint command to add taints to node1:

```bash
kubectl taint nodes node1 key1=value1:NoSchedule
kubectl taint nodes node1 key1=value2:NoExecute
```
For the specific usage of Taints and Tolerations, please refer to the [scheduler section](../components/scheduler.md#Taints%20and%20tolerations).

## Node Maintenance Mode

Marking a Node as unschedulable does not affect the Pods running on it. This feature is very useful when maintaining a Node:

```bash
kubectl cordon $NODENAME
```

## Graceful Node Shutdown

When `ShutdownGracePeriod` and `ShutdownGracePeriodCriticalPods` are configured, Kubelet will detect Node shutdown status based on systemd events, and automatically terminate the running Pods on it (ShutdownGracePeriodCriticalPods needs to be less than ShutdownGracePeriod). Note, both parameters are configured as 0 by default, which means the graceful shutdown feature is off by default.

For example, if ShutdownGracePeriod is set to 30s, and ShutdownGracePeriodCriticalPods is set to 10s, the Kubelet delays the Node shutdown by 30 seconds. During the shutdown, the first 20 (30-10) seconds are reserved to terminate regular Pods, while the last 10 seconds are saved to terminate critical Pods.

## Forced Node Shutdown

In circumstances where the Node experiences an anomaly, Kubelet may not have a chance to detect and perform a graceful shutdown. In such scenarios, StatefulSet cannot create a new Pod with the same name, if the Pod uses a volume, then VolumeAttachments will not be deleted from the original shutdown Node, hence these Pods' volumes are unable to be mounted on new running Nodes.

Forced Node shutdown is specially designed to solve these problems. Users can manually add `node.kubernetes.io/out-of-service` taint to a Node with `NoExecute` or `NoSchedule` effect, marking it as incapable of providing services. If the `NodeOutOfServiceVolumeDetach` feature is enabled on kube-controller-manager, and respective toleration is not set on Pods, these Pods will be forcibly deleted and volume detachment operation will immediately proceed for terminated Pods on that Node. As a result, Pods that were on incapable Nodes can quickly recover on other Nodes.

## References

* [Kubernetes Node](https://kubernetes.io/docs/concepts/architecture/nodes/)
* [Taints and Tolerations](https://kubernetes.io/docs/concepts/configuration/assign-pod-node/#taints-and-tolerations-beta-feature)