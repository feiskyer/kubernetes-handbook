# Troubleshooting Pods

This chapter is about pods troubleshooting, which are applications deployed into Kubernetes.

Usually, no matter which errors are you run into, the first step is getting pod's current state and its logs

```sh
kubectl describe pod <pod-name>
kubectl logs <pod-name>
```

The pod events and its logs are usually helpful to identify the issue.

## Pod stuck in Pending

Pending state indicates the Pod hasn't been scheduled yet. Check pod events and they will show you why the pod is not scheduled.

```sh
$ kubectl describe pod mypod
...
Events:
  Type     Reason            Age                From               Message
  ----     ------            ----               ----               -------
  Warning  FailedScheduling  12s (x6 over 27s)  default-scheduler  0/4 nodes are available: 2 Insufficient cpu.
```

Generally this is because there are insufficient resources of one type or another that prevent scheduling. An incomplete list of things that could go wrong includes

- Cluster doesn't have enough resources, e.g. CPU, memory or GPU. You need to adjust pod's resource request or add new nodes to cluster
- Pod requests more resources than node's capacity. You need to adjust pod's resource request or add larger nodes with more resources to cluster
- Pod is using hostPort, but the port is already been taken by other services. Try using a Service if you're in such scenario

## Pod stuck in Waiting or ContainerCreating

In such case, Pod has been scheduled to a worker node, but it can't run on that machine.

Again, get information from `kubectl describe pod <pod-name>` and check what's wrong.

```sh
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

So the sandbox for this Pod isn't able to start. Let's check kubelet's logs for detailed reasons:

```sh
$ journalctl -u kubelet
...
Mar 14 04:22:04 node1 kubelet[29801]: E0314 04:22:04.649912   29801 cni.go:294] Error adding network: failed to set bridge addr: "cni0" already has an IP address different from 10.244.4.1/24
Mar 14 04:22:04 node1 kubelet[29801]: E0314 04:22:04.649941   29801 cni.go:243] Error while adding to cni network: failed to set bridge addr: "cni0" already has an IP address different from 10.244.4.1/24
Mar 14 04:22:04 node1 kubelet[29801]: W0314 04:22:04.891337   29801 cni.go:258] CNI failed to retrieve network namespace path: Cannot find network namespace for the terminated container "c4fd616cde0e7052c240173541b8543f746e75c17744872aa04fe06f52b5141c"
Mar 14 04:22:05 node1 kubelet[29801]: E0314 04:22:05.965801   29801 remote_runtime.go:91] RunPodSandbox from runtime service failed: rpc error: code = 2 desc = NetworkPlugin cni failed to set up pod "nginx-pod" network: failed to set bridge addr: "cni0" already has an IP address different from 10.244.4.1/24
```

Now we know "cni0" bridge has been configured an unexpected IP address. A simplest way to fix this issue is deleting the "cni0" bridge (network plugin will recreate it when required):

```sh
$ ip link set cni0 down
$ brctl delbr cni0        #ip link delete cni0 type bridge(in case if you can't bring down the bridge)
```

Above is an example of network configuration issue. There are also many other things may go wrong. An incomplete list of them includes

- Failed to pull image, e.g.
  - image name is wrong
  - registry is not accessible
  - image hasn't been pushed to registry
  - docker secret is wrong or not configured for secret image
  - timeout because of big size (adjusting kubelet  `--image-pull-progress-deadline` and `--runtime-request-timeout` could help for this case)
- Network setup error for pod's sandbox, e.g.
  - can't setup network for pod's netns because of CNI configure error
  - can't allocate IP address because exhausted podCIDR
- Failed to start container, e.g.
  - cmd or args configure error
  - image itself contains wrong binary

## Pod stuck in ImagePullBackOff

`ImagePullBackOff` means image can't be pulled by a few times of retries. It could be caused by wrong image name or incorrect docker secret. In such case, `docker pull <image>` could be used to verify whether the image is correct.

```sh
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

For private images, a docker registry secret should be created

```sh
kubectl create secret docker-registry my-secret --docker-server=DOCKER_REGISTRY_SERVER --docker-username=DOCKER_USER --docker-password=DOCKER_PASSWORD --docker-email=DOCKER_EMAIL
```

and then refer the secret in container's spec:

```yaml
spec:
  containers:
  - name: private-reg-container
    image: <your-private-image>
  imagePullSecrets:
  - name: my-secret
```

## Pod stuck in CrashLoopBackOff

In such case, Pod has been started and then exited abnormally (its restartCount should be > 0). Take a look at the container logs

```sh
kubectl describe pod <pod-name>
kubectl logs <pod-name>
```

If your container has previously crashed, you can access the previous container’s crash log with:

```sh
kubectl logs --previous <pod-name>
```

From container logs, we may find the reason of crashing, e.g.

- Container process exited
- Health check failed
- OOMKilled

