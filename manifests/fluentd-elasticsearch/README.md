# EFK

Do not forget to label nodes first:

```sh
kubectl label nodes --all beta.kubernetes.io/fluentd-ds-ready=true
```

Then deploy EFK

```
kubectl apply -f .
```

## Basic Auth

Replace secret with following command:

```sh
$ kubectl -n kube-system delete secret basic-auth
$ htpasswd -c auth foo
$ kubectl -n kube-system create secret generic basic-auth --from-file=auth
```

## Maximum map count

To use mmap effectively, Elasticsearch requires the ability to create many memory-mapped areas. The maximum map count check checks that the kernel allows a process to have at least 262,144 memory-mapped areas and is enforced on Linux only. To pass the maximum map count check, you must configure vm.max_map_count via sysctl to be at least 262144.

```sh
# run the command on each node:
sysctl -w vm.max_map_count=262144
```

or use a daemonset:

```yaml
apiVersion: extensions/v1beta1
kind: DaemonSet
metadata:
  labels:
    k8s-app: elasticsearch-sysctl
  name: elasticsearch-sysctl
  namespace: default
spec:
  selector:
    matchLabels:
      k8s-app: elasticsearch-sysctl
  template:
    metadata:
      labels:
        k8s-app: elasticsearch-sysctl
    spec:
      containers:
      - command:
        - sh
        - -c
        - sysctl -w vm.max_map_count=262166 && while true; do sleep 86400; done
        image: busybox:1.26.2
        imagePullPolicy: IfNotPresent
        name: sysctl-conf
        resources:
          requests:
            cpu: 10m
            memory: 50Mi
        securityContext:
          privileged: true
      hostPID: true
      nodeSelector:
        beta.kubernetes.io/os: linux
      restartPolicy: Always
```
