# Secret

Secret 解决了密码、token、密钥等敏感数据的配置问题，而不需要把这些敏感数据暴露到镜像或者 Pod Spec 中。Secret 可以以 Volume 或者环境变量的方式使用。

## Secret 类型

Secret 有三种类型：
* Opaque：base64 编码格式的 Secret，用来存储密码、密钥等；但数据也通过 base64 --decode 解码得到原始数据，所有加密性很弱。
* `kubernetes.io/dockerconfigjson`：用来存储私有 docker registry 的认证信息。
* `kubernetes.io/service-account-token`： 用于被 serviceaccount 引用。serviceaccout 创建时 Kubernetes 会默认创建对应的 secret。Pod 如果使用了 serviceaccount，对应的 secret 会自动挂载到 Pod 的 `/run/secrets/kubernetes.io/serviceaccount` 目录中。

备注：serviceaccount 用来使得 Pod 能够访问 Kubernetes API

## API 版本对照表

| Kubernetes 版本 | Core API 版本 |
| --------------- | ------------- |
| v1.5+           | core/v1       |

## Opaque Secret

Opaque 类型的数据是一个 map 类型，要求 value 是 base64 编码格式：

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

创建 secret：`kubectl create -f secrets.yml`。
```sh
# kubectl get secret
NAME                  TYPE                                  DATA      AGE
default-token-cty7p   kubernetes.io/service-account-token   3         45d
mysecret              Opaque                                2         7s
```
注意：其中 default-token-cty7p 为创建集群时默认创建的 secret，被 serviceacount/default 引用。

如果是从文件创建 secret，则可以用更简单的 kubectl 命令，比如创建 tls 的 secret：

```sh
$ kubectl create secret generic helloworld-tls \
  --from-file=key.pem \
  --from-file=cert.pem
```

## Opaque Secret 的使用

创建好 secret 之后，有两种方式来使用它：

* 以 Volume 方式
* 以环境变量方式

### 将 Secret 挂载到 Volume 中

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

查看 Pod 中对应的信息：
```sh
# ls /etc/secrets
password  username
# cat  /etc/secrets/username
admin
# cat  /etc/secrets/password
1f2d1e2e67df
```

### 将 Secret 导出到环境变量中


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

### 将 Secret 挂载指定的 key
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
创建 Pod 成功后，可以在对应的目录看到：
```sh
# kubectl exec db ls /etc/secrets/tst
psd
usr
```

** 注意 **：

