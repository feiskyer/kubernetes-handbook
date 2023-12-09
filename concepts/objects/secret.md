# Unveiling the Secrets of Kubernetes

Kubernetes provides an object called 'Secret' that deals with the challenge of configuring sensitive data like passwords, tokens, keys, etc. without exposing this valuable data within images or Pod Specs. Secrets can be utilized either as volumes or as environment variables.

## The Various Types of Secrets

Secrets in Kubernetes come in three different types:

* Opaque: This is a Secret that is formatted in base64 encoding and used to store sensitive elements like passwords, keys, etc. However, it only offers weak encryption security as the data can be decoded back to the original form using base64 --decode.
* `kubernetes.io/dockerconfigjson`: This type of Secret is used to maintain authentication information of a private Docker registry.
* `kubernetes.io/service-account-token`: This variety is referred to by service accounts. When a service account is created, Kubernetes will automatically generate a paired secret. If a Pod utilizes a service account, the matching secret will be automatically mounted to the directory: `/run/secrets/kubernetes.io/serviceaccount` within the Pod.

Note: A service account enables a Pod to access the Kubernetes API.

## API Version Corresponding Chart

| Kubernetes Version | Core API Version |
| :--- | :--- |
| v1.5+ | core/v1 |

## Opaque Secret

The data for this type is a map requiring the value to be in base64 encoding format:

```bash
$ echo -n "admin" | base64
YWRtaW4=
$ echo -n "1f2d1e2e67df" | base64
MWYyZDFlMmU2N2Rm
```

secrets.yml

```text
apiVersion: v1
kind: Secret
metadata:
  name: mysecret
type: Opaque
data:
  password: MWYyZDFlMmU2N2Rm
  username: YWRtaW4=
```

Create a secret: `kubectl create -f secrets.yml`.

```bash
# kubectl get secret
NAME                  TYPE                                  DATA      AGE
default-token-cty7p   kubernetes.io/service-account-token   3         45d
mysecret              Opaque                                2         7s
```

Deceased: The default-token-cty7p is the default secret created when creating a cluster, which is referenced by serviceaccount/default.

If you are creating a secret from a file, you can use a simpler kubectl command, such as creating a TLS secret:

```bash
$ kubectl create secret generic helloworld-tls \
  --from-file=key.pem \
  --from-file=cert.pem
```

## Using Opaque Secrets

Once a secret is created, there are two ways to use it:

* As a Volume
* As an Environment Variable

### Mounting Secrets into Volumes

```text
apiVersion: v1
kind: Pod
metadata:
  labels:
    name: db
  name: db
spec:
  volumes:
  - name: secrets
    secret:
      secretName: mysecret
  containers:
  - image: gcr.io/my_project_id/pg:v1
    name: db
    volumeMounts:
    - name: secrets
      mountPath: "/etc/secrets"
      readOnly: true
    ports:
    - name: cp
      containerPort: 5432
      hostPort: 5432
```

Here's the information within the Pod:

```bash
# ls /etc/secrets
password  username
# cat  /etc/secrets/username
admin
# cat  /etc/secrets/password
1f2d1e2e67df
```

### Exporting Secrets to Environment Variables

```text
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: wordpress-deployment
spec:
  replicas: 2
  strategy:
      type: RollingUpdate
  template:
    metadata:
      labels:
        app: wordpress
        visualize: "true"
    spec:
      containers:
      - name: "wordpress"
        image: "wordpress"
        ports:
        - containerPort: 80
        env:
        - name: WORDPRESS_DB_USER
          valueFrom:
            secretKeyRef:
              name: mysecret
              key: username
        - name: WORDPRESS_DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: mysecret
              key: password
```

### Mounting A Specific Key of the Secret 

```text
apiVersion: v1
kind: Pod
metadata:
  labels:
    name: db
  name: db
spec:
  volumes:
  - name: secrets
    secret:
      secretName: mysecret
      items:
      - key: password
        mode: 511
        path: tst/psd
      - key: username
        mode: 511
        path: tst/usr
  containers:
  - image: nginx
    name: db
    volumeMounts:
    - name: secrets
      mountPath: "/etc/secrets"
      readOnly: true
    ports:
    - name: cp
      containerPort: 80
      hostPort: 5432
```

After creating the Pod successfully, you can see the following in the corresponding directory:

```bash
# kubectl exec db ls /etc/secrets/tst
psd
usr
```
To be continued...