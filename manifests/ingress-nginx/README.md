# Effortless HTTPS with Nginx Ingress in Kubernetes

Embarking on the journey of managing web traffic within your Kubernetes cluster? Buckle up and get ready to deploy the Nginx ingress controller—a gatekeeper that channels incoming traffic to the right destination within your Kubernetes environment.

Kick-off with a simple command:

```sh
helm install stable/nginx-ingress --name nginx-ingress --set rbac.create=true --namespace=kube-system
```

And for our friends in China:
```sh
helm install stable/nginx-ingress --name nginx-ingress --set rbac.create=true --namespace=kube-system --set defaultBackend.image.repository=crproxy.trafficmanager.net:6000/google_containers/defaultbackend
```

Be patient for a moment as things get going. Soon, you can retrieve the external IP of the ingress service with a flick of the wrist:

```sh
kubectl -n kube-system get svc nginx-ingress-controller
```

Then navigate the realms of DNS to point your domain name to this newfound external IP with an A record.

Just a heads-up—if RBAC has taken a day off in your cluster, roll out the Nginx ingress controller without it:

```sh
helm install stable/nginx-ingress --set rbac.create=false --set rbac.createRole=false --set rbac.createClusterRole=false
```

## Encryption with TLS: Your Passport to Security

### Option 1: Cert-manager, A No-Brainer (Highly Suggested):

```sh
# Install cert-manager
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager --namespace=kube-system --set ingressShim.defaultIssuerName=letsencrypt --set ingressShim.defaultIssuerKind=ClusterIssuer

# Enroll a cluster issuer
kubectl apply -f https://raw.githubusercontent.com/feiskyer/kubernetes-handbook/master/manifests/ingress-nginx/cert-manager/cluster-issuer.yaml
```

Craft your ingress with elegance:

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

### Option 2: Lego—Because Everyone Loves Building Blocks:

```sh
kubectl apply -f lego/
```

Establish a secret handshake for your echo server:

```sh
$ htpasswd -c auth foo
$ kubectl -n kube-system create secret generic basic-auth --from-file=auth
```

And then set the stage for your echo server's grand ingress:

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

Conquer the web traffic and secure your domains with stylish simplicity in Kubernetes. Whether you're a cert-manager enthusiast or a Lego aficionado, set up your Nginx ingress for a smooth sailing experience in the cloud seas.