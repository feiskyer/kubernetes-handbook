# ConfigMap

应用程序的运行可能会依赖一些配置，而这些配置又是可能会随着需求产生变化的，如果我们的应用程序架构不是应用和配置分离的，那么就会存在当我们需要去修改某些配置项的属性时需要重新构建镜像文件的窘境。现在，ConfigMap组件可以很好的帮助我们实现应用和配置分离，避免因为修改配置项而重新构建镜像。

ConfigMap 用于保存配置数据的键值对，可以用来保存单个属性，也可以用来保存配置文件。ConfigMap 跟 Secret 很类似，但它可以更方便地处理不包含敏感信息的字符串。

## API 版本对照表

| Kubernetes 版本 | Core API 版本 |
| :--- | :--- |
| v1.5+ | core/v1 |

## ConfigMap 创建

可以使用 `kubectl create configmap` 从文件、目录或者 key-value 字符串创建等创建 ConfigMap。也可以通过 `kubectl create -f file` 创建。

### 从 key-value 字符串创建

```bash
$ kubectl create configmap special-config --from-literal=special.how=very
configmap "special-config" created
$ kubectl get configmap special-config -o go-template='{{.data}}'
map[special.how:very]
```

### 从 env 文件创建

```bash
$ echo -e "a=b\nc=d" | tee config.env
a=b
c=d
$ kubectl create configmap special-config --from-env-file=config.env
configmap "special-config" created
$ kubectl get configmap special-config -o go-template='{{.data}}'
map[a:b c:d]
```

### 从目录创建

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

### 从文件 Yaml/Json 文件创建

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

## ConfigMap 使用

ConfigMap 可以通过三种方式在 Pod 中使用，三种分别方式为：设置环境变量、设置容器命令行参数以及在 Volume 中直接挂载文件或目录。

> **注意**
>
> * ConfigMap 必须在 Pod 引用它之前创建
> * 使用 `envFrom` 时，将会自动忽略无效的键
> * Pod 只能使用同一个命名空间内的 ConfigMap

首先创建 ConfigMap：

```bash
$ kubectl create configmap special-config --from-literal=special.how=very --from-literal=special.type=charm
$ kubectl create configmap env-config --from-literal=log_level=INFO
```

### 用作环境变量

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

当 Pod 结束后会输出

```text
SPECIAL_LEVEL_KEY=very
SPECIAL_TYPE_KEY=charm
log_level=INFO
```

### 用作命令行参数

将 ConfigMap 用作命令行参数时，需要先把 ConfigMap 的数据保存在环境变量中，然后通过 `$(VAR_NAME)` 的方式引用环境变量.

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

当 Pod 结束后会输出

```text
very charm
```

### 使用 volume 将 ConfigMap 作为文件或目录直接挂载

将创建的 ConfigMap 直接挂载至 Pod 的 / etc/config 目录下，其中每一个 key-value 键值对都会生成一个文件，key 为文件名，value 为内容

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

当 Pod 结束后会输出

```text
very
```

将创建的 ConfigMap 中 special.how 这个 key 挂载到 / etc/config 目录下的一个相对路径 / keys/special.level。如果存在同名文件，直接覆盖。其他的 key 不挂载

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

当 Pod 结束后会输出

```text
very
```

ConfigMap 支持同一个目录下挂载多个 key 和多个目录。例如下面将 special.how 和 special.type 通过挂载到 / etc/config 下。并且还将 special.how 同时挂载到 / etc/config2 下。

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

### 使用 subpath 将 ConfigMap 作为单独的文件挂载到目录

在一般情况下 configmap 挂载文件时，会先覆盖掉挂载目录，然后再将 congfigmap 中的内容作为文件挂载进行。如果想不对原来的文件夹下的文件造成覆盖，只是将 configmap 中的每个 key，按照文件的方式挂载到目录下，可以使用 subpath 参数。

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

## 不可变 ConfigMap

> 不可变 ConfigMap 在 v1.21.0 进入稳定版本。

当集群包含大量 ConfigMap 和 Secret 时，大量的 watch 事件会急剧增加 kube-apiserver 的负载，并会导致错误配置过快传播到整个集群。在这种情况中，给不需要经常修改的 ConfigMap 和 Secret 设置 `immutable: true` 就可以避免类似的问题。

不可变 ConfigMap 的好处包括：

* 保护应用，使之免受意外更新所带来的负面影响。
* 通过大幅降低对 kube-apiserver 的压力提升集群性能，这是因为 Kubernetes 会关闭不可变 ConfigMap 的监视操作。

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  ...
data:
  ...
immutable: true
```

## 参考文档

* [ConfigMap](https://kubernetes.io/docs/tasks/configure-pod-container/configure-pod-configmap/)
