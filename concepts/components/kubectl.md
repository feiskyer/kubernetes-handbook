# Mastering kubectl

kubectl is the command-line interface (CLI) of Kubernetes, being the essential management tool for Kubernetes users and administrators. 

Instead of listing all of its subcommands, this article will show you how to use it effectively, navigate your way around and look up any assistance you might need. 

* `kubectl -h` for listing subcommands
* `kubectl options` for global options
* `kubectl <command> --help` for assistance with subcommands
* `kubectl [command][PARAMS] -o=<format>` to set your output format, for example json, yaml, jsonpath etc.
* `kubectl explain[RESOURCE]` to display a resource’s definition

## Your first step

The first step in using kubectl is to set up your Kubernetes cluster and its authentication methods, this includes:

* Information about the cluster: the Kubernetes server’s address
* User information: user name, password or key
* Context: a combination of cluster information, user information and namespace 

Here’s an example:

```bash
kubectl config set-credentials myself --username=admin --password=secret
kubectl config set-cluster local-server --server=http://localhost:8080
kubectl config set-context default-context --cluster=local-server --user=myself --namespace=default
kubectl config use-context default-context
kubectl config view
```

## Some common command patterns

* Create: `kubectl run <name> --image=<image>` or `kubectl create -f manifest.yaml`
* Check: `kubectl get <resource>`
* Update: `kubectl set` or `kubectl patch`
* Delete: `kubectl delete <resource> <name>` or `kubectl delete -f manifest.yaml`
* Check a Pod IP: `kubectl get pod <pod-name> -o jsonpath='{.status.podIP}'`
* Execute commands inside a container: `kubectl exec -ti <pod-name> sh`
* Check for a container's logs: `kubectl logs [-f] <pod-name>`
* Share a service: `kubectl expose deploy <name> --port=80`
* Decode from Base64:

```bash
kubectl get secret SECRET -o go-template='{{ .data.KEY | base64decode }}'
```

Take note that `kubectl run` only supports creating resources like Pod, Replication Controller, Deployment, Job and CronJob. Specifying which resources are created depends on which parameters you pass, by default, it's a Deployment:

| Resource type | Parameter |
| :--- | :--- |
| Pod | `--restart=Never` |
| Replication Controller | `--generator=run/v1` |
| Deployment | `--restart=Always` |
| Job | `--restart=OnFailure` |
| CronJob | `--schedule=<cron>` |

## Command-line auto-completion

For Linux systems:

```bash
source /usr/share/bash-completion/bash_completion
source <(kubectl completion bash)
```

For MacOS:

```bash
source <(kubectl completion zsh)
```

## Customized output columns

Say, you want to check requests or limits for resources for all Pods:

```bash
kubectl get pods --all-namespaces -o custom-columns=NS:.metadata.namespace,NAME:.metadata.name,"CPU(requests)":.spec.containers[*].resources.requests.cpu,"CPU(limits)":.spec.containers[*].resources.limits.cpu,"MEMORY(requests)":.spec.containers[*].resources.requests.memory,"MEMORY(limits)":.spec.containers[*].resources.limits.memory
```

## Checking Logs

`kubectl logs` are for displaying content output from programs running inside a container. It’s similar to Docker's logs command.

```bash
# Return snapshot logs from pod nginx with only one container
kubectl logs nginx

# Return snapshot of previous terminated ruby container logs from pod web-1
kubectl logs -p -c ruby web-1

# Begin streaming the logs of the ruby container in pod web-1
kubectl logs -f -c ruby web-1
```

