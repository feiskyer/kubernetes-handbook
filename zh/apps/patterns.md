# 一般准则

- 分离构建和运行环境
- 使用`dumb-int`等避免僵尸进程
- 不推荐直接使用Pod，而是推荐使用Deployment/DaemonSet等
- 不推荐在容器中使用后台进程，而是推荐将进程前台运行，并使用探针保证服务确实在运行中
- 推荐容器中应用日志打到stdout和stderr，方便日志插件的处理
- 由于容器采用了COW，大量数据写入有可能会有性能问题，推荐将数据写入到Volume中
- 不推荐生产环境镜像使用`latest`标签，但开发环境推荐使用并设置`imagePullPolicy`为`Always`
- 推荐使用Readiness探针检测服务是否真正运行起来了
- 使用`activeDeadlineSeconds`避免快速失败的Job无限重启
- 引入Sidecar处理代理、请求速率控制和连接控制等问题

## 分离构建和运行环境

注意分离构建和运行环境，直接通过Dockerfile构建的镜像不仅体积大，包含了很多运行时不必要的包，并且还容易引入安全隐患，如包含了应用的源代码。

可以使用[Docker多阶段构建](https://docs.docker.com/engine/userguide/eng-image/multistage-build/)来简化这个步骤。

```Dockerfile
FROM golang:1.7.3 as builder
WORKDIR /go/src/github.com/alexellis/href-counter/
RUN go get -d -v golang.org/x/net/html
COPY app.go    .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o app .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /go/src/github.com/alexellis/href-counter/app .
CMD ["./app"]
```

## 僵尸进程和孤儿进程

- 孤儿进程：一个父进程退出，而它的一个或多个子进程还在运行，那么那些子进程将成为孤儿进程。孤儿进程将被init进程(进程号为1)所收养，并由init进程对它们完成状态收集工作。
- 僵尸进程：一个进程使用fork创建子进程，如果子进程退出，而父进程并没有调用wait或waitpid获取子进程的状态信息，那么子进程的进程描述符仍然保存在系统中。

在容器中，很容易掉进的一个陷阱就是init进程没有正确处理SIGTERM等退出信号。这种情景很容易构造出来，比如

```sh
# 首先运行一个容器
$ docker run busybox sleep 10000

# 打开另外一个terminal
$ ps uax | grep sleep
sasha    14171  0.0  0.0 139736 17744 pts/18   Sl+  13:25   0:00 docker run busybox sleep 10000
root     14221  0.1  0.0   1188     4 ?        Ss   13:25   0:00 sleep 10000

# 接着kill掉第一个进程
$ kill 14171
# 现在会发现sleep进程并没有退出
$ ps uax | grep sleep
root     14221  0.0  0.0   1188     4 ?        Ss   13:25   0:00 sleep 10000
```

解决方法就是保证容器的init进程可以正确处理SIGTERM等退出信号，比如使用dumb-init

```sh
$ docker run quay.io/gravitational/debian-tall /usr/bin/dumb-init /bin/sh -c "sleep 10000"
```

## 参考文档

- [Kubernetes Production Patterns](https://github.com/gravitational/workshop/blob/master/k8sprod.md)
