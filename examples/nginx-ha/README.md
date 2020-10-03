# Zero Downtime Service Updates

Example nginx manifests for the zone downtime service udpates described [here](https://blog.gruntwork.io/zero-downtime-server-updates-for-your-kubernetes-cluster-902009df5b33).

General guidelines of Kubernetes workloads HA are:

* run Pods in multiple replicas across different nodes
* readinessProbe is added to the container
* applications have handled SIGTERM to gracefully shutdown itself (e.g. save data and close network connections)
* sleep at least 10 seconds in the preStop hook (longer than LB health probe failure)
* service's externalTrafficPolicy is set to Local
* PodDiscruptionBudget is used to avoid disruptions
* eviction API (e.g. kubectl drain) is used to honor PDB

Note that even all of the above steps are applied, connection timeout would still happen because:

* Pod IPs would be deleted from endpoints immediately when the Pods are marked for deletion. Endpoints controller won't wait for the real container status, it only checks  `pod.DeletionTimestamp != nil`.
* kube-proxy would delete the iptables rules immediately when the Pod IPs are deleted from endpoints.
* LoadBalancer would continue forwarding requests to the node until health probe fails (it needs 10s).

So, there're still some extra steps required to completely avoid connection issues:

1) To avoid new connection issues, remove the node from LoadBalancer backend address pool if you want to drain the node. Or else, ensure the Pods are still running on existing nodes (by using nodeAffinity and deployment.strategy.rollingUpdate.maxUnavailable).
2) To avoid existing persistent connections, graceful termination is required to indicate the connections should be closed when the Pods get the SIGTERM signal. For node draining scenarios, since the existing active connections would be terminated, it's better to block the health check for a while before removing the node from SLB backend address pool.

## Provision Nginx service

```sh
kubectl apply -f .
```

## Install HTTP load testing tool

```sh
$ go get -u github.com/tsenart/vegeta
```

## Validate Nginx service availability during node drain

```sh
# Get the Nodes that nginx Pods are running
$ kubectl get pod -l app=nginx -o wide
NAME                     READY   STATUS    RESTARTS   AGE     IP            NODE                                NOMINATED NODE   READINESS GATES
nginx-6666887fcc-rcrxf   1/1     Running   0          3m38s   10.244.1.15   aks-nodepool1-10809199-vmss000002   <none>           <none>
nginx-6666887fcc-rwzwd   1/1     Running   0          3m56s   10.244.2.18   aks-nodepool1-10809199-vmss000001   <none>           <none>
nginx-6666887fcc-xknfj   1/1     Running   0          4m18s   10.244.3.4    aks-nodepool2-10809199-vmss000000   <none>           <none>

# Start HTTP load testing in one terminal
$ ulimit -n unlimited
$ echo "GET http://1.2.3.4" | vegeta attack -rate=5000 -timeout=10s -keepalive=false -duration=1m | tee results.bin | vegeta report

# Drain one of the above nodes in another terminal
$ kubectl drain aks-nodepool1-10809199-vmss000001 --delete-local-data --ignore-daemonsets
```

Check the HTTP load test results from the first terminal:

```sh
Requests      [total, rate, throughput]         299988, 4999.56, 4856.10
Duration      [total, attack, wait]             1m0s, 1m0s, 87.815ms
Latencies     [min, mean, 50, 90, 95, 99, max]  65.523ms, 866.673ms, 80.412ms, 2.409s, 5.066s, 10.003s, 10.367s
Bytes In      [total, mean]                     178585272, 595.31
Bytes Out     [total, mean]                     0, 0.00
Success       [ratio]                           97.27%
Status Codes  [code:count]                      0:8182  200:291806
Error Set:
context deadline exceeded (Client.Timeout or context cancellation while reading body)
```

## Cleanup

```sh
kubectl uncordon aks-nodepool1-10809199-vmss000001
kubectl delete -f .
```
