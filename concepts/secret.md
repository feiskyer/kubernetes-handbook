# Secret

Secret解决了密码、token、密钥等敏感数据的配置问题，而不需要把这些敏感数据暴露到镜像或者Pod Spec中。Secret可以以Volume或者环境变量的方式使用。

## Secret类型

Secret有三种类型：

* Service Account：用来访问Kubernetes API，由Kubernetes自动创建，并且会自动挂载到Pod的`/run/secrets/kubernetes.io/serviceaccount`目录中；
* Opaque：base64编码格式的Secret，用来存储密码、密钥等；
* `kubernetes.io/dockerconfigjson`：用来存储私有docker registry的认证信息。

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

如果是从文件创建secret，则可以用更简单的kubectl命令，比如创建tls的secret：

```sh
$ kubectl create secret generic helloworld-tls \
  --from-file=key.pem \
  --from-file=cert.pem
```

## Secret引用

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
- Configmap不区分类型，Secret分为Opaque，Service Account，kubernetes.io/dockerconfigjson三种类型
