# Port Forwarding

Port forwarding is a subcommand of kubectl, which allows you to forward local ports to a specific Pod using the `kubectl port-forward` command.

## Pod Port Forwarding

Local ports can be forwarded to a port on a specified Pod.

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

## Service Port Forwarding

You can also forward local ports to the ports of services, replication controllers, or deployments.

```bash
# Forward to deployment
kubectl port-forward deployment/redis-master 6379:6379

# Forward to replicaSet
kubectl port-forward rs/redis-master 6379:6379

# Forward to service
kubectl port-forward svc/redis-master 6379:6379
```

---

# Tunneling into Kubernetes: Port Forwarding

Port forwarding is a handy tool from the toolbox of `kubectl`, which quickly creates a communication tunnel from your local machine to any pod within Kubernetes. 

## Making Connections to Pods

Local ports can be effortlessly connected to a specific Pod's port to allow for immediate data flow in both directions.

```bash
# Establish connections between local ports 5000 and 6000 and the same ports on the pod
kubectl port-forward mypod 5000 6000

# Map your local port 8888 to port 5000 on the pod, creating a portal for interaction
kubectl port-forward mypod 8888:5000

# Assign a random local port to connect to port 5000 on your pod for a flexible link
kubectl port-forward mypod :5000

# Similarly, another way to bind to a random local port and forward to port 5000 on the pod
kubectl port-forward mypod 0:5000
```

## Linking Up with Services

You're not limited to pods! Cast a line from your local port to the ports designated for services, replication controllers, or entire deployments and get direct access to your Kubernetes resources.

```bash
# Dive straight into a deployment's port, linking the local 6379 with the deployment's
kubectl port-forward deployment/redis-master 6379:6379

# Connect with a replicaSet, mirroring the port 6379 on both local and remote ends
kubectl port-forward rs/redis-master 6379:6379

# Or channel into a service's port with local port 6379 serving as your Kubernetes conduit
kubectl port-forward svc/redis-master 6379:6379
```