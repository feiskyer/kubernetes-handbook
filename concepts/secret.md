# Secret

Secret 解決了密碼、token、密鑰等敏感數據的配置問題，而不需要把這些敏感數據暴露到鏡像或者 Pod Spec 中。Secret 可以以 Volume 或者環境變量的方式使用。

## Secret 類型

Secret 有三種類型：
* Opaque：base64 編碼格式的 Secret，用來存儲密碼、密鑰等；但數據也通過 base64 --decode 解碼得到原始數據，所有加密性很弱。
* `kubernetes.io/dockerconfigjson`：用來存儲私有 docker registry 的認證信息。
* `kubernetes.io/service-account-token`： 用於被 serviceaccount 引用。serviceaccout 創建時 Kubernetes 會默認創建對應的 secret。Pod 如果使用了 serviceaccount，對應的 secret 會自動掛載到 Pod 的 `/run/secrets/kubernetes.io/serviceaccount` 目錄中。

備註：serviceaccount 用來使得 Pod 能夠訪問 Kubernetes API

## API 版本對照表

| Kubernetes 版本 | Core API 版本 |
| --------------- | ------------- |
| v1.5+           | core/v1       |

## Opaque Secret

Opaque 類型的數據是一個 map 類型，要求 value 是 base64 編碼格式：

```sh
$ echo -n "admin" | base64
YWRtaW4=
$ echo -n "1f2d1e2e67df" | base64
MWYyZDFlMmU2N2Rm
```

secrets.yml

```yml
apiVersion: v1
kind: Secret
metadata:
  name: mysecret
type: Opaque
data:
  password: MWYyZDFlMmU2N2Rm
  username: YWRtaW4=
```

創建 secret：`kubectl create -f secrets.yml`。
```sh
# kubectl get secret
NAME                  TYPE                                  DATA      AGE
default-token-cty7p   kubernetes.io/service-account-token   3         45d
mysecret              Opaque                                2         7s
```
注意：其中 default-token-cty7p 為創建集群時默認創建的 secret，被 serviceacount/default 引用。

如果是從文件創建 secret，則可以用更簡單的 kubectl 命令，比如創建 tls 的 secret：

```sh
$ kubectl create secret generic helloworld-tls \
  --from-file=key.pem \
  --from-file=cert.pem
```

## Opaque Secret 的使用

創建好 secret 之後，有兩種方式來使用它：

* 以 Volume 方式
* 以環境變量方式

### 將 Secret 掛載到 Volume 中

```yml
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

查看 Pod 中對應的信息：
```sh
# ls /etc/secrets
password  username
# cat  /etc/secrets/username
admin
# cat  /etc/secrets/password
1f2d1e2e67df
```

### 將 Secret 導出到環境變量中


```yml
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

