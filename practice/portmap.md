# Port Mapping

When creating a Pod, you can specify the hostPort and containerPort for the containers to establish port mapping. This allows the service to be accessed via the Node’s IP where the Pod is located, using IP:hostPort. For example:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
spec:
  containers:
  - image: nginx
    name: nginx
    ports:
    - containerPort: 80
      hostPort: 80
  restartPolicy: Always
```

## Precautions

Containers that use the hostPort can only be scheduled on Nodes where the port does not cause a conflict. Unless necessary (such as running system-level daemon services), using the port mapping feature is not recommended. If there is a need to expose services externally, it is advisable to use [NodePort Service](../concepts/objects/service.md#Service).

---

# Port Mapping Demystified

Creating a Pod isn't just about launching containers; it's about making them accessible. By adding a little detail about hostPort and containerPort, you're essentially drawing a map that guides traffic from the outside world to the container's doorstep. For instance, see how it's done for a web server running Nginx:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
spec:
  containers:
  - image: nginx
    name: nginx
    ports:
    - containerPort: 80
      hostPort: 80
  restartPolicy: Always
```

## Handy Tips

Imagine containers as guests at a hotel—each needs its own room number (port). If a guest (container) insists on a specific room (hostPort), it can only check-in to a hotel (Node) with that room vacant. To prevent overbooking, exercise restraint with direct port mapping. Unless you're setting up a service that's akin to a VIP guest (like a system-level daemon), try to avoid it. And if you're looking to roll out the red carpet for external access to your services, consider using the concierge service known as [NodePort Service](../concepts/objects/service.md#Service).