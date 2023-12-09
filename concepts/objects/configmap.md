# ConfigMap Magic

Your application's performance can hinge on its configuration, which, naturally, may evolve along with your needs. If your application architecture is merged with your configuration, then changing certain settings would mean having to rebuild your mirror file—an inconvenient predicament. Enter the 'ConfigMap' component. Designed to separate your application and configuration, ConfigMap effectively eliminates the need to rebuild your mirror file every time you tweak a setting.

ConfigMap works by storing key-value pairs of configuration data, which can either take the form of individual properties or entire configuration files. It's a lot like the 'Secret' component, except it's better suited to handling strings that don't contain sensitive information.

## API Version Compatibility Table

| Kubernetes Version | Core API Version |
| :--- | :--- |
| v1.5+ | core/v1 |

## Creating a ConfigMap

You can enlist the help of `kubectl create configmap` to create a ConfigMap from a file, directory or a key-value string. Alternatively, `kubectl create -f file` can be used to make a ConfigMap from a file.

### Create from Key-Value String

```bash
$ kubectl create configmap special-config --from-literal=special.how=very
configmap "special-config" created
$ kubectl get configmap special-config -o go-template='{{.data}}'
map[special.how:very]
```

### Create from ENV File

```bash
$ echo -e "a=b\nc=d" | tee config.env
a=b
c=d
$ kubectl create configmap special-config --from-env-file=config.env
configmap "special-config" created
$ kubectl get configmap special-config -o go-template='{{.data}}'
map[a:b c:d]
```

### Create from Directory

```bash
$ mkdir config
$ echo a>config/a
$ echo b>config/b
$ kubectl create configmap special-config --from-file=config/
configmap "special-config" created
$ kubectl get configmap special-config -o go-template='{{.data}}'
map[a:a
 b:b
]
```

### Create from Yaml/Json File

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: special-config
  namespace: default
data:
  special.how: very
  special.type: charm
```

```bash
$ kubectl create  -f  config.yaml
configmap "special-config" created
```

## Using ConfigMap

You can incorporate ConfigMap into your 'Pod' via three different methods, either by setting environment variables, setting container command line parameters, or by directly mounting files or directories in 'Volume'.

> **Note**
>
> * ConfigMap must be created before a Pod can reference it
> * Invalid keys will be automatically ignored when using `envFrom`
> * A Pod can only use ConfigMap within the same namespace

First, you'll need to create a ConfigMap:

```bash
$ kubectl create configmap special-config --from-literal=special.how=very --from-literal=special.type=charm
$ kubectl create configmap env-config --from-literal=log_level=INFO
```

### Use as Environment Variable

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: test-pod
spec:
  containers:
    - name: test-container
      image: gcr.io/google_containers/busybox
      command: ["/bin/sh", "-c", "env"]
      env:
        - name: SPECIAL_LEVEL_KEY
          valueFrom:
            configMapKeyRef:
              name: special-config
              key: special.how
        - name: SPECIAL_TYPE_KEY
          valueFrom:
            configMapKeyRef:
              name: special-config
              key: special.type
      envFrom:
        - configMapRef:
            name: env-config
  restartPolicy: Never
```

Once the Pod ends, it'd output:

```text
SPECIAL_LEVEL_KEY=very
SPECIAL_TYPE_KEY=charm
log_level=INFO
```

### Use as Command Line Arguments

To use ConfigMap as command line arguments, you'd have to store the ConfigMap data in environment variables and reference these through `$(VAR_NAME)`.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: dapi-test-pod
spec:
  containers:
    - name: test-container
      image: gcr.io/google_containers/busybox
      command: ["/bin/sh", "-c", "echo $(SPECIAL_LEVEL_KEY) $(SPECIAL_TYPE_KEY)" ]
      env:
        - name: SPECIAL_LEVEL_KEY
          valueFrom:
            configMapKeyRef:
              name: special-config
              key: special.how
        - name: SPECIAL_TYPE_KEY
          valueFrom:
            configMapKeyRef:
              name: special-config
              key: special.type
  restartPolicy: Never
