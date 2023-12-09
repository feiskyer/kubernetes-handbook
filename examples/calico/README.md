# Digging into Calico GlobalNetworkPolicy Logs

Calico uses NetworkPolicy, which in turn is built on iptables, to establish security protocols and protect your network operations. But don’t expect to find any GlobalNetworkPolicy action insights in calico-node logs. These logs capture only their container's output. This guide will help you understand how to retrieve those elusive GlobalNetworkPolicy logs. 

## Setting Up 

```sh
kubectl apply -f calico-packet-logs.yaml
```

With this shell command, you can activate the YAML file named 'calico-packet-logs'. This file will kickstart the operation of collating the logs for you.

## Extracting The Logs 

```sh
kubectl logs calico-packet-logs-xxxx
```

You can enter the above command to get these logs. Replace 'xxxx' with the appropriate event or identifier that corresponds to the log you are looking for. It’s just that easy to keep your finger on the pulse of Calico’s GlobalNetworkPolicy actions.