### 將 Secret 掛載指定的 key
```yml
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
創建 Pod 成功後，可以在對應的目錄看到：
```sh
# kubectl exec db ls /etc/secrets/tst
psd
usr
```

** 注意 **：

1、`kubernetes.io/dockerconfigjson` 和 `kubernetes.io/service-account-token` 類型的 secret 也同樣可以被掛載成文件 (目錄)。
如果使用 `kubernetes.io/dockerconfigjson` 類型的 secret 會在目錄下創建一個. dockercfg 文件
```sh
root@db:/etc/secrets# ls -al
total 4
drwxrwxrwt  3 root root  100 Aug  5 16:06 .
drwxr-xr-x 42 root root 4096 Aug  5 16:06 ..
drwxr-xr-x  2 root root   60 Aug  5 16:06 ..8988_06_08_00_06_52.433429084
lrwxrwxrwx  1 root root   31 Aug  5 16:06 ..data -> ..8988_06_08_00_06_52.433429084
lrwxrwxrwx  1 root root   17 Aug  5 16:06 .dockercfg -> ..data/.dockercfg
```
如果使用 `kubernetes.io/service-account-token` 類型的 secret 則會創建 ca.crt，namespace，token 三個文件
```sh
root@db:/etc/secrets# ls
ca.crt	namespace  token
```
2、secrets 使用時被掛載到一個臨時目錄，Pod 被刪除後 secrets 掛載時生成的文件也會被刪除。
```sh
root@db:/etc/secrets# df
Filesystem     1K-blocks    Used Available Use% Mounted on
none           123723748 4983104 112432804   5% /
tmpfs            1957660       0   1957660   0% /dev
tmpfs            1957660       0   1957660   0% /sys/fs/cgroup
/dev/vda1       51474044 2444568  46408092   6% /etc/hosts
tmpfs            1957660      12   1957648   1% /etc/secrets
/dev/vdb       123723748 4983104 112432804   5% /etc/hostname
shm                65536       0     65536   0% /dev/shm
```
但如果在 Pod 運行的時候，在 Pod 部署的節點上還是可以看到：
```sh
# 查看 Pod 中容器 Secret 的相關信息，其中 4392b02d-79f9-11e7-a70a-525400bc11f0 為 Pod 的 UUID
"Mounts": [
  {
    "Source": "/var/lib/kubelet/pods/4392b02d-79f9-11e7-a70a-525400bc11f0/volumes/kubernetes.io~secret/secrets",
    "Destination": "/etc/secrets",
    "Mode": "ro",
    "RW": false,
    "Propagation": "rprivate"
  }
]
#在 Pod 部署的節點查看
root@VM-0-178-ubuntu:/var/lib/kubelet/pods/4392b02d-79f9-11e7-a70a-525400bc11f0/volumes/kubernetes.io~secret/secrets# ls -al
total 4
drwxrwxrwt 3 root root  140 Aug  6 00:15 .
drwxr-xr-x 3 root root 4096 Aug  6 00:15 ..
drwxr-xr-x 2 root root  100 Aug  6 00:15 ..8988_06_08_00_15_14.253276142
lrwxrwxrwx 1 root root   31 Aug  6 00:15 ..data -> ..8988_06_08_00_15_14.253276142
lrwxrwxrwx 1 root root   13 Aug  6 00:15 ca.crt -> ..data/ca.crt
lrwxrwxrwx 1 root root   16 Aug  6 00:15 namespace -> ..data/namespace
lrwxrwxrwx 1 root root   12 Aug  6 00:15 token -> ..data/token
```

## kubernetes.io/dockerconfigjson

可以直接用 kubectl 命令來創建用於 docker registry 認證的 secret：

```sh
$ kubectl create secret docker-registry myregistrykey --docker-server=DOCKER_REGISTRY_SERVER --docker-username=DOCKER_USER --docker-password=DOCKER_PASSWORD --docker-email=DOCKER_EMAIL
secret "myregistrykey" created.
```
查看 secret 的內容：
```sh
# kubectl get secret myregistrykey  -o yaml
apiVersion: v1
data:
  .dockercfg: eyJjY3IuY2NzLnRlbmNlbnR5dW4uY29tL3RlbmNlbnR5dW4iOnsidXNlcm5hbWUiOiIzMzIxMzM3OTk0IiwicGFzc3dvcmQiOiIxMjM0NTYuY29tIiwiZW1haWwiOiIzMzIxMzM3OTk0QHFxLmNvbSIsImF1dGgiOiJNek15TVRNek56azVORG94TWpNME5UWXVZMjl0In19
kind: Secret
metadata:
  creationTimestamp: 2017-08-04T02:06:05Z
  name: myregistrykey
  namespace: default
  resourceVersion: "1374279324"
  selfLink: /api/v1/namespaces/default/secrets/myregistrykey
  uid: 78f6a423-78b9-11e7-a70a-525400bc11f0
type: kubernetes.io/dockercfg
```

通過 base64 對 secret 中的內容解碼：
```sh
# echo "eyJjY3IuY2NzLnRlbmNlbnR5dW4uY29tL3RlbmNlbnR5dW4iOnsidXNlcm5hbWUiOiIzMzIxMzM3OTk0IiwicGFzc3dvcmQiOiIxMjM0NTYuY29tIiwiZW1haWwiOiIzMzIxMzM3OTk0QHFxLmNvbSIsImF1dGgiOiJNek15TVRNek56azVORG94TWpNME5UWXVZMjl0XXXX" | base64 --decode
{"ccr.ccs.tencentyun.com/XXXXXXX":{"username":"3321337XXX","password":"123456.com","email":"3321337XXX@qq.com","auth":"MzMyMTMzNzk5NDoxMjM0NTYuY29t"}}
```

也可以直接讀取 `~/.dockercfg` 的內容來創建：

```sh
$ kubectl create secret docker-registry myregistrykey \
  --from-file="~/.dockercfg"