> Note: kubectl can only check logs for individual containers. If you want to check logs for multiple pods simultaneously, you can use [stern](https://github.com/wercker/stern). For example: `stern --all-namespaces -l run=nginx`.

## Connect to a Running Container

`kubectl attach` is used to connect to a running container. It's similar to Docker's attach command.

```bash
  # Get output from running pod 123456-7890, using the first container by default
  kubectl attach 123456-7890

  # Get output from ruby-container from pod 123456-7890
  kubectl attach 123456-7890 -c ruby-container

  # Switch to raw terminal mode, sends stdin to 'bash' in ruby-container from pod 123456-7890
  # and sends stdout/stderr from 'bash' back to the client
  kubectl attach 123456-7890 -c ruby-container -i -t

Options:
  -c, --container='': Container name. If omitted, the first container in the pod will be chosen
  -i, --stdin=false: Pass stdin to the container
  -t, --tty=false: Stdin is a TTY
```

## Execute Commands Inside a Container

`kubectl exec` is used to execute commands inside a running container. It's similar to Docker's exec command.

> Note: For multiple-container Pods, the default container for kubectl commands can be set by kubectl.kubernetes.io/default-container annotation

```bash
  # Get output from running 'date' from pod 123456-7890, using the first container by default
  kubectl exec 123456-7890 date

  # Get output from running 'date' in ruby-container from pod 123456-7890
  kubectl exec 123456-7890 -c ruby-container date

  # Switch to raw terminal mode, sends stdin to 'bash' in ruby-container from pod 123456-7890
  # and sends stdout/stderr from 'bash' back to the client
  kubectl exec 123456-7890 -c ruby-container -i -t -- bash -il

Options:
  -c, --container='': Container name. If omitted, the first container in the pod will be chosen
  -p, --pod='': Pod name
  -i, --stdin=false: Pass stdin to the container
  -t, --tty=false: Stdin is a TTY
```

## Port Forwarding

`kubectl port-forward` is used to forward a local port to a specified Pod.

```bash
# Listen on ports 5000 and 6000 locally, forwarding data to/from ports 5000 and 6000 in the pod
kubectl port-forward mypod 5000 6000

# Listen on port 8888 locally, forwarding to 5000 in the pod
kubectl port-forward mypod 8888:5000

# Listen on a random port locally, forwarding to 5000 in the pod
kubectl port-forward mypod :5000

# Listen on a random port locally, forwarding to 5000 in the pod
kubectl port-forward mypod 0:5000
```

Also, local ports can be forwarded to services, replica sets or deployments.

```bash
# Forward to deployment
kubectl port-forward deployment/redis-master 6379:6379

# Forward to replicaSet
kubectl port-forward rs/redis-master 6379:6379

# Forward to service
kubectl port-forward svc/redis-master 6379:6379
```

## API Server Proxy

The `kubectl proxy` command creates an HTTP proxy to service Kubernetes APIs.

```bash
$ kubectl proxy --port=8080
Starting to serve on 127.0.0.1:8080
```

Direct access to the Kubernetes API through the proxy address `http://localhost:8080/api/` can be achieved. A list of pods can be retrieved, for example:

```bash
curl http://localhost:8080/api/v1/namespaces/default/pods
```

If accessing port 8080 from a non-localhost address specified by `--address`, an unauthorized error will be received. To rectify this (recommended for non-production environments) the setting `--accept-hosts` can be adjusted:

```bash
kubectl proxy --address='0.0.0.0' --port=8080 --accept-hosts='^*$'
```

## Copying Files

`kubectl cp` enables you to copy from a container or to copy files into a container.

```bash
  # Copy a local directory /tmp/foo_dir to a /tmp/bar_dir in a remote pod
  kubectl cp /tmp/foo_dir <some-pod>:/tmp/bar_dir

  # Copy a local file /tmp/foo to /tmp/bar in a remote pod in a specific container
  kubectl cp /tmp/foo <some-pod>:/tmp/bar -c <specific-container>

  # Copy local file /tmp/foo to a remote pod /tmp/bar in namespace <some-namespace>
  kubectl cp /tmp/foo <some-namespace>/<some-pod>:/tmp/bar

  # Copy /tmp/foo from a remote pod to /tmp/bar locally
  kubectl cp <some-namespace>/<some-pod>:/tmp/foo /tmp/bar

Options:
  -c, --container='': Container name. If omitted, the first container in the pod will be chosen
```

Note that file copying depends on the tar command, so the tar command must be executable within the container.

## Node Draining with kubectl Drain

```bash
kubectl drain NODE [Options]
```

* Deletes pods on that NODE created by ReplicationController, ReplicaSet, DaemonSet, StatefulSet or Job
* Doesn't delete mirror pods (since they can't be deleted through the API)
* If there are other types of Pods (for e.g., directly created by kubectl create), if --force option isn't present, the command fails
* If --force option is included in the command, it will delete Pods that were not created by ReplicationController, Job or DaemonSet 