```

Once the Pod ends, it'd output:

```text
very charm
```

### Mount ConfigMap as File or Directory in Volume Directly

You can directly mount the created ConfigMap unto a Pod’s /etc/config directory. Here, each key-value pair would generate a file—with the key as the filename and the value as the content.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: vol-test-pod
spec:
  containers:
    - name: test-container
      image: gcr.io/google_containers/busybox
      command: ["/bin/sh", "-c", "cat /etc/config/special.how"]
      volumeMounts:
      - name: config-volume
        mountPath: /etc/config
  volumes:
    - name: config-volume
      configMap:
        name: special-config
  restartPolicy: Never
```

Once the Pod ends, it'd output:

```text
very
```

You can also mount this key, special.how, to a relative path /keys/special.level within the /etc/config directory. Any file with the same name would be directly overwritten, while all other keys are left unmounted.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: dapi-test-pod
spec:
  containers:
    - name: test-container
      image: gcr.io/google_containers/busybox
      command: ["/bin/sh","-c","cat /etc/config/keys/special.level"]
      volumeMounts:
      - name: config-volume
        mountPath: /etc/config
  volumes:
    - name: config-volume
      configMap:
        name: special-config
        items:
        - key: special.how
          path: keys/special.level
  restartPolicy: Never
```

Once the Pod ends, it'd output:

```text
very
```

Additionally, ConfigMap supports mounting multiple keys in the same directory or multiple directories. For instance, in the example below, special.how and special.type are doubly mounted to /etc/config and special.how is also mounted to /etc/config2.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: dapi-test-pod
spec:
  containers:
    - name: test-container
      image: gcr.io/google_containers/busybox
      command: ["/bin/sh","-c","sleep 36000"]
      volumeMounts:
      - name: config-volume
        mountPath: /etc/config
      - name: config-volume2
        mountPath: /etc/config2
  volumes:
    - name: config-volume
      configMap:
        name: special-config
        items:
        - key: special.how
          path: keys/special.level
        - key: special.type
          path: keys/special.type
    - name: config-volume2
      configMap:
        name: special-config
        items:
        - key: special.how
          path: keys/special.level
  restartPolicy: Never
```

```bash
# ls  /etc/config/keys/
special.level  special.type
# ls  /etc/config2/keys/
special.level
# cat  /etc/config/keys/special.level
very
# cat  /etc/config/keys/special.type
charm
```

### Using Subpath to Mount ConfigMap as Individual File to Directory

In general, congfigmap will mount its content as a file after first overwriting the mounted directory. If you want to avoid overwriting files under the original folder, and just want to mount each key from configmap as a file to the directory, you can use the subpath parameter.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: dapi-test-pod
spec:
  containers:
    - name: test-container
      image: nginx
      command: ["/bin/sh","-c","sleep 36000"]
      volumeMounts:
      - name: config-volume
        mountPath: /etc/nginx/special.how
        subPath: special.how
  volumes:
    - name: config-volume
      configMap:
        name: special-config
        items:
        - key: special.how
          path: special.how
  restartPolicy: Never
```

```bash
root@dapi-test-pod:/# ls /etc/nginx/
conf.d    fastcgi_params    koi-utf  koi-win  mime.types  modules  nginx.conf  scgi_params    special.how  uwsgi_params  win-utf
root@dapi-test-pod:/# cat /etc/nginx/special.how
very
root@dapi-test-pod:/#
```

## Immutable ConfigMap

> Immutable ConfigMap went stable in v1.21.0.

When a cluster includes a large number of ConfigMap and Secret, a myriad of watch events can intensely boost the load on kube-apiserver and hasten the spread of configuration errors throughout the entire cluster. In this scenario, marking ConfigMap and Secret that don't require frequent modifications as `immutable: true` can sidestep this issue.

Principal benefits of immutable ConfigMap include:

* Safeguarding your application from the adverse effects of accidental updates.
* Amping up your cluster performance by drastically curbing the pressure on kube-apiserver, as Kubernetes ceases to monitor operations on immutable ConfigMap.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  ...
data:
  ...
immutable: true
```

## Further Reading

* [ConfigMap](https://kubernetes.io/docs/tasks/configure-pod-container/configure-pod-configmap/)