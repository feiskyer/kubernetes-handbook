# Nginx Ingress

Deploy nginx ingress controller:

```sh
helm install stable/nginx-ingress --name nginx-ingress --set rbac.create=true --namespace=kube-system
```

Wait a while and get the external IP of ingress service

```sh
kubectl -n kube-system get svc nginx-ingress-controller
```

Then setup a DNS A record for your domain name to the external IP.

## Enable TLS

### Option 1: use cert-manager (recommended):

```sh
helm install --namespace=kube-system --name cert-manager stable/cert-manager --set ingressShim.extraArgs='{--default-issuer-name=letsencrypt,--default-issuer-kind=ClusterIssuer}'
# create cluster issuer
kubectl apply -f cert-manager/cluster-issuer.yaml
```

Create the ingress

```sh
cat <<EOF | kubectl create -f-
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: web
  namespace: default
  annotations:
    kubernetes.io/tls-acme: "true"
    kubernetes.io/ingress.class: "nginx"
    nginx.ingress.kubernetes.io/rewrite-target: /
    ingress.kubernetes.io/ssl-redirect: "true"
    certmanager.k8s.io/cluster-issuer: letsencrypt
spec:
  tls:
  - hosts:
    - echo-tls.example.com
    secretName: web-tls
  rules:
  - host: echo-tls.example.com
    http:
      paths:
      - path: /
        backend:
          serviceName: nginx
          servicePort: 80
EOF
```

### Option 2: use lego

```sh
kubectl apply -f lego/
```

Create secret for echoserver:

```sh
$ htpasswd -c auth foo
$ kubectl -n kube-system create secret generic basic-auth --from-file=auth
```

Create the echoserver ingress: 

```sh
cat <<EOF | kubectl create -f-
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: echoserver
  namespace: echoserver
  annotations:
    kubernetes.io/tls-acme: "true"
    kubernetes.io/ingress.class: "nginx"
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/auth-type: basic
    nginx.ingress.kubernetes.io/auth-secret: basic-auth
    nginx.ingress.kubernetes.io/auth-realm: "Authentication Required"
spec:
  tls:
  - hosts:
    - echo-tls.example.com
    secretName: echoserver-tls
  rules:
  - host: echo-tls.example.com
    http:
      paths:
      - path: /
        backend:
          serviceName: echoserver
          servicePort: 80
EOF
```

