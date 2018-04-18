# Nginx Ingress

Deploy nginx ingress controller:

```sh
helm install stable/nginx-ingress --name nginx-ingress --set rbac.create=true --namespace=kube-system
```

## TLS

Enable tls:

```sh
kubectl apply -f lego/
```

Create ingress with TLS:

- Change `echo-tls.example.com` to your host in [echoserver/ingress-tls.yaml](echoserver/ingress-tls.yaml)
- Add an A record in your DNS provider
- Create secret
```sh
$ htpasswd -c auth foo
$ kubectl -n kube-system create secret generic basic-auth --from-file=auth
```
- Create the echoserver ingress: `kubectl apply -f echoserver`
- Visit echoserver `https://<your-honst>`

