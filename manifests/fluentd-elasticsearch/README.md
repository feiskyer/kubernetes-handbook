# EFK

Do not forget to label nodes first:

```sh
kubectl label nodes --all beta.kubernetes.io/fluentd-ds-ready=true
```

Then deploy EFK

```
kubectl apply -f .
```

## Basic Auth

Replace secret with following command:

```sh
$ kubectl -n kube-system delete secret basic-auth
$ htpasswd -c auth foo
$ kubectl -n kube-system create secret generic basic-auth --from-file=auth
```
