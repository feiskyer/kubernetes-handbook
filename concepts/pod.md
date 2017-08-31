# Pod

Pod是一组紧密关联的容器集合，它们共享IPC、Network和UTC namespace，是Kubernetes调度的基本单位。Pod的设计理念是支持多个容器在一个Pod中共享网络和文件系统，可以通过进程间通信和文件共享这种简单高效的方式组合完成服务。

![pod](images/pod.png)

Pod的特征

- 包含多个共享IPC、Network和UTC namespace的容器，可直接通过localhost通信
- 所有Pod内容器都可以访问共享的Volume，可以访问共享数据
- 无容错性：直接创建的Pod一旦被调度后就跟Node绑定，即使Node挂掉也不会被重新调度（而是被自动删除），因此推荐使用Deployment、Daemonset等控制器来容错
- 优雅终止：Pod删除的时候先给其内的进程发送SIGTERM，等待一段时间（grace period）后才强制停止依然还在运行的进程
- 特权容器（通过SecurityContext配置）具有改变系统配置的权限（在网络插件中大量应用）

## Pod定义

通过yaml或json描述Pod和其内Container的运行环境以及期望状态，比如一个最简单的nginx pod可以定义为

```yaml
apiVersion: v1
kind: Pod
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

## 使用Volume

Volume可以为容器提供持久化存储，比如

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: redis
spec:
  containers:
  - name: redis
    image: redis
    volumeMounts:
    - name: redis-storage
      mountPath: /data/redis
  volumes:
  - name: redis-storage
    emptyDir: {}
```

更多挂载存储卷的方法参考[Volume](volume.md)。

## 私有镜像

在使用私有镜像时，需要创建一个docker registry secret，并在容器中引用。

创建docker registry secret：

```sh
kubectl create secret docker-registry regsecret --docker-server=<your-registry-server> --docker-username=<your-name> --docker-password=<your-pword> --docker-email=<your-email>
```

容器中引用该secret：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: private-reg
spec:
  containers:
    - name: private-reg-container
      image: <your-private-image>
  imagePullSecrets:
    - name: regsecret
```

## RestartPolicy

支持三种RestartPolicy

- Always：只要退出就重启
- OnFailure：失败退出（exit code不等于0）时重启
- Never：只要退出就不再重启

注意，这里的重启是指在Pod所在Node上面本地重启，并不会调度到其他Node上去。

## 环境变量

环境变量为容器提供了一些重要的资源，包括容器和Pod的基本信息以及集群中服务的信息等：

(1) hostname

`HOSTNAME`环境变量保存了该Pod的hostname。

（2）容器和Pod的基本信息

Pod的名字、命名空间、IP以及容器的计算资源限制等可以以[Downward API](https://kubernetes.io/docs/tasks/inject-data-application/downward-api-volume-expose-pod-information/)的方式获取并存储到环境变量中。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: test
spec:
  containers:
    - name: test-container
      image: gcr.io/google_containers/busybox
      command: [ "sh", "-c"]
      args:
      - env
      resources:
        requests:
          memory: "32Mi"
          cpu: "125m"
        limits:
          memory: "64Mi"
          cpu: "250m"
      env:
        - name: MY_NODE_NAME
          valueFrom:
            fieldRef:
              fieldPath: spec.nodeName
        - name: MY_POD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: MY_POD_NAMESPACE
          valueFrom:
            fieldRef:
              fieldPath: metadata.namespace
        - name: MY_POD_IP
          valueFrom:
            fieldRef:
              fieldPath: status.podIP
        - name: MY_POD_SERVICE_ACCOUNT
          valueFrom:
            fieldRef:
              fieldPath: spec.serviceAccountName
        - name: MY_CPU_REQUEST
          valueFrom:
            resourceFieldRef:
              containerName: test-container
              resource: requests.cpu
        - name: MY_CPU_LIMIT
          valueFrom:
            resourceFieldRef:
              containerName: test-container
              resource: limits.cpu
        - name: MY_MEM_REQUEST
          valueFrom:
            resourceFieldRef:
              containerName: test-container
              resource: requests.memory
        - name: MY_MEM_LIMIT
          valueFrom:
            resourceFieldRef:
              containerName: test-container
              resource: limits.memory
  restartPolicy: Never
```

(3) 集群中服务的信息

容器的环境变量中还可以引用容器运行前创建的所有服务的信息，比如默认的kubernetes服务对应以下环境变量：

