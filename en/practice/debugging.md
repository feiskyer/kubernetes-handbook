# 调试运行中的容器

对于普通的服务器进程，我们可以很方便的使用宿主机上的各种工具来调试；但容器经常是仅包含必要的应用程序，一般不包含常用的调试工具，那如何在线调试容器中的进程呢？最简单的方法是再起一个新的包含了调试工具的容器。

来看一个最简单的 web 容器如何调试。

### webserver 容器

用 Go 编写一个最简单的 webserver：

```go
// go-examples/basic/webserver
package main

import "net/http"
import "fmt"
import "log"

func index(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintln(w, "Hello World")
}

func main() {
	http.HandleFunc("/", index)
	err := http.ListenAndServe(":80", nil)
	if err != nil {

		log.Println(err)
	}
}
```

以 linux 平台方式编译

```sh
GOOS=linux go build -o webserver
```

然后用下面的 Docker build 一个 docker 镜像：

```
FROM scratch

COPY ./webserver /
CMD ["/webserver"]
```

```sh
# docker build -t feisky/hello-world .
Sending build context to Docker daemon 5.655 MB
Step 1/3 : FROM scratch
 --->
Step 2/3 : COPY ./webserver /
 ---> 184eb7c074b5
Removing intermediate container abf107844295
Step 3/3 : CMD /webserver
 ---> Running in fe9fa4841e70
 ---> dca5ec00b3e7
Removing intermediate container fe9fa4841e70
Successfully built dca5ec00b3e7
```

最后启动 webserver 容器

```sh
docker run -itd --name webserver -p 80:80 feisky/hello-world
```

访问映射后的 80 端口，webserver 容器正常返回 "Hello World"

```sh
# curl http://$(hostname):80
Hello World
```

### 新建一个容器调试 webserver

用一个包含调试工具或者方便安装调试工具的镜像（如 alpine）创建一个新的 container，为了便于获取 webserver 进程的状态，新的容器共享 webserver 容器的 pid namespace 和 net namespace，并增加必要的 capability：

```sh
docker run -it --rm --pid=container:webserver --net=container:webserver --cap-add sys_admin --cap-add sys_ptrace alpine sh
/ # ps -ef
PID   USER     TIME   COMMAND
    1 root       0:00 /webserver
   13 root       0:00 sh
   18 root       0:00 ps -ef
```

这样，新的容器可以直接 attach 到 webserver 进程上来在线调试，比如 strace 到 webserver 进程

```sh
# 继续在刚创建的新容器 sh 中执行
/ # apk update && apk add strace
fetch http://dl-cdn.alpinelinux.org/alpine/v3.5/main/x86_64/APKINDEX.tar.gz
fetch http://dl-cdn.alpinelinux.org/alpine/v3.5/community/x86_64/APKINDEX.tar.gz
v3.5.1-34-g1d3b13bd53 [http://dl-cdn.alpinelinux.org/alpine/v3.5/main]
v3.5.1-29-ga981b1f149 [http://dl-cdn.alpinelinux.org/alpine/v3.5/community]
OK: 7958 distinct packages available
(1/1) Installing strace (4.14-r0)
Executing busybox-1.25.1-r0.trigger
OK: 5 MiB in 12 packages
/ # strace -p 1
strace: Process 1 attached
epoll_wait(4,
^Cstrace: Process 1 detached
 <detached ...>
```

也可以获取 webserver 容器的网络状态

```sh
# 继续在刚创建的新容器 sh 中执行
/ # apk add lsof
(1/1) Installing lsof (4.89-r0)
Executing busybox-1.25.1-r0.trigger
OK: 5 MiB in 13 packages
/ # lsof -i TCP
COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
webserver   1 root    3u  IPv6  14233      0t0  TCP *:http (LISTEN)
```

当然，也可以访问 webserver 容器的文件系统

```sh
/ # ls -l /proc/1/root/
total 5524
drwxr-xr-x    5 root     root           360 Feb 14 13:16 dev
drwxr-xr-x    2 root     root          4096 Feb 14 13:16 etc
dr-xr-xr-x  128 root     root             0 Feb 14 13:16 proc
dr-xr-xr-x   13 root     root             0 Feb 14 13:16 sys
-rwxr-xr-x    1 root     root       5651357 Feb 14 13:15 webserver
```

Kubernetes 社区也在提议增加一个 `kubectl debug` 命令，用类似的方式在 Pod 中启动一个新容器来调试运行中的进程，可以参见 <https://github.com/kubernetes/community/pull/649>。
