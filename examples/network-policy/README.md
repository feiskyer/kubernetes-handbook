# Network Policy examples

## Pre-requirements

Network policies are implemented by the network plugin, so you must be using a networking solution which supports NetworkPolicy - simply creating the resource without a controller to implement it will have no effect.

## Example workflow

```sh
$ kubectl apply -f .
```

Wait a while and then you should see following results:

```sh
$ kubectl get pod
NAME                                              READY   STATUS      RESTARTS   AGE
nginx-7877b6cf84-5r5b2                            1/1     Running     0          5m
access-pod                                        0/1     Completed   0          3m
no-access-pod                                     0/1     Error       0          3m
```
