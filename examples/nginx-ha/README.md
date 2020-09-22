# Zero Downtime Service Updates

Example nginx manifests for the zone downtime service udpates described [here](https://blog.gruntwork.io/zero-downtime-server-updates-for-your-kubernetes-cluster-902009df5b33).

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
$ echo "GET http://1.2.3.4" | vegeta attack -rate=50 -timeout=10s -keepalive=false -duration=5m | tee results.bin | vegeta report

# Drain one of the above nodes in another terminal
$ kubectl drain aks-nodepool1-10809199-vmss000001 --delete-local-data --ignore-daemonsets
```

Check the HTTP load test results from the first terminal:

```sh
Requests      [total, rate, throughput]         15000, 50.00, 49.99
Duration      [total, attack, wait]             5m0s, 5m0s, 72.15ms
Latencies     [min, mean, 50, 90, 95, 99, max]  65.926ms, 69.877ms, 69.671ms, 73.206ms, 74.374ms, 76.42ms, 91.791ms
Bytes In      [total, mean]                     9180000, 612.00
Bytes Out     [total, mean]                     0, 0.00
Success       [ratio]                           100.00%
Status Codes  [code:count]                      200:15000
Error Set:
```

## Cleanup

```sh
kubectl uncordon aks-nodepool1-10809199-vmss000001
kubectl delete -f .
```
