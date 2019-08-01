# 一般準則

- 分離構建和運行環境
- 使用`dumb-int`等避免殭屍進程
- 不推薦直接使用Pod，而是推薦使用Deployment/DaemonSet等
- 不推薦在容器中使用後臺進程，而是推薦將進程前臺運行，並使用探針保證服務確實在運行中
- 推薦容器中應用日誌打到stdout和stderr，方便日誌插件的處理
- 由於容器採用了COW，大量數據寫入有可能會有性能問題，推薦將數據寫入到Volume中
- 不推薦生產環境鏡像使用`latest`標籤，但開發環境推薦使用並設置`imagePullPolicy`為`Always`
- 推薦使用Readiness探針檢測服務是否真正運行起來了
- 使用`activeDeadlineSeconds`避免快速失敗的Job無限重啟
- 引入Sidecar處理代理、請求速率控制和連接控制等問題

## 分離構建和運行環境

注意分離構建和運行環境，直接通過Dockerfile構建的鏡像不僅體積大，包含了很多運行時不必要的包，並且還容易引入安全隱患，如包含了應用的源代碼。

可以使用[Docker多階段構建](https://docs.docker.com/engine/userguide/eng-image/multistage-build/)來簡化這個步驟。

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

## 殭屍進程和孤兒進程

- 孤兒進程：一個父進程退出，而它的一個或多個子進程還在運行，那麼那些子進程將成為孤兒進程。孤兒進程將被init進程(進程號為1)所收養，並由init進程對它們完成狀態收集工作。
- 殭屍進程：一個進程使用fork創建子進程，如果子進程退出，而父進程並沒有調用wait或waitpid獲取子進程的狀態信息，那麼子進程的進程描述符仍然保存在系統中。

在容器中，很容易掉進的一個陷阱就是init進程沒有正確處理SIGTERM等退出信號。這種情景很容易構造出來，比如

```sh
# 首先運行一個容器
$ docker run busybox sleep 10000

# 打開另外一個terminal
$ ps uax | grep sleep
sasha    14171  0.0  0.0 139736 17744 pts/18   Sl+  13:25   0:00 docker run busybox sleep 10000
root     14221  0.1  0.0   1188     4 ?        Ss   13:25   0:00 sleep 10000

# 接著kill掉第一個進程
$ kill 14171
# 現在會發現sleep進程並沒有退出
$ ps uax | grep sleep
root     14221  0.0  0.0   1188     4 ?        Ss   13:25   0:00 sleep 10000
```

解決方法就是保證容器的init進程可以正確處理SIGTERM等退出信號，比如使用dumb-init

```sh
$ docker run quay.io/gravitational/debian-tall /usr/bin/dumb-init /bin/sh -c "sleep 10000"
```

## 參考文檔

- [Kubernetes Production Patterns](https://github.com/gravitational/workshop/blob/master/k8sprod.md)