```
KUBERNETES_PORT_443_TCP_ADDR=10.0.0.1
KUBERNETES_SERVICE_HOST=10.0.0.1
KUBERNETES_SERVICE_PORT=443
KUBERNETES_SERVICE_PORT_HTTPS=443
KUBERNETES_PORT=tcp://10.0.0.1:443
KUBERNETES_PORT_443_TCP=tcp://10.0.0.1:443
KUBERNETES_PORT_443_TCP_PROTO=tcp
KUBERNETES_PORT_443_TCP_PORT=443
```

由于环境变量存在创建顺序的局限性（环境变量中不包含后来创建的服务），推荐使用[DNS](../components/kube-dns.md)来解析服务。

## ImagePullPolicy

支持三种ImagePullPolicy

- Always：不管镜像是否存在都会进行一次拉取
- Never：不管镜像是否存在都不会进行拉取
- IfNotPresent：只有镜像不存在时，才会进行镜像拉取

注意：  

- 默认为`IfNotPresent`，但`:latest`标签的镜像默认为`Always`。
- 拉取镜像时docker会进行校验，如果镜像中的MD5码没有变，则不会拉取镜像数据。
- 生产环境中应该尽量避免使用`:latest`标签，而开发环境中可以借助`:latest`标签自动拉取最新的镜像。

## 访问DNS的策略

通过设置dnsPolicy参数，设置Pod中容器访问DNS的策略

- ClusterFirst：优先基于cluster domain后缀，通过kube-dns查询 (默认策略)
- Default：优先从kubelet中配置的DNS查询

## 使用主机的IPC命名空间

通过设置`spec.hostIPC`参数为true，使用主机的IPC命名空间，默认为false。

## 使用主机的网络命名空间

通过设置`spec.hostNetwork`参数为true，使用主机的网络命名空间，默认为false。

## 使用主机的PID空间

通过设置`spec.hostPID`参数为true，使用主机的PID命名空间，默认为false。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: busybox1
  labels:
    name: busybox
spec:
  hostIPC: true
  hostPID: true
  hostNetwork: true
  containers:
  - image: busybox
    command:
      - sleep
      - "3600"
    name: busybox
```

## 设置Pod的hostname

通过`spec.hostname`参数实现，如果未设置默认使用`metadata.name`参数的值作为Pod的hostname。

## 设置Pod的子域名

通过`spec.subdomain`参数设置Pod的子域名，默认为空。

比如，指定hostname为busybox-2和subdomain为default-subdomain，完整域名为`busybox-2.default-subdomain.default.svc.cluster.local`，也可以简写为`busybox-2.default-subdomain.default`：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: busybox2
  labels:
    name: busybox
spec:
  hostname: busybox-2
  subdomain: default-subdomain
  containers:
  - image: busybox
    command:
      - sleep
      - "3600"
    name: busybox
```

注意：

- 默认情况下，DNS为Pod生成的A记录格式为`pod-ip-address.my-namespace.pod.cluster.local`，如`1-2-3-4.default.pod.cluster.local`
- 上面的示例还需要在default namespace中创建一个名为`default-subdomain`（即subdomain）的headless service，否则其他Pod无法通过完整域名访问到该Pod（只能自己访问到自己）

```yaml
kind: Service
apiVersion: v1
metadata:
  name: default-subdomain
spec:
  clusterIP: None
  selector:
    name: busybox
  ports:
  - name: foo # Actually, no port is needed.
    port: 1234
    targetPort: 1234
```
注意，必须为headless service设置至少一个服务端口（`spec.ports`，即便它看起来并不需要），否则Pod与Pod之间依然无法通过完整域名来访问。

## 资源限制

Kubernetes通过cgroups限制容器的CPU和内存等计算资源，包括requests（请求，调度器保证调度到资源充足的Node上）和limits（上限）等：

- `spec.containers[].resources.limits.cpu`：CPU上限，可以短暂超过，容器也不会被停止
- `spec.containers[].resources.limits.memory`：内存上限，不可以超过；如果超过，容器可能会被停止或调度到其他资源充足的机器上
- `spec.containers[].resources.requests.cpu`：CPU请求，可以超过
- `spec.containers[].resources.requests.memory`：内存请求，可以超过；但如果超过，容器可能会在Node内存不足时清理

比如nginx容器请求30%的CPU和56MB的内存，但限制最多只用50%的CPU和128MB的内存：

