# Unraveling the Mysteries of Network Policy Examples

## The Essentials

Think of network policies as a set of rules implemented by your network plugin. But here's the catch, you can only use these policies if your networking solution supports NetworkPolicy. It's like being handed a beautiful violin without knowing how to play; just owning the instrument won't create music. Similarly, simply creating a NetworkPolicy resource without a controller to manage it won't have any effect.

## The Perfect Workflow: An Illustration

Consider this bit of coding magic:

```sh
$ kubectl apply -f .
```

Wait for a beat or two, et voila, you should find yourself looking at results like these:

```sh
$ kubectl get pod
NAME                                              READY   STATUS      RESTARTS   AGE
nginx-7877b6cf84-5r5b2                            1/1     Running     0          5m
access-pod                                        0/1     Completed   0          3m
no-access-pod                                     0/1     Error       0          3m
```

"nginx-7877b6cf84-5r5b2" here is a pod that's up and running remarkably well without any restarts over the course of 5 minutes. "access-pod" has successfully completed its task within three minutes, while "no-access-pod" has run into some glitches and output an error.