```

在創建 Pod 的時候，通過 `imagePullSecrets` 來引用剛創建的 `myregistrykey`:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: foo
spec:
  containers:
    - name: foo
      image: janedoe/awesomeapp:v1
  imagePullSecrets:
    - name: myregistrykey
```

### kubernetes.io/service-account-token

`kubernetes.io/service-account-token`： 用於被 serviceaccount 引用。serviceaccout 創建時 Kubernetes 會默認創建對應的 secret。Pod 如果使用了 serviceaccount，對應的 secret 會自動掛載到 Pod 的 `/run/secrets/kubernetes.io/serviceaccount` 目錄中。

```sh
$ kubectl run nginx --image nginx
deployment "nginx" created
$ kubectl get pods
NAME                     READY     STATUS    RESTARTS   AGE
nginx-3137573019-md1u2   1/1       Running   0          13s
$ kubectl exec nginx-3137573019-md1u2 ls /run/secrets/kubernetes.io/serviceaccount
ca.crt
namespace
token
```

## 存儲加密

v1.7 + 版本支持將 Secret 數據加密存儲到 etcd 中，只需要在 apiserver 啟動時配置 `--experimental-encryption-provider-config`。加密配置格式為

```yaml
kind: EncryptionConfig
apiVersion: v1
resources:
  - resources:
    - secrets
    providers:
    - aescbc:
        keys:
        - name: key1
          secret: c2VjcmV0IGlzIHNlY3VyZQ==
        - name: key2
          secret: dGhpcyBpcyBwYXNzd29yZA==
    - identity: {}
    - aesgcm:
        keys:
        - name: key1
          secret: c2VjcmV0IGlzIHNlY3VyZQ==
        - name: key2
          secret: dGhpcyBpcyBwYXNzd29yZA==
    - secretbox:
        keys:
        - name: key1
          secret: YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY=
```

其中

- resources.resources 是 Kubernetes 的資源名
- resources.providers 是加密方法，支持以下幾種
  - identity：不加密
  - aescbc：AES-CBC 加密
  - secretbox：XSalsa20 和 Poly1305 加密
  - aesgcm：AES-GCM 加密

Secret 是在寫存儲的時候加密，因而可以對已有的 secret 執行 update 操作來保證所有的 secrets 都加密

```sh
kubectl get secrets -o json | kubectl update -f -
```

如果想取消 secret 加密的話，只需要把 `identity` 放到 providers 的第一個位置即可（aescbc 還要留著以便訪問已存儲的 secret）：

```yaml
kind: EncryptionConfig
apiVersion: v1
resources:
  - resources:
    - secrets
    providers:
    - identity: {}
    - aescbc:
        keys:
        - name: key1
          secret: c2VjcmV0IGlzIHNlY3VyZQ==
        - name: key2
          secret: dGhpcyBpcyBwYXNzd29yZA==
```

## Secret 與 ConfigMap 對比

相同點：
- key/value 的形式
- 屬於某個特定的 namespace
- 可以導出到環境變量
- 可以通過目錄 / 文件形式掛載 (支持掛載所有 key 和部分 key)

不同點：
- Secret 可以被 ServerAccount 關聯 (使用)
- Secret 可以存儲 register 的鑑權信息，用在 ImagePullSecret 參數中，用於拉取私有倉庫的鏡像
- Secret 支持 Base64 加密
- Secret 分為 Opaque，kubernetes.io/Service Account，kubernetes.io/dockerconfigjson 三種類型, Configmap 不區分類型
- Secret 文件存儲在 tmpfs 文件系統中，Pod 刪除後 Secret 文件也會對應的刪除。


## 參考文檔

- [Secret](https://kubernetes.io/docs/concepts/configuration/secret/)
- [Specifying ImagePullSecrets on a Pod](https://kubernetes.io/docs/concepts/configuration/secret/)
