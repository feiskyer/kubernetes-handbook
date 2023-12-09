# Simplifying Your Web Traffic Using Ingress and Letsencrypt

## Domain Registration

Before starting your journey with Let's Encrypt, you first need to acquire a domain name. This can be done through websites such as GoDaddy or Name. You can refer to various internet tutorials for the registration process as it's outside the scope of this article.

## Deploying Nginx Ingress Controller

Use Helm for deployment as follows:

```bash
helm install stable/nginx-ingress --name nginx-ingress --set rbac.create=true --namespace=kube-system
```

After successful deployment, find the public IP address of the Ingress service (for this article, let’s assume it to be `6.6.6.6`):

```bash
$ kubectl -n kube-system get service nginx-ingress-controller
NAME                       TYPE           CLUSTER-IP     EXTERNAL-IP     PORT(S)                      AGE
nginx-ingress-controller   LoadBalancer   10.0.216.124   6.6.6.6         80:31935/TCP,443:31797/TCP   4d
```

Next, go to the domain registrar's website and create an 'A' record to resolve the needed domain towards the IP `6.6.6.6`.

## Let's Get 'Letsencrypt' Going

```bash
# Install cert-manager
helm install --namespace=kube-system --name cert-manager stable/cert-manager --set ingressShim.defaultIssuerName=letsencrypt --set ingressShim.defaultIssuerKind=ClusterIssuer

# create cluster issuer
kubectl apply -f https://raw.githubusercontent.com/feiskyer/kubernetes-handbook/master/manifests/ingress-nginx/cert-manager/cluster-issuer.yaml
```

## Create Ingress

Firstly, create a Secret for authentication:

```bash
$ htpasswd -c auth foo
$ kubectl -n kube-system create secret generic basic-auth --from-file=auth
```

### HTTP Ingress Example

Create a TLS Ingress for your nginx service (at port 80) and also automatically redirect `http://echo-tls.example.com` to `https://echo-tls.example.com`:

```bash
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
    nginx.ingress.kubernetes.io/rewrite-target: /
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

### TLS Ingress

Create a TLS Ingress for the Kubernetes Dashboard service (at port 443) and disable HTTP access for the domain:

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  annotations:
    kubernetes.io/ingress.class: nginx
    kubernetes.io/tls-acme: "true"
    kubernetes.io/ingress.allow-http: "false"
    nginx.ingress.kubernetes.io/auth-realm: Authentication Required
    nginx.ingress.kubernetes.io/auth-secret: basic-auth
    nginx.ingress.kubernetes.io/auth-type: basic
    nginx.ingress.kubernetes.io/secure-backends: "true"
    certmanager.k8s.io/cluster-issuer: letsencrypt
  name: dashboard
  namespace: kube-system
spec:
  tls:
  - hosts:
    - dashboard.example.com
    secretName: dashboard-ingress-tls
  rules:
  - host: dashboard.example.com
    http:
      paths:
      - path: /
        backend:
          serviceName: kubernetes-dashboard
          servicePort: 443
```

## References

* [Nginx Ingress Controller Documentation](https://kubernetes.github.io/ingress-nginx/)