```yaml
apiVersion: v1
kind: Pod
metadata:
  labels:
    app: nginx
  name: nginx
spec:
  containers:
    - image: nginx
      name: nginx
      resources:
        requests:
          cpu: "300m"
          memory: "56Mi"
        limits:
          cpu: "500m"
          memory: "128Mi"
```

注意，CPU的单位是milicpu，500mcpu=0.5cpu；而内存的单位则包括E, P, T, G, M, K, Ei, Pi, Ti, Gi, Mi, Ki等。

## 健康检查

为了确保容器在部署后确实处在正常运行状态，Kubernetes提供了两种探针（Probe）来探测容器的状态：

- LivenessProbe：探测应用是否处于健康状态，如果不健康则删除并重新创建容器
- ReadinessProbe：探测应用是否启动完成并且处于正常服务状态，如果不正常则不会接收来自Kubernetes Service的流量

Kubernetes支持三种方式来执行探针：

- exec：在容器中执行一个命令，如果[命令退出码](http://www.tldp.org/LDP/abs/html/exitcodes.html)返回`0`则表示探测成功，否则表示失败
- tcpSocket：对指定的容器IP及端口执行一个TCP检查，如果端口是开放的则表示探测成功，否则表示失败
- httpGet：对指定的容器IP、端口及路径执行一个HTTP Get请求，如果返回的[状态码](https://en.wikipedia.org/wiki/List_of_HTTP_status_codes)在`[200,400)`之间则表示探测成功，否则表示失败

```yaml
apiVersion: v1
kind: Pod
metadata:
  labels:
    app: nginx
  name: nginx
spec:
    containers:
    - image: nginx
      imagePullPolicy: Always
      name: http
      livenessProbe:
        httpGet:
          path: /
          port: 80
          httpHeaders:
          - name: X-Custom-Header
            value: Awesome
        initialDelaySeconds: 15
        timeoutSeconds: 1
      readinessProbe:
        exec:
          command:
          - cat
          - /usr/share/nginx/html/index.html
        initialDelaySeconds: 5
        timeoutSeconds: 1
    - name: goproxy
      image: gcr.io/google_containers/goproxy:0.1
      ports:
      - containerPort: 8080
      readinessProbe:
        tcpSocket:
          port: 8080
        initialDelaySeconds: 5
        periodSeconds: 10
      livenessProbe:
        tcpSocket:
          port: 8080
        initialDelaySeconds: 15
        periodSeconds: 20
```

## Init Container

Init Container在所有容器运行之前执行（run-to-completion），常用来初始化配置。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: init-demo
spec:
  containers:
  - name: nginx
    image: nginx
    ports:
    - containerPort: 80
    volumeMounts:
    - name: workdir
      mountPath: /usr/share/nginx/html
  # These containers are run during pod initialization
  initContainers:
  - name: install
    image: busybox
    command:
    - wget
    - "-O"
    - "/work-dir/index.html"
    - http://kubernetes.io
    volumeMounts:
    - name: workdir
      mountPath: "/work-dir"
  dnsPolicy: Default
  volumes:
  - name: workdir
    emptyDir: {}
```

## 容器生命周期钩子

容器生命周期钩子（Container Lifecycle Hooks）监听容器生命周期的特定事件，并在事件发生时执行已注册的回调函数。支持两种钩子：

- postStart： 容器创建后立即执行，注意由于是异步执行，它无法保证一定在ENTRYPOINT之前运行。如果失败，容器会被杀死，并根据RestartPolicy决定是否重启
- preStop：容器终止前执行，常用于资源清理。如果失败，容器同样也会被杀死

而钩子的回调函数支持两种方式：

- exec：在容器内执行命令，如果命令的退出状态码是`0`表示执行成功，否则表示失败
- httpGet：向指定URL发起GET请求，如果返回的HTTP状态码在`[200, 400)`之间表示请求成功，否则表示失败

postStart和preStop钩子示例：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: lifecycle-demo
spec:
  containers:
  - name: lifecycle-demo-container
    image: nginx
    lifecycle:
      postStart:
        httpGet:
	  path: /
	  port: 80
      preStop:
        exec:
          command: ["/usr/sbin/nginx","-s","quit"]
```

## 使用Capabilities

默认情况下，容器都是以非特权容器的方式运行。比如，不能在容器中创建虚拟网卡、配置虚拟网络。

Kubernetes提供了修改[Capabilities](http://man7.org/linux/man-pages/man7/capabilities.7.html)的机制，可以按需要给容器增加或删除。比如下面的配置给容器增加了`CAP_NET_ADMIN`并删除了`CAP_KILL`。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: cap-pod
spec:
  containers:
  - name: friendly-container
    image: "alpine:3.4"
    command: ["/bin/sleep", "3600"]
    securityContext:
      capabilities:
        add:
        - NET_ADMIN
        drop:
        - KILL
```

## 限制网络带宽

可以通过给Pod增加`kubernetes.io/ingress-bandwidth`和`kubernetes.io/egress-bandwidth`这两个annotation来限制Pod的网络带宽

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: qos
  annotations:
    kubernetes.io/ingress-bandwidth: 3M
    kubernetes.io/egress-bandwidth: 4M
spec:
  containers:
  - name: iperf3
    image: networkstatic/iperf3
    command:
    - iperf3
    - -s
```

> **[warning] 仅kubenet支持限制带宽**
>
> 目前只有kubenet网络插件支持限制网络带宽，其他CNI网络插件暂不支持这个功能。

kubenet的网络带宽限制其实是通过tc来实现的

```sh
# setup qdisc (only once)
tc qdisc add dev cbr0 root handle 1: htb default 30
# download rate
tc class add dev cbr0 parent 1: classid 1:2 htb rate 3Mbit
tc filter add dev cbr0 protocol ip parent 1:0 prio 1 u32 match ip dst 10.1.0.3/32 flowid 1:2
# upload rate
tc class add dev cbr0 parent 1: classid 1:3 htb rate 4Mbit
tc filter add dev cbr0 protocol ip parent 1:0 prio 1 u32 match ip src 10.1.0.3/32 flowid 1:3
```

## 调度到指定的Node上

可以通过nodeSelector、nodeAffinity、podAffinity以及Taints和tolerations等来将Pod调度到需要的Node上。

也可以通过设置nodeName参数，将Pod调度到指定node节点上。

比如，使用nodeSelector，首先给Node加上标签：

```sh
kubectl label nodes <your-node-name> disktype=ssd
```

接着，指定该Pod只想运行在带有`disktype=ssd`标签的Node上：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
  labels:
    env: test
spec:
  containers:
  - name: nginx
    image: nginx
    imagePullPolicy: IfNotPresent
  nodeSelector:
    disktype: ssd
```

nodeAffinity、podAffinity以及Taints和tolerations等的使用方法请参考[调度器章节](../components/scheduler.md)。

## 自定义hosts

默认情况下，容器的`/etc/hosts`是kubelet自动生成的，并且仅包含localhost和podName等。不建议在容器内直接修改`/etc/hosts`文件，因为在Pod启动或重启时会被覆盖。

默认的`/etc/hosts`文件格式如下，其中`nginx-4217019353-fb2c5`是podName：

```sh
$ kubectl exec nginx-4217019353-fb2c5 -- cat /etc/hosts
# Kubernetes-managed hosts file.
127.0.0.1	localhost
::1	localhost ip6-localhost ip6-loopback
fe00::0	ip6-localnet
fe00::0	ip6-mcastprefix
fe00::1	ip6-allnodes
fe00::2	ip6-allrouters
10.244.1.4	nginx-4217019353-fb2c5
```

从v1.7开始，可以通过`pod.Spec.HostAliases`来增加hosts内容，如

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: hostaliases-pod
spec:
  hostAliases:
  - ip: "127.0.0.1"
    hostnames:
    - "foo.local"
    - "bar.local"
  - ip: "10.1.2.3"
    hostnames:
    - "foo.remote"
    - "bar.remote"
  containers:
  - name: cat-hosts
    image: busybox
    command:
    - cat
    args:
    - "/etc/hosts"
```

```sh
$ kubectl logs hostaliases-pod
# Kubernetes-managed hosts file.
127.0.0.1	localhost
::1	localhost ip6-localhost ip6-loopback
fe00::0	ip6-localnet
fe00::0	ip6-mcastprefix
fe00::1	ip6-allnodes
fe00::2	ip6-allrouters
10.244.1.5	hostaliases-pod
127.0.0.1	foo.local
127.0.0.1	bar.local
10.1.2.3	foo.remote
10.1.2.3	bar.remote
```

## 参考文档

- [What is Pod?](https://kubernetes.io/docs/concepts/workloads/pods/pod/)
- [Kubernetes Pod Lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)
- [DNS Pods and Services](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/)
- [Container capabilities](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/#set-capabilities-for-a-container)
- [Configure Liveness and Readiness Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-probes/)
- [Linux Capabilities](http://man7.org/linux/man-pages/man7/capabilities.7.html)

