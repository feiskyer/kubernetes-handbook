# Setting Up EFK Stack on Kubernetes

Before you commence the EFK stack setup, remember to label your nodes appropriately:

```sh
kubectl label nodes --all beta.kubernetes.io/fluentd-ds-ready=true
```

After labeling, proceed to deploy the EFK stack by applying the configuration files:

```
kubectl apply -f .
```

## Implementing Basic Authentication

To incorporate basic authentication, you must replace the secret using the subsequent command sequence:

```sh
$ kubectl -n kube-system delete secret basic-auth
$ htpasswd -c auth foo
$ kubectl -n kube-system create secret generic basic-auth --from-file=auth
```

## Configuring Maximum Map Count for Elasticsearch

Elasticsearch requires a substantial number of memory-mapped areas for optimal operation, specifically set at a minimum of 262,144 areas. This setting is crucial for Linux systems. To comply with this requirement, modify `vm.max_map_count` using `sysctl`:

```sh
# Execute this on every node:
sysctl -w vm.max_map_count=262144
```

Alternatively, you can employ a DaemonSet to apply the setting cluster-wide:

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

---

# EFK Stack Configuration 101: From Node Labeling to Secure Searches

## Let's Start with Node Prepping

The first thing on our to-do list is to make sure your Kubernetes nodes are labeled right. Think of it as a gentle nudge telling your nodes they've got to be ready for what's coming next—the Fluentd daemon set. Make it happen with this simple line:

```sh
kubectl label nodes --all beta.kubernetes.io/fluentd-ds-ready=true
```

Now, the stage is set. Time to get the real party started by deploying the EFK stack. It's as easy as telling Kubernetes to make sense of the configuration files you've arranged orderly:

```
kubectl apply -f .
```

## Locking Up Access with Basic Auth

Your logs are your secrets. Keep them under lock and key with basic authentication. Reset that secret vault with these command spells:

```sh
$ kubectl -n kube-system delete secret basic-auth
$ htpasswd -c auth foo
$ kubectl -n kube-system create secret generic basic-auth --from-file=auth
```

Voilà! Access to your logs now needs the magic word (aka password).

## Amp Up the Map Limits

Elasticsearch has quite the appetite for memory-mapped areas—we're talking 262,144 of them at the least. If your system's a Linux, you've got an entry ticket to make with this incantation:

```sh
# Cast this on each node to set the magic number:
sysctl -w vm.max_map_count=262144
```

Or, if you're more of a set-and-forget type, conjure up a DaemonSet to spread the spell across your entire cluster, and keep it running like clockwork:

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

With the nodes prepped, basic auth up, and memory-mapped limits set high, your EFK stack is ready to sift through logs like a pro!