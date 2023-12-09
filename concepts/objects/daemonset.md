# DaemonSet

A DaemonSet ensures a specific container copy runs on each Node - a way commonly used to deploy cluster logs, monitors, or other system management applications. Stellar examples include:

* Log collection systems, like fluentd or logstash.
* System monitors such as Prometheus Node Exporter, collectd, New Relic agent, or Ganglia gmond.
* System programs like kube-proxy, kube-dns, glusterd, and ceph.

## API version compatibility

| Kubernetes version | Deployment version |
| :--- | :--- |
| v1.5-v1.6 | extensions/v1beta1 |
| v1.7-v1.15 | apps/v1beta1 |
| v1.8-v1.15 | apps/v1beta2 |
| v1.9+ | apps/v1 |

There's an example of using Fluentd to collect logs:

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluentd-elasticsearch
  namespace: kube-system
  labels:
    k8s-app: fluentd-logging
spec:
  selector:
    matchLabels:
      name: fluentd-elasticsearch
  template:
    metadata:
      labels:
        name: fluentd-elasticsearch
    spec:
      tolerations:
      - key: node-role.kubernetes.io/master
        effect: NoSchedule
      containers:
      - name: fluentd-elasticsearch
        image: gcr.io/google-containers/fluentd-elasticsearch:1.20
        resources:
          limits:
            memory: 200Mi
          requests:
            cpu: 100m
            memory: 200Mi
        volumeMounts:
        - name: varlog
          mountPath: /var/log
        - name: varlibdockercontainers
          mountPath: /var/lib/docker/containers
          readOnly: true
      terminationGracePeriodSeconds: 30
      volumes:
      - name: varlog
        hostPath:
          path: /var/log
      - name: varlibdockercontainers
        hostPath:
          path: /var/lib/docker/containers
```

## Rolling update

From version 1.6 onwards, DaemonSets support rolling updates. You can set your update strategy with `.spec.updateStrategy.type`. Two strategies are currently supported:

* OnDelete: The default strategy. After updating the template, a new Pod will only be created once the old one has been manually deleted.
* RollingUpdate: After the DaemonSet template has been updated, the old Pod is automatically removed and a new one is created.

The RollingUpdate strategy enables you to set:

* `.spec.updateStrategy.rollingUpdate.maxUnavailable`, defaulting to 1
* `spec.minReadySeconds`, defaulting to 0

### Rollback

From version 1.7 onwards, support for rollback is included.

```bash
# Search through historical versions
$ kubectl rollout history daemonset <daemonset-name>

# Search for detailed information of a specific historical version
$ kubectl rollout history daemonset <daemonset-name> --revision=1

# Rollback
$ kubectl rollout undo daemonset <daemonset-name> --to-revision=<revision>
# Search for rollback status
$ kubectl rollout status ds/<daemonset-name>
```

## Specifying Node

DaemonSet ignores a Node's unschedulable status. There are two ways to ensure a Pod only runs on specified Node nodes:

* nodeSelector: Only schedules on Nodes that match the specific label.
* nodeAffinity: A more feature-rich Node selector that, for instance, supports set operations.
* podAffinity: Schedules on the Node where the Pod meeting conditional criteria is located.

### nodeSelector example

First, label the node:

```bash
kubectl label nodes node-01 disktype=ssd
```

Then specify `disktype=ssd` as nodeSelector in DaemonSet:

```yaml
spec:
  nodeSelector:
    disktype: ssd
```

### nodeAffinity example

NodeAffinity currently supports both requiredDuringSchedulingIgnoredDuringExecution and preferredDuringSchedulingIgnoredDuringExecution, which represent mandatory and preferred conditions. The following example represents scheduling on a Node that contains the label `kubernetes.io/e2e-az-name` with a value of e2e-az1 or e2e-az2, and it's preferred the Node also carries the label `another-node-label-key=another-node-label-value`.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: with-node-affinity
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: kubernetes.io/e2e-az-name
            operator: In
            values:
            - e2e-az1
            - e2e-az2
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 1
        preference:
          matchExpressions:
          - key: another-node-label-key
            operator: In
            values:
            - another-node-label-value
  containers:
  - name: with-node-affinity
    image: gcr.io/google_containers/pause:2.0
```

### podAffinity example

PodAffinity selects Nodes based on Pod labels, scheduling only on the Node where the Pod meeting the conditions resides. It supports podAffinity and podAntiAffinity. This feature can be quite convoluted. Take the following example:

* It'll schedule on any "Node that contains at least one running Pod tagged with `security=S1`".
* It improves its chances of not being scheduled on the "Nodes containing at least one running Pod tagged with `security=S2`".

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: with-pod-affinity
spec:
  affinity:
    podAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchExpressions:
          - key: security
            operator: In
            values:
            - S1
        topologyKey: failure-domain.beta.kubernetes.io/zone
    podAntiAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchExpressions:
            - key: security
              operator: In
              values:
              - S2
          topologyKey: kubernetes.io/hostname
  containers:
  - name: with-pod-affinity
    image: gcr.io/google_containers/pause:2.0
```

## Static Pod

Besides using DaemonSet, you can operate specific Pods on each server with Static Pod. This requires the kubelet to specify the manifest directory when launching:

```bash
kubelet --pod-manifest-path=/etc/kubernetes/manifests
```

Then place the needed Pod definition file into the specified manifest directory.

Note: Static Pods cannot be deleted through the API Server. But, you can automate the deletion of the corresponding Pod by eliminating the manifest file.