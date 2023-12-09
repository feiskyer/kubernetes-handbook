# Supercharging Your Pods with PodPreset

The life of a Kubernetes pod can get a lot easier with PodPreset – a stellar utility that enables the injection of additional information such as environment variables and storage volumes into Pods with specified labels. This means that you no longer need to set up repetitive information for each Pod in your templates!

Even better – you can prevent them from being tampered with the PodPreset by adding the annotation `podpreset.admission.kubernetes.io/exclude: "true"` to your Pods.

## Aligning API Versions

| Kubernetes Version | API Version | Default Status |
| :--- | :--- | :--- |
| v1.6+ | settings.k8s.io/v1alpha1 | No |

### Activating PodPreset

* Activate API with `kube-apiserver --runtime-config=settings.k8s.io/v1alpha1=true`
* Enable admission control with `--enable-admission-plugins=..,PodPreset`

## Diving into PodPreset Examples

Suppose you're using a PodPreset to add environment variables and storage volumes:

```yaml
kind: PodPreset
apiVersion: settings.k8s.io/v1alpha1
metadata:
  name: allow-database
  namespace: myns
spec:
  selector:
    matchLabels:
      role: frontend
  env:
    - name: DB_PORT
      value: "6379"
  volumeMounts:
    - mountPath: /cache
      name: cache-volume
  volumes:
    - name: cache-volume
      emptyDir: {}
```

And you submit a Pod:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: website
  labels:
    app: website
    role: frontend
spec:
  containers:
    - name: website
      image: ecorp/website
      ports:
        - containerPort: 80
```

After going through the `PodPreset` admission control, the Pod automatically acquires additional environment variables and storage volumes:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: website
  labels:
    app: website
    role: frontend
  annotations:
    podpreset.admission.kubernetes.io/allow-database: "resource version"
spec:
  containers:
    - name: website
      image: ecorp/website
      volumeMounts:
        - mountPath: /cache
          name: cache-volume
      ports:
        - containerPort: 80
      env:
        - name: DB_PORT
          value: "6379"
  volumes:
    - name: cache-volume
      emptyDir: {}
```

## Checking Out ConfigMap Examples

When dealing with ConfigMaps:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: etcd-env-config
data:
  number_of_members: "1"
  initial_cluster_state: new
  initial_cluster_token: DUMMY_ETCD_INITIAL_CLUSTER_TOKEN
  discovery_token: DUMMY_ETCD_DISCOVERY_TOKEN
  discovery_url: http://etcd_discovery:2379
  etcdctl_peers: http://etcd:2379
  duplicate_key: FROM_CONFIG_MAP
  REPLACE_ME: "a value"
```

And using PodPresets:

```yaml
kind: PodPreset
apiVersion: settings.k8s.io/v1alpha1
metadata:
  name: allow-database
  namespace: myns
spec:
  selector:
    matchLabels:
      role: frontend
  env:
    - name: DB_PORT
      value: 6379
    - name: duplicate_key
      value: FROM_ENV
    - name: expansion
      value: $(REPLACE_ME)
  envFrom:
    - configMapRef:
        name: etcd-env-config
  volumeMounts:
    - mountPath: /cache
      name: cache-volume
    - mountPath: /etc/app/config.json
      readOnly: true
      name: secret-volume
  volumes:
    - name: cache-volume
      emptyDir: {}
    - name: secret-volume
      secretName: config-details
```

Upon submitting a Pod and applying `PodPreset` admission control, your Pod now automatically includes ConfigMap environment variables:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: website
  labels:
    app: website
    role: frontend
  annotations:
    podpreset.admission.kubernetes.io/allow-database: "resource version"
spec:
  containers:
    - name: website
      image: ecorp/website
      volumeMounts:
        - mountPath: /cache
          name: cache-volume
        - mountPath: /etc/app/config.json
          readOnly: true
          name: secret-volume
      ports:
        - containerPort: 80
      env:
        - name: DB_PORT
          value: "6379"
        - name: duplicate_key
          value: FROM_ENV
        - name: expansion
          value: $(REPLACE_ME)
      envFrom:
        - configMapRef:
          name: etcd-env-config
  volumes:
    - name: cache-volume
      emptyDir: {}
    - name: secret-volume
      secretName: config-details
```

## Example: Changing Pod Time Zone

This powerful utility even allows you to change the time zone for all Pods labelled `tz: shanghai` to Shanghai time zone, as shown in the given example: 

```yaml
kind: PodPreset
apiVersion: settings.k8s.io/v1alpha1
metadata:
  name: tz-shanghai
  namespace: default
spec:
  selector:
    matchLabels:
      tz: shanghai
  volumeMounts:
    - mountPath: /etc/localtime
      name: tz-config
  volumes:
    - name: tz-config
      hostPath:
        path: /usr/share/zoneinfo/Asia/Shanghai
```

This demonstrates how PodPreset carries the potential to greatly simplify Kubernetes usage, so it's definitely time to give it a try!
