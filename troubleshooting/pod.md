# Troubleshooting Pods

This chapter discusses methods for troubleshooting Pod issues.

Generally, regardless of the error state of the Pod, the following commands can execute to check the Pod's status:

* `kubectl get pod <pod-name> -o yaml` to check if the Pod's configuration is correct
* `kubectl describe pod <pod-name>` to review the Pod's events
* `kubectl logs <pod-name> [-c <container-name>]` to review the container logs

These events and logs typically assist in diagnosing issues with the Pod.

## Pods Perpetually in 'Pending' State

'Pending' state indicates that the Pod has not been scheduled on any Node yet. Execute `kubectl describe pod <pod-name>` to check the current Pod's events, in order to discern why it has not been scheduled. For instance:

```bash
$ kubectl describe pod mypod
...
Events:
  Type     Reason            Age                From               Message
  ----     ------            ----               ----               -------
  Warning  FailedScheduling  12s (x6 over 27s)  default-scheduler  0/4 nodes are available: 2 Insufficient cpu.
```

Potential causes include:

* Insufficient resources: all Nodes in the cluster that do not meet the CPU, memory, GPU, or temporary storage space resources requested by the Pod. The solution is to delete unused Pods in the cluster or add new Nodes.
* The HostPort port is occupied. It is generally recommended to use the Service to expose the service port externally.

## Pods Perpetually in 'Waiting' or 'ContainerCreating' State

Start by looking at the current Pod's events using `kubectl describe pod <pod-name>`

```bash
$ kubectl -n kube-system describe pod nginx-pod
Events:
  Type     Reason                 Age               From               Message
  ----     ------                 ----              ----               -------
  Normal   Scheduled              1m                default-scheduler  Successfully assigned nginx-pod to node1
  Normal   SuccessfulMountVolume  1m                kubelet, gpu13     MountVolume.SetUp succeeded for volume "config-volume"
  Normal   SuccessfulMountVolume  1m                kubelet, gpu13     MountVolume.SetUp succeeded for volume "coredns-token-sxdmc"
  Warning  FailedSync             2s (x4 over 46s)  kubelet, gpu13     Error syncing pod
  Normal   SandboxChanged         1s (x4 over 46s)  kubelet, gpu13     Pod sandbox changed, it will be killed and re-created.
```

As can be seen, the Sandbox container for the Pod cannot start normally. The specific reason requires checking the Kubelet logs:

```bash
$ journalctl -u kubelet
...
Mar 14 04:22:04 node1 kubelet[29801]: E0314 04:22:04.649912   29801 cni.go:294] Error adding network: failed to set bridge addr: "cni0" already has an IP address different from 10.244.4.1/24
Mar 14 04:22:04 node1 kubelet[29801]: E0314 04:22:04.649941   29801 cni.go:243] Error while adding to cni network: failed to set bridge addr: "cni0" already has an IP address different from 10.244.4.1/24
Mar 14 04:22:04 node1 kubelet[29801]: W0314 04:22:04.891337   29801 cni.go:258] CNI failed to retrieve network namespace path: Cannot find network namespace for the terminated container "c4fd616cde0e7052c240173541b8543f746e75c17744872aa04fe06f52b5141c"
Mar 14 04:22:05 node1 kubelet[29801]: E0314 04:22:05.965801   29801 remote_runtime.go:91] RunPodSandbox from runtime service failed: rpc error: code = 2 desc = NetworkPlugin cni failed to set up pod "nginx-pod" network: failed to set bridge addr: "cni0" already has an IP address different from 10.244.4.1/24
```

From the logs, it's determined that the issue is due to cni0 bridge configured with an IP address from a different network segment. Deleting the bridge (the network plugin will automatically recreate it) fixes the issue.

```bash
$ ip link set cni0 down
$ brctl delbr cni0
```

Other possible causes include:

