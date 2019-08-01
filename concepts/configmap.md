# ConfigMap

在執行應用程式或是生產環境等等, 會有許多的情況需要做變更, 而我們不希望因應每一種需求就要準備一個鏡像檔, 這時就可以透過 ConfigMap 來幫我們做一個配置檔或是命令參數的映射, 更加彈性化使用我們的服務或是應用程式。

ConfigMap 用於保存配置數據的鍵值對，可以用來保存單個屬性，也可以用來保存配置文件。ConfigMap 跟 secret 很類似，但它可以更方便地處理不包含敏感信息的字符串。

## API 版本對照表

| Kubernetes 版本 | Core API 版本 |
| --------------- | ------------- |
| v1.5+           | core/v1       |

## ConfigMap 創建

可以使用 `kubectl create configmap` 從文件、目錄或者 key-value 字符串創建等創建 ConfigMap。也可以通過 `kubectl create -f file` 創建。

### 從 key-value 字符串創建

```sh
$ kubectl create configmap special-config --from-literal=special.how=very
configmap "special-config" created
$ kubectl get configmap special-config -o go-template='{{.data}}'
map[special.how:very]
```

### 從 env 文件創建

```sh
$ echo -e "a=b\nc=d" | tee config.env
a=b
c=d
$ kubectl create configmap special-config --from-env-file=config.env
configmap "special-config" created
$ kubectl get configmap special-config -o go-template='{{.data}}'
map[a:b c:d]
```

### 從目錄創建

```sh
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

### 從文件 Yaml/Json 文件創建

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

```sh
$ kubectl create  -f  config.yaml
configmap "special-config" created
```

## ConfigMap 使用

ConfigMap 可以通過三種方式在 Pod 中使用，三種分別方式為：設置環境變量、設置容器命令行參數以及在 Volume 中直接掛載文件或目錄。

> **注意**
>
> - ConfigMap 必須在 Pod 引用它之前創建
> - 使用 `envFrom` 時，將會自動忽略無效的鍵
> - Pod 只能使用同一個命名空間內的 ConfigMap

首先創建 ConfigMap：

```sh
$ kubectl create configmap special-config --from-literal=special.how=very --from-literal=special.type=charm
$ kubectl create configmap env-config --from-literal=log_level=INFO
```

### 用作環境變量

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

當 Pod 結束後會輸出

```
SPECIAL_LEVEL_KEY=very
SPECIAL_TYPE_KEY=charm
log_level=INFO
```

### 用作命令行參數

將 ConfigMap 用作命令行參數時，需要先把 ConfigMap 的數據保存在環境變量中，然後通過 `$(VAR_NAME)` 的方式引用環境變量.

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

當 Pod 結束後會輸出

```
very charm
```

### 使用 volume 將 ConfigMap 作為文件或目錄直接掛載

將創建的 ConfigMap 直接掛載至 Pod 的 / etc/config 目錄下，其中每一個 key-value 鍵值對都會生成一個文件，key 為文件名，value 為內容

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

當 Pod 結束後會輸出

```
very
```

將創建的 ConfigMap 中 special.how 這個 key 掛載到 / etc/config 目錄下的一個相對路徑 / keys/special.level。如果存在同名文件，直接覆蓋。其他的 key 不掛載

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
當 Pod 結束後會輸出

```
very
```

ConfigMap 支持同一個目錄下掛載多個 key 和多個目錄。例如下面將 special.how 和 special.type 通過掛載到 / etc/config 下。並且還將 special.how 同時掛載到 / etc/config2 下。

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

```sh
# ls  /etc/config/keys/
special.level  special.type
# ls  /etc/config2/keys/
special.level
# cat  /etc/config/keys/special.level
very
# cat  /etc/config/keys/special.type
charm
```

### 使用 subpath 將 ConfigMap 作為單獨的文件掛載到目錄
在一般情況下 configmap 掛載文件時，會先覆蓋掉掛載目錄，然後再將 congfigmap 中的內容作為文件掛載進行。如果想不對原來的文件夾下的文件造成覆蓋，只是將 configmap 中的每個 key，按照文件的方式掛載到目錄下，可以使用 subpath 參數。
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

```sh
root@dapi-test-pod:/# ls /etc/nginx/
conf.d	fastcgi_params	koi-utf  koi-win  mime.types  modules  nginx.conf  scgi_params	special.how  uwsgi_params  win-utf
root@dapi-test-pod:/# cat /etc/nginx/special.how
very
root@dapi-test-pod:/#
```

參考文檔：

* [ConfigMap](https://kubernetes.io/docs/tasks/configure-pod-container/configure-pod-configmap/)
