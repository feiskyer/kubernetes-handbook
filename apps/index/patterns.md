# 一般准则

* 分离构建和运行环境
* 使用`dumb-int`等避免僵尸进程
* 不推荐直接使用Pod，而是推荐使用Deployment/DaemonSet等
* 不推荐在容器中使用后台进程，而是推荐将进程前台运行，并使用探针保证服务确实在运行中
* 推荐容器中应用日志打到stdout和stderr，方便日志插件的处理
* 由于容器采用了COW，大量数据写入有可能会有性能问题，推荐将数据写入到Volume中
* 不推荐生产环境镜像使用`latest`标签，但开发环境推荐使用并设置`imagePullPolicy`为`Always`
* 推荐使用Readiness探针检测服务是否真正运行起来了
* 使用`activeDeadlineSeconds`避免快速失败的Job无限重启
* 引入多容器模式（Sidecar、Ambassador、Adapter等）处理代理、请求速率控制和连接控制等问题

## 分离构建和运行环境

注意分离构建和运行环境，直接通过Dockerfile构建的镜像不仅体积大，包含了很多运行时不必要的包，并且还容易引入安全隐患，如包含了应用的源代码。

可以使用[Docker多阶段构建](https://docs.docker.com/engine/userguide/eng-image/multistage-build/)来简化这个步骤。

```text
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

* 孤儿进程：一个父进程退出，而它的一个或多个子进程还在运行，那么那些子进程将成为孤儿进程。孤儿进程将被init进程\(进程号为1\)所收养，并由init进程对它们完成状态收集工作。
* 僵尸进程：一个进程使用fork创建子进程，如果子进程退出，而父进程并没有调用wait或waitpid获取子进程的状态信息，那么子进程的进程描述符仍然保存在系统中。

在容器中，很容易掉进的一个陷阱就是init进程没有正确处理SIGTERM等退出信号。这种情景很容易构造出来，比如

```bash
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

```bash
docker run quay.io/gravitational/debian-tall /usr/bin/dumb-init /bin/sh -c "sleep 10000"
```

## 多容器设计模式

### Sidecar 模式（边车模式）

Sidecar 模式是最常用的多容器模式，通过在Pod中添加辅助容器来扩展主应用的功能，而无需修改主应用代码。

**使用场景：**

- 日志收集和转发
- 监控指标收集
- 网络代理和服务网格
- 配置热更新
- 安全扫描

**优势：**

- 职责分离，每个容器专注单一功能
- 可以独立更新和扩展
- 复用性强，可以跨多个应用使用

### Ambassador 模式（大使模式）

Ambassador 模式通过代理容器来简化主应用对外部服务的访问，处理服务发现、负载均衡、重试逻辑等。

**使用场景：**

- 数据库连接代理
- 外部API访问代理
- 服务发现和负载均衡
- 连接池管理
- 请求路由和熔断

**优势：**

- 简化应用代码，将网络复杂性抽象到代理层
- 可以统一处理连接管理和错误重试
- 便于实现横切关注点

### Adapter 模式（适配器模式）

Adapter 模式用于标准化应用输出，将应用的输出转换为统一的格式或协议。

**使用场景：**

- 监控指标格式转换
- 日志格式标准化
- 协议转换（HTTP到gRPC）
- 数据格式适配

**优势：**

- 不修改应用代码即可适配不同的监控和日志系统
- 提供统一的数据格式
- 便于集成遗留系统

### 配置助手模式

通过专门的配置容器来管理应用配置，实现配置的动态更新和热加载。

**使用场景：**

- 从配置中心拉取配置
- 密钥管理和轮换
- 环境变量动态更新
- 配置文件热重载

**优势：**

- 配置管理与业务逻辑分离
- 支持配置热更新
- 统一的配置管理策略

### Sidecar 启动顺序控制最佳实践

从 Kubernetes v1.29.0 开始，原生支持 Sidecar Init 容器，能够更好地控制容器启动顺序。在 v1.33.0 中达到稳定版本。

**确保 Sidecar 优先启动的策略：**

1. **使用 startupProbe（推荐）**：最可靠的方法，确保主应用等待 Sidecar 就绪
   ```yaml
   initContainers:
   - name: sidecar
     image: nginx
     restartPolicy: Always
     startupProbe:
       httpGet:
         path: /health
         port: 8080
       initialDelaySeconds: 5
       periodSeconds: 3
   ```

2. **应用层依赖处理**：在应用代码中实现对 Sidecar 的容错和重试机制
3. **postStart 钩子**：使用生命周期钩子实现自定义等待逻辑
4. **避免错误做法**：不要依赖 readinessProbe 或 livenessProbe 来控制启动顺序

### 最佳实践

1. **合理选择模式**：根据实际需求选择合适的多容器模式，避免过度设计
2. **资源管理**：为每个容器设置合适的资源限制，避免资源竞争
3. **生命周期管理**：确保容器间的启动顺序和依赖关系
4. **错误处理**：实现容器间的错误传播和重试机制
5. **监控和日志**：为每个容器配置独立的监控和日志收集
6. **启动依赖控制**：使用 startupProbe 确保 Sidecar 容器优先就绪
7. **容错设计**：在应用层面实现对 Sidecar 服务的容错机制

## 参考文档

* [Kubernetes Production Patterns](https://github.com/gravitational/workshop/blob/master/k8sprod.md)