```sh
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

Alternately, you can run commands inside that container with `exec`:

```sh
kubectl exec cassandra -- cat /var/log/cassandra/system.log
```

If none of these approaches work, SSH to Pod's host and check kubelet or docker's logs. The host running the Pod could be found by running:

```sh
# Query Node
kubectl get pod <pod-name> -o wide

# SSH to Node
ssh <username>@<node-name>
```

## Pod stuck in Error

In such case, Pod has been scheduled but failed to start. Again, get information from `kubectl describe pod <pod-name>` and check what's wrong. Reasons include:

- referring non-exist ConfigMap, Secret or PV
- exceeding resource limits (e.g. LimitRange)
- violating PodSecurityPolicy
- not authorized to cluster resources (e.g. with RBAC enabled, rolebinding should be created for service account)

## Pod stuck in Terminating or Unknown

From v1.5, kube-controller-manager won't delete Pods because of Node unready. Instead, those Pods are marked with Terminating or Unknown status. If you are sure those Pods are not wanted any more, then there are three ways to delete them permanently

- Delete the node from cluster, e.g. `kubectl delete node <node-name>`. If you are running with a cloud provider, node should be removed automatically after the VM is deleted from cloud provider.
- Recover the node. After kubelet restarts, it will check Pods status with kube-apiserver and restarts or deletes those Pods.
- Force delete the Pods, e.g. `kubectl delete pods <pod> --grace-period=0 --force`. This way is not recommended, unless you know what you are doing. For Pods belonging to StatefulSet, deleting forcibly may result in data loss or split-brain problem.

For kubelet run in Docker containers, [an UnmountVolume.TearDown failed error](https://github.com/kubernetes/kubernetes/issues/51835) may be found in kubelet logs:

```json
{"log":"I0926 19:59:07.162477   54420 kubelet.go:1894] SyncLoop (DELETE, \"api\"): \"billcenter-737844550-26z3w_meipu(30f3ffec-a29f-11e7-b693-246e9607517c)\"\n","stream":"stderr","time":"2017-09-26T11:59:07.162748656Z"}
{"log":"I0926 19:59:39.977126   54420 reconciler.go:186] operationExecutor.UnmountVolume started for volume \"default-token-6tpnm\" (UniqueName: \"kubernetes.io/secret/30f3ffec-a29f-11e7-b693-246e9607517c-default-token-6tpnm\") pod \"30f3ffec-a29f-11e7-b693-246e9607517c\" (UID: \"30f3ffec-a29f-11e7-b693-246e9607517c\") \n","stream":"stderr","time":"2017-09-26T11:59:39.977438174Z"}
{"log":"E0926 19:59:39.977461   54420 nestedpendingoperations.go:262] Operation for \"\\\"kubernetes.io/secret/30f3ffec-a29f-11e7-b693-246e9607517c-default-token-6tpnm\\\" (\\\"30f3ffec-a29f-11e7-b693-246e9607517c\\\")\" failed. No retries permitted until 2017-09-26 19:59:41.977419403 +0800 CST (durationBeforeRetry 2s). Error: UnmountVolume.TearDown failed for volume \"default-token-6tpnm\" (UniqueName: \"kubernetes.io/secret/30f3ffec-a29f-11e7-b693-246e9607517c-default-token-6tpnm\") pod \"30f3ffec-a29f-11e7-b693-246e9607517c\" (UID: \"30f3ffec-a29f-11e7-b693-246e9607517c\") : remove /var/lib/kubelet/pods/30f3ffec-a29f-11e7-b693-246e9607517c/volumes/kubernetes.io~secret/default-token-6tpnm: device or resource busy\n","stream":"stderr","time":"2017-09-26T11:59:39.977728079Z"}
```

In such case, kubelet should be configured with option `--containerized` and its running container should be run with volumes:

```sh
# Take calico plugin as an example
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

Pods in `Terminating` state should be removed after Kubelet recovery. But sometimes, the Pods may not be deleted automatically and even force deletion (`kubectl delete pods <pod> --grace-period=0 --force`) doesn't work. In such case, `finalizers` is probably the cause and remove it with `kubelet edit` could mitigate the problem.

```yaml
"finalizers": [
  "foregroundDeletion"
]
```

## Pod is running but not doing what it should do

If the pod has been running but not behaving as you expected, there may be errors in your pod description. Often a section of the pod description is nested incorrectly, or a key name is typed incorrectly, and so the key is ignored.

Try to recreate the pod with `--validate` option:

```sh
kubectl delete pod mypod
kubectl create --validate -f mypod.yaml
```

or check whether created pod is expected by getting its description back:

```sh
kubectl get pod mypod -o yaml
```

## Static Pod not recreated after manifest changed

Kubelet monitors changes under `/etc/kubernetes/manifests`  (configured by kubelet's `--pod-manifest-path` option) directory by inotify. There is possible kubelet missed some events, which results in static Pod not recreated automatically. Restart kubelet should solve the problem.

## References

- [Troubleshoot Applications](https://kubernetes.io/docs/tasks/debug-application-cluster/debug-application/)