* Image pull failure, for example,
  * Misconfigured images
  * Kubelet cannot access the image (specific workaround needed for China's environment to access `gcr.io`)
  * Misconfigured keys for a private image
  * The image is too large, causing a timeout (you can appropriately adjust the kubelet’s `--image-pull-progress-deadline` and `--runtime-request-timeout` options)
* CNI network error, requiring a check and possibly adjustment for CNI network plugin’s configuration, for example,
  * Unable to configure the Pod network
  * Unable to assign IP address
* The container cannot start, check whether the correct image has been packaged or the correct container parameters have been configured

## Pods in 'ImagePullBackOff' State

Pods in this state typically indicate a configuration error with the image name or a misconfiguration with the private image's key. In such cases, use `docker pull <image>` to test whether the image can be pulled correctly.

```bash
$ kubectl describe pod mypod
...
Events:
  Type     Reason                 Age                From                                Message
  ----     ------                 ----               ----                                -------
  Normal   Scheduled              36s                default-scheduler                   Successfully assigned sh to k8s-agentpool1-38622806-0
  Normal   SuccessfulMountVolume  35s                kubelet, k8s-agentpool1-38622806-0  MountVolume.SetUp succeeded for volume "default-token-n4pn6"
  Normal   Pulling                17s (x2 over 33s)  kubelet, k8s-agentpool1-38622806-0  pulling image "a1pine"
  Warning  Failed                 14s (x2 over 29s)  kubelet, k8s-agentpool1-38622806-0  Failed to pull image "a1pine": rpc error: code = Unknown desc = Error response from daemon: repository a1pine not found: does not exist or no pull access
  Warning  Failed                 14s (x2 over 29s)  kubelet, k8s-agentpool1-38622806-0  Error: ErrImagePull
  Normal   SandboxChanged         4s (x7 over 28s)   kubelet, k8s-agentpool1-38622806-0  Pod sandbox changed, it will be killed and re-created.
  Normal   BackOff                4s (x5 over 25s)   kubelet, k8s-agentpool1-38622806-0  Back-off pulling image "a1pine"
  Warning  Failed                 1s (x6 over 25s)   kubelet, k8s-agentpool1-38622806-0  Error: ImagePullBackOff
```

If the image is private, a docker-registry type Secret needs to be created first:

```bash
kubectl create secret docker-registry my-secret --docker-server=DOCKER_REGISTRY_SERVER --docker-username=DOCKER_USER --docker-password=DOCKER_PASSWORD --docker-email=DOCKER_EMAIL
```

Then link this Secret in the container:

```yaml
spec:
  containers:
  - name: private-reg-container
    image: <your-private-image>
  imagePullSecrets:
  - name: my-secret
```

## Pods Keep Crashing (CrashLoopBackOff State)

The CrashLoopBackOff state means that the container did indeed start, but then it exited abnormally. At this point, the RestartCounts for the Pod is typically greater than 0, and you may want to consider checking the container logs:

```bash
kubectl describe pod <pod-name>
kubectl logs <pod-name>
kubectl logs --previous <pod-name>
```

From here, there may be some insights as to why the container exited, such as:

* Container process exiting
* Health check failure
* OOMKilled (Out of Memory)

```bash
$ kubectl describe pod mypod
...
Containers:
  sh:
    Container ID:  docker://3f7a2ee0e7e0e16c22090a25f9b6e42b5c06ec049405bc34d3aa183060eb4906
    Image:         alpine
    Image ID:      docker-pullable://alpine@sha256:7b848083f93822dd21b0a2f14a110bd99f6efb4b838d499df6d04a49d0debf8b
    Port:          <none>
    Host Port:     <none>
    State:          Terminated
      Reason:       OOMKilled
      Exit Code:    2
    Last State:     Terminated
      Reason:       OOMKilled
      Exit Code:    2
    Ready:          False
    Restart Count:  3
    Limits:
      cpu:     1
      memory:  1G
    Requests:
      cpu:        100m
      memory:     500M
...
```

If clues are still lacking, you can further investigate the reasons for exiting by executing commands inside the container:

```bash
kubectl exec cassandra -- cat /var/log/cassandra/system.log
```

If no hints are still found, SSH login to the Node where the Pod is located is advised, to further delve into Kubelet or Docker logs:

```bash
# Query Node
kubectl get pod <pod-name> -o wide

# SSH to Node
ssh <username>@<node-name>
```

## Pods in 'Error' State

Typically, when in the 'Error' state, it indicates that an error occurred during the Pod startup process. Common causes include:

* Dependencies such as ConfigMap, Secret, or PV do not exist
* Requested resources exceed the limitations set by the administrator, such as exceeding LimitRange, etc.
* Violation of the cluster's security policy, such as PodSecurityPolicy, etc.
* The container does not have the authority to operate resources within the cluster, for instance, after opening RBAC, role binding needs to be configured for ServiceAccount

## Pods in 'Terminating' or 'Unknown' State

From version v1.5 onwards, Kubernetes will no longer delete Pods running on its own due to Node failure, instead, it marks them as 'Terminating' or 'Unknown'. There are three methods to delete Pods in these states:

* Remove the Node of concern from the cluster. When using public clouds, kube-controller-manager will automatically delete the corresponding Node after the VM is deleted. For clusters deployed on physical machines, administrators will need to manually delete the Node (`kubectl delete node <node-name>`).
* Node recovery. Kubelet will communicate with kube-apiserver to determine the expected state of these Pods, and then decide to delete or continue running these Pods.
* Forced deletion by the user. The user can execute `kubectl delete pods <pod> --grace-period=0 --force` to forcefully delete the Pod. Unless it is clear that the Pod is indeed in a stopped state (such as when the VM or physical machine where the Node is located has been shut down), this method is not recommended. Especially for Pods managed by StatefulSet, forced deletion can easily lead to problems such as split-brain or data loss.

If Kubelet runs in the form of a Docker container, you may find the following error in the kubelet logs:

```javascript
{"log":"I0926 19:59:07.162477   54420 kubelet.go:1894] SyncLoop (DELETE, \"api\"): \"billcenter-737844550-26z3w_meipu(30f3ffec-a29f-11e7-b693-246e9607517c)\"\n","stream":"stderr","time":"2017-09-26T11:59:07.162748656Z"}
{"log":"I0926 19:59:39.977126   54420 reconciler.go:186] operationExecutor.UnmountVolume started for volume \"default-token-6tpnm\" (UniqueName: \"kubernetes.io/secret/30f3ffec-a29f-11e7-b693-246e9607517c-default-token-6tpnm\") pod \"30f3ffec-a29f-11e7-b693-246e9607517c\" (UID: \"30f3ffec-a29f-11e7-b693-246e9607517c\") \n","stream":"stderr","time":"2017-09-26T11:59:39.977438174Z"}
{"log":"E0926 19:59:39.977461   54420 nestedpendingoperations.go:262] Operation for \"\\\"kubernetes.io/secret/30f3ffec-a29f-11e7-b693-246e9607517c-default-token-6tpnm\\\" (\\\"30f3ffec-a29f-11e7-b693-246e9607517c\\\")\" failed. No retries permitted until 2017-09-26 19:59:41.977419403 +0800 CST (durationBeforeRetry 2s). Error: UnmountVolume.TearDown failed for volume \"default-token-6tpnm\" (UniqueName: \"kubernetes.io/secret/30f3ffec-a29f-11e7-b693-246e9607517c-default-token-6tpnm\") pod \"30f3ffec-a29f-11e7-b693-246e9607517c\" (UID: \"30f3ffec-a29f-11e7-b693-246e9607517c\") : remove /var/lib/kubelet/pods/30f3ffec-a29f-11e7-b693-246e9607517c/volumes/kubernetes.io~secret/default-token-6tpnm: device or resource busy\n","stream":"stderr","time":"2017-09-26T11:59:39.977728079Z"}
```

For this scenario, set the `--containerized` parameter for the kubelet container and pass in the following volumes:

```bash
#  Example using calico network plugin
      -v /:/rootfs:ro,shared \
      -v /sys:/sys:ro \
      -v /dev:/dev:rw \
      -v /var/log:/var/log:rw \
      -v /run/calico/:/run/calico/:rw \
      -v /run/docker/:/run/docker/:rw \
      -v /run/docker.sock:/run/docker.sock:rw \
      -v /usr/lib/os-release:/etc/os-release \
      -v /usr/share/ca-certificates/:/etc/ssl/certs \
      -v /var/lib/docker/:/var/lib/docker:rw,shared \
      -v /var/lib/kubelet/:/var/lib/kubelet:rw,shared \
      -v /etc/kubernetes/ssl/:/etc/kubernetes/ssl/ \
      -v /etc/kubernetes/config/:/etc/kubernetes/config/ \
      -v /etc/cni/net.d/:/etc/cni/net.d/ \
      -v /opt/cni/bin/:/opt/cni/bin/ \
```

Pods in the `Terminating` state are usually automatically deleted after Kubelet resumes normal operation. However, sometimes there may be situations where they cannot be deleted and forcing deletion using `kubectl delete pods <pod> --grace-period=0 --force` does not work either. In this case, it is generally caused by `finalizers`, and deleting the finalizers through `kubectl edit` can resolve the issue.

```yaml
"finalizers": [
  "foregroundDeletion"
]
```

## Pod troubleshooting diagram

![img](../.gitbook/assets/f65ffe9f61de0f4a417f7a05306edd4c.png)

\(From [A visual guide on troubleshooting Kubernetes deployments](https://learnk8s.io/troubleshooting-deployments)）

## References

* [Troubleshoot Applications](https://kubernetes.io/docs/tasks/debug-application-cluster/debug-application/)
