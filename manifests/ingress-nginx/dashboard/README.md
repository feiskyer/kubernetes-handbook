# Kubernetes Dashboard with basic auth

## Create Auth secret

```sh
$ htpasswd -c auth foo
New password: <bar>
New password:
Re-type new password:
Adding password for user foo

$ kubectl -n kube-system create secret generic basic-auth --from-file=auth
secret "basic-auth" created
```

## Deploy dashboard ingress

```sh
kubectl apply -f https://raw.githubusercontent.com/feiskyer/kubernetes-handbook/master/manifests/ingress-nginx/dashboard/dashboard-ingress.yaml
```