1、`kubernetes.io/dockerconfigjson` 和 `kubernetes.io/service-account-token` 类型的 secret 也同样可以被挂载成文件 (目录)。
如果使用 `kubernetes.io/dockerconfigjson` 类型的 secret 会在目录下创建一个. dockercfg 文件
```sh
root@db:/etc/secrets# ls -al
total 4
drwxrwxrwt  3 root root  100 Aug  5 16:06 .
drwxr-xr-x 42 root root 4096 Aug  5 16:06 ..
drwxr-xr-x  2 root root   60 Aug  5 16:06 ..8988_06_08_00_06_52.433429084
lrwxrwxrwx  1 root root   31 Aug  5 16:06 ..data -> ..8988_06_08_00_06_52.433429084
lrwxrwxrwx  1 root root   17 Aug  5 16:06 .dockercfg -> ..data/.dockercfg
```
如果使用 `kubernetes.io/service-account-token` 类型的 secret 则会创建 ca.crt，namespace，token 三个文件
```sh
root@db:/etc/secrets# ls
ca.crt	namespace  token
```
2、secrets 使用时被挂载到一个临时目录，Pod 被删除后 secrets 挂载时生成的文件也会被删除。
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
但如果在 Pod 运行的时候，在 Pod 部署的节点上还是可以看到：
```sh
# 查看 Pod 中容器 Secret 的相关信息，其中 4392b02d-79f9-11e7-a70a-525400bc11f0 为 Pod 的 UUID
"Mounts": [
  {
    "Source": "/var/lib/kubelet/pods/4392b02d-79f9-11e7-a70a-525400bc11f0/volumes/kubernetes.io~secret/secrets",
    "Destination": "/etc/secrets",
    "Mode": "ro",
    "RW": false,
    "Propagation": "rprivate"
  }
]
#在 Pod 部署的节点查看
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

可以直接用 kubectl 命令来创建用于 docker registry 认证的 secret：

```sh
$ kubectl create secret docker-registry myregistrykey --docker-server=DOCKER_REGISTRY_SERVER --docker-username=DOCKER_USER --docker-password=DOCKER_PASSWORD --docker-email=DOCKER_EMAIL
secret "myregistrykey" created.
```
查看 secret 的内容：
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

通过 base64 对 secret 中的内容解码：
```sh
# echo "eyJjY3IuY2NzLnRlbmNlbnR5dW4uY29tL3RlbmNlbnR5dW4iOnsidXNlcm5hbWUiOiIzMzIxMzM3OTk0IiwicGFzc3dvcmQiOiIxMjM0NTYuY29tIiwiZW1haWwiOiIzMzIxMzM3OTk0QHFxLmNvbSIsImF1dGgiOiJNek15TVRNek56azVORG94TWpNME5UWXVZMjl0XXXX" | base64 --decode
{"ccr.ccs.tencentyun.com/XXXXXXX":{"username":"3321337XXX","password":"123456.com","email":"3321337XXX@qq.com","auth":"MzMyMTMzNzk5NDoxMjM0NTYuY29t"}}
```

也可以直接读取 `~/.dockercfg` 的内容来创建：

```sh
$ kubectl create secret docker-registry myregistrykey \
  --from-file="~/.dockercfg"
```

在创建 Pod 的时候，通过 `imagePullSecrets` 来引用刚创建的 `myregistrykey`:

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

`kubernetes.io/service-account-token`： 用于被 serviceaccount 引用。serviceaccout 创建时 Kubernetes 会默认创建对应的 secret。Pod 如果使用了 serviceaccount，对应的 secret 会自动挂载到 Pod 的 `/run/secrets/kubernetes.io/serviceaccount` 目录中。

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

## 存储加密

v1.7 + 版本支持将 Secret 数据加密存储到 etcd 中，只需要在 apiserver 启动时配置 `--experimental-encryption-provider-config`。加密配置格式为

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

- resources.resources 是 Kubernetes 的资源名
- resources.providers 是加密方法，支持以下几种
  - identity：不加密
  - aescbc：AES-CBC 加密
  - secretbox：XSalsa20 和 Poly1305 加密
  - aesgcm：AES-GCM 加密

Secret 是在写存储的时候加密，因而可以对已有的 secret 执行 update 操作来保证所有的 secrets 都加密

```sh
kubectl get secrets -o json | kubectl update -f -
```

如果想取消 secret 加密的话，只需要把 `identity` 放到 providers 的第一个位置即可（aescbc 还要留着以便访问已存储的 secret）：

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

## Secret 与 ConfigMap 对比

相同点：
- key/value 的形式
- 属于某个特定的 namespace
- 可以导出到环境变量
- 可以通过目录 / 文件形式挂载 (支持挂载所有 key 和部分 key)

不同点：
- Secret 可以被 ServerAccount 关联 (使用)
- Secret 可以存储 register 的鉴权信息，用在 ImagePullSecret 参数中，用于拉取私有仓库的镜像
- Secret 支持 Base64 加密
- Secret 分为 Opaque，kubernetes.io/Service Account，kubernetes.io/dockerconfigjson 三种类型, Configmap 不区分类型
- Secret 文件存储在 tmpfs 文件系统中，Pod 删除后 Secret 文件也会对应的删除。


## 参考文档

- [Secret](https://kubernetes.io/docs/concepts/configuration/secret/)
- [Specifying ImagePullSecrets on a Pod](https://kubernetes.io/docs/concepts/configuration/secret/)
