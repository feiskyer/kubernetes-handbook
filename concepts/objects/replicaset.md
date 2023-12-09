# Managing Your App's Doppelgängers with ReplicaSet

Imagine setting up a number of identical versions of your application (let's call these 'twins') to ensure constant service even in case of an occasional hiccup! Initially, Kubernetes had something termed as ReplicationController (also known as 'rc') just for this purpose. It ensured that the number of 'twins' for your application remained constant. If a twin behaved poorly or exited prematurely, rc would instantly replace it with a new one; if there were extra twins that are of no use anymore, it would quietly retire them. ReplicationController was a superhero, assisting with maintaining the twin-count, flexibly scaling up and down, smoothly upgrading versions, and tracking multiple versions of your app.

But every superhero needs an upgrade! So, in newer versions of Kubernetes, we have ReplicaSet (or 'rs'). Don't be fooled by the name change, ReplicaSet is essentially the same superhero as ReplicationController, with a small upgrade - it supports set-based selectors (while ReplicationController only supported equality-based selectors).

While you could use ReplicaSet standalone, it's recommended to let Deployment manage it. This way, you don't have to worry about any compatibility issues (like ReplicaSet not supporting rolling-update, which Deployment does). Plus, Deployment comes with extra perks like version tracking, rolling back, pausing upgrades, and more. You can find a detailed introduction and usage guide of Deployment [here](deployment.md).

## API Versions: A Comparative Study

| Kubernetes Version | Deployment Version |
| :--- | :--- |
| v1.5-v1.6 | extensions/v1beta1 |
| v1.7-v1.15 | apps/v1beta1 |
| v1.8-v1.15 | apps/v1beta2 |
| v1.9+ | apps/v1 |

## Glimpse of a ReplicationController

```yaml
apiVersion: v1
kind: ReplicationController
metadata:
  name: nginx
spec:
  replicas: 3
  selector:
    app: nginx
  template:
    metadata:
      name: nginx
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx
        ports:
        - containerPort: 80
```

## ReplicaSet In Action

```yaml
apiVersion: extensions/v1beta1
kind: ReplicaSet
metadata:
  name: frontend
  # these labels can be applied automatically
  # from the labels in the pod template if not set
  # labels:
    # app: guestbook
    # tier: frontend
spec:
  # this replicas value is default
  # modify it according to your case
  replicas: 3
  # selector can be applied automatically
  # from the labels in the pod template if not set,
  # but we are specifying the selector here to
  # demonstrate its usage.
  selector:
    matchLabels:
      tier: frontend
    matchExpressions:
      - {key: tier, operator: In, values: [frontend]}
  template:
    metadata:
      labels:
        app: guestbook
        tier: frontend
    spec:
      containers:
      - name: php-redis
        image: gcr.io/google_samples/gb-frontend:v3
        resources:
          requests:
            cpu: 100m
            memory: 100Mi
        env:
        - name: GET_HOSTS_FROM
          value: dns
          # If your cluster config does not include a dns service, then to
          # instead access environment variables to find service host
          # info, comment out the 'value: dns' line above, and uncomment the
          # line below.
          # value: env
        ports:
        - containerPort: 80
```