Sometimes radical solutions like evicting pods is unnecessary. If you just need to make the Node not callable, you can use the `kubectl cordon` command.

To reset, just type `kubectl uncordon NODE` to make the NODE schedulable again.

## Permissions Check

The `kubectl auth` provides two subcommands for checking a user's authorization status:

* `kubectl auth can-i` checks whether a user has permission to perform certain operations:

```bash
  # Check to see if I can create pods in any namespace
  kubectl auth can-i create pods --all-namespaces

  # Check to see if I can list deployments in my current namespace
  kubectl auth can-i list deployments.extensions

  # Check to see if I can do everything in my current namespace ("*" means all)
  kubectl auth can-i '*' '*'

  # Check to see if I can get the job named "bar" in namespace "foo"
  kubectl auth can-i list jobs.batch/bar -n foo
```

* `kubectl auth reconcile` automatically fixes problematic RBAC policies:

```bash
  # Reconcile rbac resources from a file
  kubectl auth reconcile -f my-rbac-rules.yaml
```

## Simulating Other Users

kubectl supports you to simulate other users or groups for cluster management operations:

```bash
kubectl drain mynode --as=superman --as-group=system:masters
```

This is equivalent to adding following HTTP HEADER when requesting Kubernetes API:

```bash
Impersonate-User: superman
Impersonate-Group: system:masters
```

## Event Inspection

```bash
# Check all events
kubectl get events --all-namespaces

# Check events for objects named nginx
kubectl get events --field-selector involvedObject.name=nginx,involvedObject.namespace=default

# Check service events for nginx
kubectl get events --field-selector involvedObject.name=nginx,involvedObject.namespace=default,involvedObject.kind=Service

# Check events for a Pod
kubectl get events --field-selector involvedObject.name=nginx-85cb5867f-bs7pn,involvedObject.kind=Pod

# Sort events by time
kubectl get events --sort-by=.metadata.creationTimestamp

# Customize events output format
kubectl get events  --sort-by='.metadata.creationTimestamp'  -o 'go-template={{range .items}}{{.involvedObject.name}}{{"\t"}}{{.involvedObject.kind}}{{"\t"}}{{.message}}{{"\t"}}{{.reason}}{{"\t"}}{{.type}}{{"\t"}}{{.firstTimestamp}}{{"\n"}}{{end}}'
```

## kubectl Plugins

The kubectl plugin provides a mechanism to extend kubectl, such as adding new subcommands. The plugin can be written in any language as long as it meets the following criteria:

* The plugin resides in `~/.kube/plugins` or a directory specified by the `KUBECTL_PLUGINS_PATH` environment variable
* The format of the plugin is 'subdirectory / executable file or script' and the subdirectory must contain a `plugin.yaml` configuration file. 

For example:

```bash
$ tree
.
└── hello
    └── plugin.yaml

1 directory, 1 file

$ cat hello/plugin.yaml
name: "hello"
shortDesc: "Hello kubectl plugin!"
command: "echo Hello plugins!"

$ kubectl plugin hello
Hello plugins!
```

You can also use [krew](../../setup/kubectl.md) to manage your kubectl plugins.

## Raw URIs

kubectl can also be used to directly access raw URIs. For example, you can access the [Metrics API](https://github.com/kubernetes-incubator/metrics-server):

* `kubectl get --raw /apis/metrics.k8s.io/v1beta1/nodes`
* `kubectl get --raw /apis/metrics.k8s.io/v1beta1/pods`
* `kubectl get --raw /apis/metrics.k8s.io/v1beta1/nodes/<node-name>`
* `kubectl get --raw /apis/metrics.k8s.io/v1beta1/namespaces/<namespace-name>/pods/<pod-name>`

## Appendix

The Kubectl Installation

```bash
# OS X
curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/darwin/amd64/kubectl

# Linux
curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/amd64/kubectl

# Windows
curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/windows/amd64/kubectl.exe
```