# 服務滾動升級

當有鏡像發佈新版本，新版本服務上線時如何實現服務的滾動和平滑升級？

如果你使用 **ReplicationController** 創建的 pod 可以使用 `kubectl rollingupdate` 命令滾動升級，如果使用的是 **Deployment** 創建的 Pod 可以直接修改 yaml 文件後執行 `kubectl apply` 即可。

Deployment 已經內置了 RollingUpdate strategy，因此不用再調用 `kubectl rollingupdate` 命令，升級的過程是先創建新版的 pod 將流量導入到新 pod 上後銷燬原來的舊的 pod。

Rolling Update 適用於 `Deployment`、`Replication Controller`，官方推薦使用 Deployment 而不再使用 Replication Controller。

使用 ReplicationController 時的滾動升級請參考官網說明：https://kubernetes.io/docs/tasks/run-application/rolling-update-replication-controller/

## ReplicationController 與 Deployment 的關係

ReplicationController 和 Deployment 的 RollingUpdate 命令有些不同，但是實現的機制是一樣的，關於這兩個 kind 的關係我引用了 [ReplicationController 與 Deployment 的區別](https://segmentfault.com/a/1190000008232770) 中的部分內容如下，詳細區別請查看原文。

### ReplicationController

Replication Controller 為 Kubernetes 的一個核心內容，應用託管到 Kubernetes 之後，需要保證應用能夠持續的運行，Replication Controller 就是這個保證的 key，主要的功能如下：

- 確保 pod 數量：它會確保 Kubernetes 中有指定數量的 Pod 在運行。如果少於指定數量的 pod，Replication Controller 會創建新的，反之則會刪除掉多餘的以保證 Pod 數量不變。
- 確保 pod 健康：當 pod 不健康，運行出錯或者無法提供服務時，Replication Controller 也會殺死不健康的 pod，重新創建新的。
- 彈性伸縮 ：在業務高峰或者低峰期的時候，可以通過 Replication Controller 動態的調整 pod 的數量來提高資源的利用率。同時，配置相應的監控功能（Hroizontal Pod Autoscaler），會定時自動從監控平臺獲取 Replication Controller 關聯 pod 的整體資源使用情況，做到自動伸縮。
- 滾動升級：滾動升級為一種平滑的升級方式，通過逐步替換的策略，保證整體系統的穩定，在初始化升級的時候就可以及時發現和解決問題，避免問題不斷擴大。

### Deployment

Deployment 同樣為 Kubernetes 的一個核心內容，主要職責同樣是為了保證 pod 的數量和健康，90% 的功能與 Replication Controller 完全一樣，可以看做新一代的 Replication Controller。但是，它又具備了 Replication Controller 之外的新特性：

- Replication Controller 全部功能：Deployment 繼承了上面描述的 Replication Controller 全部功能。
- 事件和狀態查看：可以查看 Deployment 的升級詳細進度和狀態。
- 回滾：當升級 pod 鏡像或者相關參數的時候發現問題，可以使用回滾操作回滾到上一個穩定的版本或者指定的版本。
- 版本記錄: 每一次對 Deployment 的操作，都能保存下來，給予後續可能的回滾使用。
- 暫停和啟動：對於每一次升級，都能夠隨時暫停和啟動。
- 多種升級方案：Recreate：刪除所有已存在的 pod, 重新創建新的; RollingUpdate：滾動升級，逐步替換的策略，同時滾動升級時，支持更多的附加參數，例如設置最大不可用 pod 數量，最小升級間隔時間等等。

## 創建測試鏡像

我們來創建一個特別簡單的 web 服務，當你訪問網頁時，將輸出一句版本信息。通過區分這句版本信息輸出我們就可以斷定升級是否完成。

所有配置和代碼見 [manifests/test/rolling-update-test](https://github.com/feiskyer/kubernetes-handbook/tree/master/manifests/test/rolling-update-test) 目錄。

**Web 服務的代碼 main.go**

```go
package main

import (
  "fmt"
  "log"
  "net/http"
)

func sayhello(w http.ResponseWriter, r *http.Request) {
  fmt.Fprintf(w, "This is version 1.") // 這個寫入到 w 的是輸出到客戶端的
}

func main() {
  http.HandleFunc("/", sayhello) // 設置訪問的路由
  log.Println("This is version 1.")
  err := http.ListenAndServe(":9090", nil) // 設置監聽的端口
  if err != nil {
    log.Fatal("ListenAndServe:", err)
  }
}
```

**創建 Dockerfile**

```Dockerfile
FROM alpine:3.5
ADD hellov2 /
ENTRYPOINT ["/hellov2"]
```

注意修改添加的文件的名稱。

** 創建 Makefile**

修改鏡像倉庫的地址為你自己的私有鏡像倉庫地址。

修改 `Makefile` 中的 `TAG` 為新的版本號。

```cmake
all: build push clean
.PHONY: build push clean

TAG = v1

# Build for linux amd64
build:
  GOOS=linux GOARCH=amd64 go build -o hello${TAG} main.go
  docker build -t sz-pg-oam-docker-hub-001.tendcloud.com/library/hello:${TAG} .

# Push to tenxcloud
push:
  docker push sz-pg-oam-docker-hub-001.tendcloud.com/library/hello:${TAG}

# Clean
clean:
  rm -f hello${TAG}
```

** 編譯 **

```Shell
make all
```

分別修改 main.go 中的輸出語句、Dockerfile 中的文件名稱和 Makefile 中的 TAG，創建兩個版本的鏡像。

## 測試

我們使用 Deployment 部署服務來測試。

配置文件 `rolling-update-test.yaml`：

```Yaml
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
    name: rolling-update-test
spec:
  replicas: 3
  template:
    metadata:
      labels:
        app: rolling-update-test
    spec:
      containers:
      - name: rolling-update-test
        image: sz-pg-oam-docker-hub-001.tendcloud.com/library/hello:v1
        ports:
        - containerPort: 9090
---
apiVersion: v1
kind: Service
metadata:
  name: rolling-update-test
  labels:
    app: rolling-update-test
spec:
  ports:
  - port: 9090
    protocol: TCP
    name: http
  selector:
    app: rolling-update-test
```

** 部署 service**

```shell
kubectl create -f rolling-update-test.yaml
```

** 修改 traefik ingress 配置 **

在 `ingress.yaml` 文件中增加新 service 的配置。

```Yaml
  - host: rolling-update-test.traefik.io
    http:
      paths:
      - path: /
        backend:
          serviceName: rolling-update-test
          servicePort: 9090
```

修改本地的 host 配置，增加一條配置：

```
172.20.0.119 rolling-update-test.traefik.io
```

注意：172.20.0.119 是我們之前使用 keepalived 創建的 VIP。

打開瀏覽器訪問 `http://rolling-update-test.traefik.io` 將會看到以下輸出：

```
This is version 1.
```

** 滾動升級 **

只需要將 `rolling-update-test.yaml` 文件中的 `image` 改成新版本的鏡像名，然後執行：

```shell
kubectl apply -f rolling-update-test.yaml
```

也可以參考 [Kubernetes Deployment Concept](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) 中的方法，直接設置新的鏡像。

```
kubectl set image deployment/rolling-update-test rolling-update-test=sz-pg-oam-docker-hub-001.tendcloud.com/library/hello:v2
```

或者使用 `kubectl edit deployment/rolling-update-test` 修改鏡像名稱後保存。

使用以下命令查看升級進度：

```
kubectl rollout status deployment/rolling-update-test
```

升級完成後在瀏覽器中刷新 `http://rolling-update-test.traefik.io` 將會看到以下輸出：

```
This is version 2.
```

說明滾動升級成功。

## 使用 ReplicationController 創建的 Pod 如何 RollingUpdate

以上講解使用 **Deployment** 創建的 Pod 的 RollingUpdate 方式，那麼如果使用傳統的 **ReplicationController** 創建的 Pod 如何 Update 呢？

舉個例子：

```bash
$ kubectl -n spark-cluster rolling-update zeppelin-controller --image sz-pg-oam-docker-hub-001.tendcloud.com/library/zeppelin:0.7.1
Created zeppelin-controller-99be89dbbe5cd5b8d6feab8f57a04a8b
Scaling up zeppelin-controller-99be89dbbe5cd5b8d6feab8f57a04a8b from 0 to 1, scaling down zeppelin-controller from 1 to 0 (keep 1 pods available, don't exceed 2 pods)
Scaling zeppelin-controller-99be89dbbe5cd5b8d6feab8f57a04a8b up to 1
Scaling zeppelin-controller down to 0
Update succeeded. Deleting old controller: zeppelin-controller
Renaming zeppelin-controller-99be89dbbe5cd5b8d6feab8f57a04a8b to zeppelin-controller
replicationcontroller "zeppelin-controller" rolling updated
```

只需要指定新的鏡像即可，當然你可以配置 RollingUpdate 的策略。

## 參考

- [Rolling update 機制解析](http://dockone.io/article/328)
- [Running a Stateless Application Using a Deployment](https://kubernetes.io/docs/tasks/run-application/run-stateless-application-deployment/)
- [Simple Rolling Update](https://github.com/kubernetes/community/blob/master/contributors/design-proposals/cli/simple-rolling-update.md)
- [使用 kubernetes 的 deployment 進行 RollingUpdate](https://segmentfault.com/a/1190000008232770)
