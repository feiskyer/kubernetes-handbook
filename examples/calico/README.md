# Query Calico GlobalNetworkPolicy logs

Since Calico NetworkPolicy is based on iptables, calico-node logs only show its container's output, but not GlobalNetworkPolicy Log action. This example shows how to query those logs.

## How to deploy

```sh
kubectl apply -f calico-packet-logs.yaml
```

## How to get the logs

```sh
kubectl logs calico-packet-logs-xxxx
```

