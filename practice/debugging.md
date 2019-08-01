# 調試運行中的容器

對於普通的服務器進程，我們可以很方便的使用宿主機上的各種工具來調試；但容器經常是僅包含必要的應用程序，一般不包含常用的調試工具，那如何在線調試容器中的進程呢？最簡單的方法是再起一個新的包含了調試工具的容器。

來看一個最簡單的 web 容器如何調試。

### webserver 容器

用 Go 編寫一個最簡單的 webserver：

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

以 linux 平臺方式編譯

```sh
GOOS=linux go build -o webserver
```

然後用下面的 Docker build 一個 docker 鏡像：

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

最後啟動 webserver 容器

```sh
docker run -itd --name webserver -p 80:80 feisky/hello-world
```

訪問映射後的 80 端口，webserver 容器正常返回 "Hello World"

```sh
# curl http://$(hostname):80
Hello World
```

### 新建一個容器調試 webserver

用一個包含調試工具或者方便安裝調試工具的鏡像（如 alpine）創建一個新的 container，為了便於獲取 webserver 進程的狀態，新的容器共享 webserver 容器的 pid namespace 和 net namespace，並增加必要的 capability：

```sh
docker run -it --rm --pid=container:webserver --net=container:webserver --cap-add sys_admin --cap-add sys_ptrace alpine sh
/ # ps -ef
PID   USER     TIME   COMMAND
    1 root       0:00 /webserver
   13 root       0:00 sh
   18 root       0:00 ps -ef
```

這樣，新的容器可以直接 attach 到 webserver 進程上來在線調試，比如 strace 到 webserver 進程

```sh
# 繼續在剛創建的新容器 sh 中執行
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

也可以獲取 webserver 容器的網絡狀態

```sh
# 繼續在剛創建的新容器 sh 中執行
/ # apk add lsof
(1/1) Installing lsof (4.89-r0)
Executing busybox-1.25.1-r0.trigger
OK: 5 MiB in 13 packages
/ # lsof -i TCP
COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
webserver   1 root    3u  IPv6  14233      0t0  TCP *:http (LISTEN)
```

當然，也可以訪問 webserver 容器的文件系統

```sh
/ # ls -l /proc/1/root/
total 5524
drwxr-xr-x    5 root     root           360 Feb 14 13:16 dev
drwxr-xr-x    2 root     root          4096 Feb 14 13:16 etc
dr-xr-xr-x  128 root     root             0 Feb 14 13:16 proc
dr-xr-xr-x   13 root     root             0 Feb 14 13:16 sys
-rwxr-xr-x    1 root     root       5651357 Feb 14 13:15 webserver
```

Kubernetes 社區也在提議增加一個 `kubectl debug` 命令，用類似的方式在 Pod 中啟動一個新容器來調試運行中的進程，可以參見 <https://github.com/kubernetes/community/pull/649>。
