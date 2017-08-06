# Secret

Secret解决了密码、token、密钥等敏感数据的配置问题，而不需要把这些敏感数据暴露到镜像或者Pod Spec中。Secret可以以Volume或者环境变量的方式使用。

## Secret类型

Secret有三种类型：
* Opaque：base64编码格式的Secret，用来存储密码、密钥等；但数据也通过base64 --decode解码得到原始数据，所有加密性很弱。
* `kubernetes.io/dockerconfigjson`：用来存储私有docker registry的认证信息。
* `kubernetes.io/service-account-token`： 用于被serviceaccount引用。serviceaccout创建时Kubernetes会默认创建对应的secret。Pod如果使用了serviceaccount，对应的secret会自动挂载到Pod的`/run/secrets/kubernetes.io/serviceaccount`目录中。

备注： 
serviceaccount用来使得Pod能够访问Kubernetes API

## Opaque Secret

Opaque类型的数据是一个map类型，要求value是base64编码格式：

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

创建secret：`kubectl create -f secrets.yml`。
```sh
# kubectl get secret
NAME                  TYPE                                  DATA      AGE
default-token-cty7p   kubernetes.io/service-account-token   3         45d
mysecret              Opaque                                2         7s
```
注意：其中default-token-cty7p为创建集群时默认创建的secret，被serviceacount/default引用。

如果是从文件创建secret，则可以用更简单的kubectl命令，比如创建tls的secret：

```sh
$ kubectl create secret generic helloworld-tls \
  --from-file=key.pem \
  --from-file=cert.pem
```

## Opaque Secret的使用

创建好secret之后，有两种方式来使用它： 

* 以Volume方式
* 以环境变量方式

### 将Secret挂载到Volume中

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

查看Pod中对应的信息：
```sh
# ls /etc/secrets
password  username
# cat  /etc/secrets/username
admin
# cat  /etc/secrets/password
1f2d1e2e67df
```

### 将Secret导出到环境变量中


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

### 将Secret挂载指定的key
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
创建Pod成功后，可以在对应的目录看到：
```sh
# kubectl exec db ls /etc/secrets/tst 
psd
usr
```

**注意**：

1、`kubernetes.io/dockerconfigjson`和`kubernetes.io/service-account-token`类型的secret也同样可以被挂载成文件(目录)。
如果使用`kubernetes.io/dockerconfigjson`类型的secret会在目录下创建一个.dockercfg文件
```sh
root@db:/etc/secrets# ls -al
total 4
drwxrwxrwt  3 root root  100 Aug  5 16:06 .
drwxr-xr-x 42 root root 4096 Aug  5 16:06 ..
drwxr-xr-x  2 root root   60 Aug  5 16:06 ..8988_06_08_00_06_52.433429084
lrwxrwxrwx  1 root root   31 Aug  5 16:06 ..data -> ..8988_06_08_00_06_52.433429084
lrwxrwxrwx  1 root root   17 Aug  5 16:06 .dockercfg -> ..data/.dockercfg
```
如果使用`kubernetes.io/service-account-token`类型的secret则会创建ca.crt，namespace，token三个文件
```sh
root@db:/etc/secrets# ls
ca.crt	namespace  token
```
2、secrets使用时被挂载到一个临时目录，Pod被删除后secrets挂载时生成的文件也会被删除。
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
但如果在Pod运行的时候，在Pod部署的节点上还是可以看到：
```sh
# 查看Pod中容器Secret的相关信息，其中4392b02d-79f9-11e7-a70a-525400bc11f0为Pod的UUID
"Mounts": [
  {
    "Source": "/var/lib/kubelet/pods/4392b02d-79f9-11e7-a70a-525400bc11f0/volumes/kubernetes.io~secret/secrets",
    "Destination": "/etc/secrets",
    "Mode": "ro",
    "RW": false,
    "Propagation": "rprivate"
  }
]
#在Pod部署的节点查看
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

可以直接用kubectl命令来创建用于docker registry认证的secret：

```sh
$ kubectl create secret docker-registry myregistrykey --docker-server=DOCKER_REGISTRY_SERVER --docker-username=DOCKER_USER --docker-password=DOCKER_PASSWORD --docker-email=DOCKER_EMAIL
secret "myregistrykey" created.
```

也可以直接读取`~/.dockercfg`的内容来创建：

```sh
$ kubectl create secret docker-registry myregistrykey \
  --from-file="~/.dockercfg"
```

在创建Pod的时候，通过`imagePullSecrets`来引用刚创建的`myregistrykey`:

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

### Service Account

Service Account用来访问Kubernetes API，由Kubernetes自动创建，并且会自动挂载到Pod的`/run/secrets/kubernetes.io/serviceaccount`目录中。

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

v1.7+版本支持将Secret数据加密存储到etcd中，只需要在apiserver启动时配置`--experimental-encryption-provider-config`。加密配置格式为

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

- resources.resources是Kubernetes的资源名
- resources.providers是加密方法，支持以下几种
  - identity：不加密
  - aescbc：AES-CBC加密
  - secretbox：XSalsa20和Poly1305加密
  - aesgcm：AES-GCM加密

Secret是在写存储的时候加密，因而可以对已有的secret执行update操作来保证所有的secrets都加密

```sh
kubectl get secrets -o json | kubectl update -f -
```

如果想取消secret加密的话，只需要把`identity`放到providers的第一个位置即可（aescbc还要留着以便访问已存储的secret）：

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

## Secret与ConfigMap对比

相同点：
- key/value的形式
- 属于某个特定的namespace
- 可以导出到环境变量
- 可以通过目录/文件形式挂载(支持挂载所有key和部分key)

不同点：
- Secret可以被ServerAccount关联(使用)
- Secret可以存储register的鉴权信息，用在ImagePullSecret参数中，用于拉取私有仓库的镜像
- Secret支持Base64加密
- Secret分为Opaque，kubernetes.io/Service Account，kubernetes.io/dockerconfigjson三种类型,Configmap不区分类型
- Secret文件存储在tmpfs文件系统中，Pod删除后Secret文件也会对应的删除。


## 参考文档

- [Secret](https://kubernetes.io/docs/concepts/configuration/secret/)