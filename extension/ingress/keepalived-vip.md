# Living in the VIP Lane with Keepalived-VIP

Kubernetes presents [keepalived](http://www.keepalived.org) as a tool to create a Virtual IP address (VIP).

In this discussion, we will unravel how to effectively use [IPVS - The Linux Virtual Server Project](http://www.linuxvirtualserver.org/software/ipvs.html) to configure a VIP for Kubernetes.

## Prelude

The v1.6 version of Kubernetes provides three modes to expose a Service:

1. **L4 LoadBalancer** : This can only be utilized on [cloud providers](https://kubernetes.io/docs/tasks/access-application-cluster/create-external-load-balancer/) like GCE or AWS.
2. **NodePort** : [NodePort](https://kubernetes.io/docs/concepts/services-networking/service/#type-nodeport) allows the opening of a port on each node. This port then routes the request to a randomly selected pod.
3. **L7 Ingress** : [Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/) serves as a LoadBalancer (for instance, nginx, HAProxy, traefik, vulcand) which directs HTTP/HTTPS requests to the corresponding service endpoint.

So if we've got all these ways, why do we need _keepalived_?

```text

                                             ___________________
                                            |                   |
                                          |-----| Host IP: 10.4.0.3 |
                                          |     |___________________|
                                          |
                                          |     ___________________
                                          |    |                   |
Public ----(example.com = 10.4.0.3/4/5)----|-----| Host IP: 10.4.0.4 |
                                          |    |___________________|
                                          |
                                          |     ___________________
                                          |    |                   |
                                          |-----| Host IP: 10.4.0.5 |
                                                |___________________|
```

Let's suppose that the Ingress operates on 3 Kubernetes nodes, exposing the `10.4.0.x` IP for load balancing purposes. 

If the DNS Round Robin (RR) cycles the requests corresponding to `example.com` to these 3 nodes and `10.4.0.3` crashes, a third of the traffic will still be directed towards `10.4.0.3`. This causes a downtime, until the DNS identifies the failure and corrects the direction. 

Strictly speaking, this doesn't truly offer High Availability (HA).

Here, IPVS comes to our rescue by associating each service with a VIP and exposing the VIP outside the Kubernetes cluster.

### The difference with [service-loadbalancer](https://github.com/kubernetes/contrib/tree/master/service-loadbalancer) and [ingress-nginx](https://github.com/kubernetes/ingress-nginx)

Looking at the diagram below,

```bash
                                              ___________________
                                             |                   |
                                             | VIP: 10.4.0.50    |
                                       |-----| Host IP: 10.4.0.3 |
                                       |    | Role: Master      |
                                       |    |___________________|
                                       |
                                       |     ___________________
                                       |    |                   |
                                       |    | VIP: Unassigned   |
Public ----(example.com = 10.4.0.50)----|-----| Host IP: 10.4.0.4 |
                                       |    | Role: Slave       |
                                       |    |___________________|
                                       |
                                       |     ___________________
                                       |    |                   |
                                       |    | VIP: Unassigned   |
                                       |-----| Host IP: 10.4.0.5 |
                                             | Role: Slave       |
                                             |___________________|
```

Only one node (selected by VRRP) is chosen as the Master, and the VIP is `10.4.0.50`. If `10.4.0.3` fails, another node from the remaining ones becomes Master and takes on the VIP, ensuring the true implementation of HA.

## Environment Requirements

All that's needed is to ensure that the Kubernetes cluster running keepalived-vip has a normal [DaemonSets](../../concepts/objects/daemonset.md) feature.

### RBAC

As Kubernetes introduced the concept of RBAC post version 1.6, we first need to set the rule. For detailed information regarding RBAC, please refer to [the guide](../auth/rbac.md).

vip-rbac.yaml

```yaml
... (Please refer to original text for better code understanding)
```

clusterrolebinding.yaml

```yaml
... (Please refer to original text for better code understanding)
```

```bash
$ kubectl create -f vip-rbac.yaml
$ kubectl create -f clusterrolebinding.yaml
```

## Example

Firstly, create a simple service.

nginx-deployment.yaml

```yaml
... (Please refer to original text for better code understanding)
```

The primary task is to get the pod to listen to port 80, then open the service NodePort monitoring 30320.

```bash
$ kubecrl create -f nginx-deployment.yaml
```

Next, we focus on the config map.

```bash
... (Please refer to original text for better code understanding)
```

Do make a note, `10.87.2.50` must be replaced with an unused IP from your own network segment, e.g., 10.87.2.X. `nginx` is the service name, and this can be changed accordingly.

Following the confirmation,

```bash
... (Please refer to original text for better code understanding)
```

The next step is to set up keepalived-vip.

```yaml
... (Please refer to original text for better code understanding)
```

Establish the daemonset

```bash
... (Please refer to original text for better code understanding)
```

Check the configuration status

```bash
... (Please refer to original text for better code understanding)
```

You can randomly select a pod to inspect its configuration

```bash
... (Please refer to original text for better code understanding)
```

Finally, test the feature

```bash
... (Please refer to original text for better code understanding)
```

10.87.2.50:80 (our hypothetical VIP, as no node actually uses this IP) can now help us direct this service.

All the codes mentioned above can be found [here](https://github.com/kubernetes/contrib/tree/master/keepalived-vip).

## Reference Documents

* [kweisamx/kubernetes-keepalived-vip](https://github.com/kweisamx/kubernetes-keepalived-vip)
* [kubernetes/keepalived-vip](https://github.com/kubernetes/contrib/tree/master/keepalived-vip)
