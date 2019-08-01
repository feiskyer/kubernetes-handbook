# Pod

Pod 是一組緊密關聯的容器集合，它們共享 IPC、Network 和 UTS namespace，是 Kubernetes 調度的基本單位。Pod 的設計理念是支持多個容器在一個 Pod 中共享網絡和文件系統，可以通過進程間通信和文件共享這種簡單高效的方式組合完成服務。

![pod](images/pod.png)

Pod 的特徵

- 包含多個共享 IPC、Network 和 UTC namespace 的容器，可直接通過 localhost 通信
- 所有 Pod 內容器都可以訪問共享的 Volume，可以訪問共享數據
- 無容錯性：直接創建的 Pod 一旦被調度後就跟 Node 綁定，即使 Node 掛掉也不會被重新調度（而是被自動刪除），因此推薦使用 Deployment、Daemonset 等控制器來容錯
- 優雅終止：Pod 刪除的時候先給其內的進程發送 SIGTERM，等待一段時間（grace period）後才強制停止依然還在運行的進程
- 特權容器（通過 SecurityContext 配置）具有改變系統配置的權限（在網絡插件中大量應用）

> Kubernetes v1.8+ 還支持容器間共享 PID namespace，需要 docker >= 1.13.1，並配置 kubelet `--docker-disable-shared-pid=false`。

## API 版本對照表

| Kubernetes 版本 | Core API 版本 | 默認開啟 |
| --------------- | ------------- | -------- |
| v1.5+           | core/v1       | 是       |

## Pod 定義

通過 [yaml 或 json 描述 Pod](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.15/#pod-v1-core) 和其內容器的運行環境以及期望狀態，比如一個最簡單的 nginx pod 可以定義為

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

> 在生產環境中，推薦使用 Deployment、StatefulSet、Job 或者 CronJob 等控制器來創建 Pod，而不推薦直接創建 Pod。

### Docker 鏡像支持

目前，Kubernetes 僅支持使用 Docker 鏡像來創建容器，但並非支持 [Dockerfile](https://docs.docker.com/engine/reference/builder/) 定義的所有行為。如下表所示

| Dockerfile 指令 | 描述                       | 支持 | 說明                                         |
| --------------- | -------------------------- | ---- | -------------------------------------------- |
| ENTRYPOINT      | 啟動命令                   | 是   | containerSpec.command                        |
| CMD             | 命令的參數列表             | 是   | containerSpec.args                           |
| ENV             | 環境變量                   | 是   | containerSpec.env                            |
| EXPOSE          | 對外開放的端口             | 否   | 使用 containerSpec.ports.containerPort 替代  |
| VOLUME          | 數據卷                     | 是   | 使用 volumes 和 volumeMounts                 |
| USER            | 進程運行用戶以及用戶組     | 是   | securityContext.runAsUser/supplementalGroups |
| WORKDIR         | 工作目錄                   | 是   | containerSpec.workingDir                     |
| STOPSIGNAL      | 停止容器時給進程發送的信號 | 是   | SIGKILL                                      |
| HEALTHCHECK     | 健康檢查                   | 否   | 使用 livenessProbe 和 readinessProbe 替代    |
| SHELL           | 運行啟動命令的 SHELL       | 否   | 使用鏡像默認 SHELL 啟動命令                  |

## Pod 生命週期

Kubernetes 以 `PodStatus.Phase` 抽象 Pod 的狀態（但並不直接反映所有容器的狀態）。可能的 Phase 包括

- Pending: Pod 已經在 apiserver 中創建，但還沒有調度到 Node 上面
- Running: Pod 已經調度到 Node 上面，所有容器都已經創建，並且至少有一個容器還在運行或者正在啟動
- Succeeded: Pod 調度到 Node 上面後成功運行結束，並且不會重啟
- Failed: Pod 調度到 Node 上面後至少有一個容器運行失敗（即退出碼不為 0 或者被系統終止）
- Unknonwn: 狀態未知，通常是由於 apiserver 無法與 kubelet 通信導致

可以用 kubectl 命令查詢 Pod Phase：

```sh
$ kubectl get pod reviews-v1-5bdc544bbd-5qgxj -o jsonpath="{.status.phase}"
Running
```

PodSpec 中的 `restartPolicy` 可以用來設置是否對退出的 Pod 重啟，可選項包括 `Always`、`OnFailure`、以及 `Never`。比如

- 單容器的 Pod，容器成功退出時，不同 `restartPolicy` 時的動作為
  - Always: 重啟 Container; Pod `phase` 保持 Running.
  - OnFailure: Pod `phase` 變成 Succeeded.
  - Never: Pod `phase` 變成 Succeeded.
- 單容器的 Pod，容器失敗退出時，不同 `restartPolicy` 時的動作為
  - Always: 重啟 Container; Pod `phase` 保持 Running.
  - OnFailure: 重啟 Container; Pod `phase` 保持 Running.
  - Never: Pod `phase` 變成 Failed.
- 2個容器的 Pod，其中一個容器在運行而另一個失敗退出時，不同 `restartPolicy` 時的動作為
  - Always: 重啟 Container; Pod `phase` 保持 Running.
  - OnFailure: 重啟 Container; Pod `phase` 保持 Running.
  - Never: 不重啟 Container; Pod `phase` 保持 Running.
- 2個容器的 Pod，其中一個容器停止而另一個失敗退出時，不同 `restartPolicy` 時的動作為
  - Always: 重啟 Container; Pod `phase` 保持 Running.
  - OnFailure: 重啟 Container; Pod `phase` 保持 Running.
  - Never: Pod `phase` 變成 Failed.
- 單容器的 Pod，容器內存不足（OOM），不同 `restartPolicy` 時的動作為
  - Always: 重啟 Container; Pod `phase` 保持 Running.
  - OnFailure: 重啟 Container; Pod `phase` 保持 Running.
  - Never: 記錄失敗事件; Pod `phase` 變成 Failed.
- Pod 還在運行，但磁盤不可訪問時
  - 終止所有容器
  - Pod `phase` 變成 Failed
  - 如果 Pod 是由某個控制器管理的，則重新創建一個 Pod 並調度到其他 Node 運行
- Pod 還在運行，但由於網絡分區故障導致 Node 無法訪問
  - Node controller等待 Node 事件超時
  - Node controller 將 Pod `phase` 設置為 Failed.
  - 如果 Pod 是由某個控制器管理的，則重新創建一個 Pod 並調度到其他 Node 運行

## 使用 Volume

Volume 可以為容器提供持久化存儲，比如

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

更多掛載存儲卷的方法參考 [Volume](volume.md)。

## 私有鏡像

在使用私有鏡像時，需要創建一個 docker registry secret，並在容器中引用。

創建 docker registry secret：

```sh
kubectl create secret docker-registry regsecret --docker-server=<your-registry-server> --docker-username=<your-name> --docker-password=<your-pword> --docker-email=<your-email>
```

比如使用 Azure Container Registry（ACR）：

```sh
ACR_NAME=dregistry
SERVICE_PRINCIPAL_NAME=acr-service-principal

# Populate the ACR login server and resource id.
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --query loginServer --output tsv)
ACR_REGISTRY_ID=$(az acr show --name $ACR_NAME --query id --output tsv)

# Create a contributor role assignment with a scope of the ACR resource.
SP_PASSWD=$(az ad sp create-for-rbac --name $SERVICE_PRINCIPAL_NAME --role Reader --scopes $ACR_REGISTRY_ID --query password --output tsv)

# Get the service principle client id.
CLIENT_ID=$(az ad sp show --id http://$SERVICE_PRINCIPAL_NAME --query appId --output tsv)

# Create secret
kubectl create secret docker-registry acr-auth --docker-server $ACR_LOGIN_SERVER --docker-username $CLIENT_ID --docker-password $SP_PASSWD --docker-email local@local.domain
```

在引用 docker registry secret 時，有兩種可選的方法：

第一種是直接在 Pod 描述文件中引用該 secret：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: private-reg
spec:
  containers:
    - name: private-reg-container
      image: dregistry.azurecr.io/acr-auth-example
  imagePullSecrets:
    - name: acr-auth
```

第二種是把 secret 添加到 service account 中，再通過 service account 引用（一般是某個 namespace 的 default service account）：

```sh
$ kubectl get secrets myregistrykey
$ kubectl patch serviceaccount default -p '{"imagePullSecrets": [{"name": "myregistrykey"}]}'
$ kubectl get serviceaccounts default -o yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  creationTimestamp: 2015-08-07T22:02:39Z
  name: default
  namespace: default
  selfLink: /api/v1/namespaces/default/serviceaccounts/default
  uid: 052fb0f4-3d50-11e5-b066-42010af0d7b6
secrets:
- name: default-token-uudge
imagePullSecrets:
- name: myregistrykey
```

## RestartPolicy

支持三種 RestartPolicy

- Always：只要退出就重啟
- OnFailure：失敗退出（exit code 不等於 0）時重啟
- Never：只要退出就不再重啟

注意，這裡的重啟是指在 Pod 所在 Node 上面本地重啟，並不會調度到其他 Node 上去。

## 環境變量

環境變量為容器提供了一些重要的資源，包括容器和 Pod 的基本信息以及集群中服務的信息等：

(1) hostname

`HOSTNAME` 環境變量保存了該 Pod 的 hostname。

（2）容器和 Pod 的基本信息

Pod 的名字、命名空間、IP 以及容器的計算資源限制等可以以 [Downward API](https://kubernetes.io/docs/tasks/inject-data-application/downward-api-volume-expose-pod-information/) 的方式獲取並存儲到環境變量中。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: test
spec:
  containers:
    - name: test-container
      image: gcr.io/google_containers/busybox
      command: ["sh", "-c"]
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

(3) 集群中服務的信息

容器的環境變量中還可以引用容器運行前創建的所有服務的信息，比如默認的 kubernetes 服務對應以下環境變量：

```sh
KUBERNETES_PORT_443_TCP_ADDR=10.0.0.1
KUBERNETES_SERVICE_HOST=10.0.0.1
KUBERNETES_SERVICE_PORT=443
KUBERNETES_SERVICE_PORT_HTTPS=443
KUBERNETES_PORT=tcp://10.0.0.1:443
KUBERNETES_PORT_443_TCP=tcp://10.0.0.1:443
KUBERNETES_PORT_443_TCP_PROTO=tcp
KUBERNETES_PORT_443_TCP_PORT=443
```

由於環境變量存在創建順序的侷限性（環境變量中不包含後來創建的服務），推薦使用 [DNS](../components/kube-dns.md) 來解析服務。

## 鏡像拉取策略

支持三種 ImagePullPolicy

- Always：不管鏡像是否存在都會進行一次拉取
- Never：不管鏡像是否存在都不會進行拉取
- IfNotPresent：只有鏡像不存在時，才會進行鏡像拉取

注意：

- 默認為 `IfNotPresent`，但 `:latest` 標籤的鏡像默認為 `Always`。
- 拉取鏡像時 docker 會進行校驗，如果鏡像中的 MD5 碼沒有變，則不會拉取鏡像數據。
- 生產環境中應該儘量避免使用 `:latest` 標籤，而開發環境中可以藉助 `:latest` 標籤自動拉取最新的鏡像。

## 訪問 DNS 的策略

通過設置 dnsPolicy 參數，設置 Pod 中容器訪問 DNS 的策略

- ClusterFirst：優先基於 cluster domain （如 `default.svc.cluster.local`） 後綴，通過 kube-dns 查詢 (默認策略)
- Default：優先從 Node 中配置的 DNS 查詢

## 使用主機的 IPC 命名空間

通過設置 `spec.hostIPC` 參數為 true，使用主機的 IPC 命名空間，默認為 false。

## 使用主機的網絡命名空間

通過設置 `spec.hostNetwork` 參數為 true，使用主機的網絡命名空間，默認為 false。

## 使用主機的 PID 空間

通過設置 `spec.hostPID` 參數為 true，使用主機的 PID 命名空間，默認為 false。

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

## 設置 Pod 的 hostname

通過 `spec.hostname` 參數實現，如果未設置默認使用 `metadata.name` 參數的值作為 Pod 的 hostname。

## 設置 Pod 的子域名

通過 `spec.subdomain` 參數設置 Pod 的子域名，默認為空。

比如，指定 hostname 為 busybox-2 和 subdomain 為 default-subdomain，完整域名為 `busybox-2.default-subdomain.default.svc.cluster.local`，也可以簡寫為 `busybox-2.default-subdomain.default`：

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

- 默認情況下，DNS 為 Pod 生成的 A 記錄格式為 `pod-ip-address.my-namespace.pod.cluster.local`，如 `1-2-3-4.default.pod.cluster.local`
- 上面的示例還需要在 default namespace 中創建一個名為 `default-subdomain`（即 subdomain）的 headless service，否則其他 Pod 無法通過完整域名訪問到該 Pod（只能自己訪問到自己）

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

注意，必須為 headless service 設置至少一個服務端口（`spec.ports`，即便它看起來並不需要），否則 Pod 與 Pod 之間依然無法通過完整域名來訪問。

## 設置 Pod 的 DNS 選項

從 v1.9 開始，可以在 kubelet 和 kube-apiserver 中設置 `--feature-gates=CustomPodDNS=true` 開啟設置每個 Pod DNS 地址的功能。

> 注意該功能在 v1.10 中為 Beta 版，v1.9 中為 Alpha 版。

```yaml
apiVersion: v1
kind: Pod
metadata:
  namespace: default
  name: dns-example
spec:
  containers:
    - name: test
      image: nginx
  dnsPolicy: "None"
  dnsConfig:
    nameservers:
      - 1.2.3.4
    searches:
      - ns1.svc.cluster.local
      - my.dns.search.suffix
    options:
      - name: ndots
        value: "2"
      - name: edns0
```

對於舊版本的集群，可以使用 ConfigMap 來自定義 Pod 的 `/etc/resolv.conf`，如

```yaml
kind: ConfigMap
apiVersion: v1
metadata:
  name: resolvconf
  namespace: default
data:
  resolv.conf: |
    search default.svc.cluster.local svc.cluster.local cluster.local
    nameserver 10.0.0.10

---
kind: Deployment
apiVersion: extensions/v1beta1
metadata:
  name: dns-test
  namespace: default
spec:
  replicas: 1
  template:
    metadata:
      labels:
        name: dns-test
    spec:
      containers:
        - name: dns-test
          image: alpine
          stdin: true
          tty: true
          command: ["sh"]
          volumeMounts:
            - name: resolv-conf
              mountPath: /etc/resolv.conf
              subPath: resolv.conf
      volumes:
        - name: resolv-conf
          configMap:
            name: resolvconf
            items:
            - key: resolv.conf
              path: resolv.conf
```

## 資源限制

Kubernetes 通過 cgroups 限制容器的 CPU 和內存等計算資源，包括 requests（請求，**調度器保證調度到資源充足的 Node 上，如果無法滿足會調度失敗**）和 limits（上限）等：

- `spec.containers[].resources.limits.cpu`：CPU 上限，可以短暫超過，容器也不會被停止
- `spec.containers[].resources.limits.memory`：內存上限，不可以超過；如果超過，容器可能會被終止或調度到其他資源充足的機器上
- `spec.containers[].resources.limits.ephemeral-storage`：臨時存儲（容器可寫層、日誌以及 EmptyDir 等）的上限，超過後 Pod 會被驅逐
- `spec.containers[].resources.requests.cpu`：CPU 請求，也是調度 CPU 資源的依據，可以超過
- `spec.containers[].resources.requests.memory`：內存請求，也是調度內存資源的依據，可以超過；但如果超過，容器可能會在 Node 內存不足時清理
- `spec.containers[].resources.requests.ephemeral-storage`：臨時存儲（容器可寫層、日誌以及 EmptyDir 等）的請求，調度容器存儲的依據

比如 nginx 容器請求 30% 的 CPU 和 56MB 的內存，但限制最多隻用 50% 的 CPU 和 128MB 的內存：

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
          cpu: "1"
          memory: "128Mi"
```

注意

- CPU 的單位是 CPU 個數，可以用 `millicpu (m)` 表示少於 1 個 CPU 的情況，如 `500m = 500millicpu = 0.5cpu`，而一個 CPU 相當於
  - AWS 上的一個 vCPU
  - GCP 上的一個 Core
  - Azure 上的一個 vCore
  - 物理機上開啟超線程時的一個超線程
- 內存的單位則包括 `E, P, T, G, M, K, Ei, Pi, Ti, Gi, Mi, Ki` 等。
- 從 v1.10 開始，可以設置 `kubelet ----cpu-manager-policy=static` 為 Guaranteed（即 requests.cpu 與 limits.cpu 相等）Pod 綁定 CPU（通過 cpuset cgroups）。

## 健康檢查

為了確保容器在部署後確實處在正常運行狀態，Kubernetes 提供了兩種探針（Probe）來探測容器的狀態：

- LivenessProbe：探測應用是否處於健康狀態，如果不健康則刪除並重新創建容器
- ReadinessProbe：探測應用是否啟動完成並且處於正常服務狀態，如果不正常則不會接收來自 Kubernetes Service 的流量

Kubernetes 支持三種方式來執行探針：

- exec：在容器中執行一個命令，如果 [命令退出碼](http://www.tldp.org/LDP/abs/html/exitcodes.html) 返回 `0` 則表示探測成功，否則表示失敗
- tcpSocket：對指定的容器 IP 及端口執行一個 TCP 檢查，如果端口是開放的則表示探測成功，否則表示失敗
- httpGet：對指定的容器 IP、端口及路徑執行一個 HTTP Get 請求，如果返回的 [狀態碼](https://en.wikipedia.org/wiki/List_of_HTTP_status_codes) 在 `[200,400)` 之間則表示探測成功，否則表示失敗

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

Pod 能夠具有多個容器，應用運行在容器裡面，但是它也可能有一個或多個先於應用容器啟動的 Init 容器。Init 容器在所有容器運行之前執行（run-to-completion），常用來初始化配置。

如果為一個 Pod 指定了多個 Init 容器，那些容器會按順序一次運行一個。 每個 Init 容器必須運行成功，下一個才能夠運行。 當所有的 Init 容器運行完成時，Kubernetes 初始化 Pod 並像平常一樣運行應用容器。

下面是一個 Init 容器的示例：

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

因為 Init 容器具有與應用容器分離的單獨鏡像，使用 init 容器啟動相關代碼具有如下優勢：

- 它們可以包含並運行實用工具，出於安全考慮，是不建議在應用容器鏡像中包含這些實用工具的。
- 它們可以包含使用工具和定製化代碼來安裝，但是不能出現在應用鏡像中。例如，創建鏡像沒必要 FROM 另一個鏡像，只需要在安裝過程中使用類似 sed、 awk、 python 或 dig 這樣的工具。
- 應用鏡像可以分離出創建和部署的角色，而沒有必要聯合它們構建一個單獨的鏡像。
- 它們使用 Linux Namespace，所以對應用容器具有不同的文件系統視圖。因此，它們能夠具有訪問 Secret 的權限，而應用容器不能夠訪問。
- 它們在應用容器啟動之前運行完成，然而應用容器並行運行，所以 Init 容器提供了一種簡單的方式來阻塞或延遲應用容器的啟動，直到滿足了一組先決條件。

Init 容器的資源計算，選擇一下兩者的較大值：

- 所有 Init 容器中的資源使用的最大值
- Pod 中所有容器資源使用的總和

Init 容器的重啟策略：

- 如果 Init 容器執行失敗，Pod 設置的 restartPolicy 為 Never，則 pod 將處於 fail 狀態。否則 Pod 將一直重新執行每一個 Init 容器直到所有的 Init 容器都成功。
- 如果 Pod 異常退出，重新拉取 Pod 後，Init 容器也會被重新執行。所以在 Init 容器中執行的任務，需要保證是冪等的。

## 容器生命週期鉤子

容器生命週期鉤子（Container Lifecycle Hooks）監聽容器生命週期的特定事件，並在事件發生時執行已註冊的回調函數。支持兩種鉤子：

- postStart： 容器創建後立即執行，注意由於是異步執行，它無法保證一定在 ENTRYPOINT 之前運行。如果失敗，容器會被殺死，並根據 RestartPolicy 決定是否重啟
- preStop：容器終止前執行，常用於資源清理。如果失敗，容器同樣也會被殺死

而鉤子的回調函數支持兩種方式：

- exec：在容器內執行命令，如果命令的退出狀態碼是 `0` 表示執行成功，否則表示失敗
- httpGet：向指定 URL 發起 GET 請求，如果返回的 HTTP 狀態碼在 `[200, 400)` 之間表示請求成功，否則表示失敗

postStart 和 preStop 鉤子示例：

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

## 使用 Capabilities

默認情況下，容器都是以非特權容器的方式運行。比如，不能在容器中創建虛擬網卡、配置虛擬網絡。

Kubernetes 提供了修改 [Capabilities](http://man7.org/linux/man-pages/man7/capabilities.7.html) 的機制，可以按需要給容器增加或刪除。比如下面的配置給容器增加了 `CAP_NET_ADMIN` 並刪除了 `CAP_KILL`。

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

## 限制網絡帶寬

可以通過給 Pod 增加 `kubernetes.io/ingress-bandwidth` 和 `kubernetes.io/egress-bandwidth` 這兩個 annotation 來限制 Pod 的網絡帶寬

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

> **僅 kubenet 支持限制帶寬**
>
> 目前只有 kubenet 網絡插件支持限制網絡帶寬，其他 CNI 網絡插件暫不支持這個功能。

kubenet 的網絡帶寬限制其實是通過 tc 來實現的

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

## 調度到指定的 Node 上

可以通過 nodeSelector、nodeAffinity、podAffinity 以及 Taints 和 tolerations 等來將 Pod 調度到需要的 Node 上。

也可以通過設置 nodeName 參數，將 Pod 調度到指定 node 節點上。

比如，使用 nodeSelector，首先給 Node 加上標籤：

```sh
kubectl label nodes <your-node-name> disktype=ssd
```

接著，指定該 Pod 只想運行在帶有 `disktype=ssd` 標籤的 Node 上：

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

nodeAffinity、podAffinity 以及 Taints 和 tolerations 等的使用方法請參考 [調度器章節](../components/scheduler.md)。

## 自定義 hosts

默認情況下，容器的 `/etc/hosts` 是 kubelet 自動生成的，並且僅包含 localhost 和 podName 等。不建議在容器內直接修改 `/etc/hosts` 文件，因為在 Pod 啟動或重啟時會被覆蓋。

默認的 `/etc/hosts` 文件格式如下，其中 `nginx-4217019353-fb2c5` 是 podName：

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

從 v1.7 開始，可以通過 `pod.Spec.HostAliases` 來增加 hosts 內容，如

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

## HugePages

v1.8 + 支持給容器分配 HugePages，資源格式為 `hugepages-<size>`（如 `hugepages-2Mi`）。使用前要配置

- 開啟 `--feature-gates="HugePages=true"`
- 在所有 Node 上面預分配好 HugePage ，以便 Kubelet 統計所在 Node 的 HugePage 容量

使用示例

```yaml
apiVersion: v1
kind: Pod
metadata:
  generateName: hugepages-volume-
spec:
  containers:
  - image: fedora:latest
    command:
    - sleep
    - inf
    name: example
    volumeMounts:
    - mountPath: /hugepages
      name: hugepage
    resources:
      limits:
        hugepages-2Mi: 100Mi
  volumes:
  - name: hugepage
    emptyDir:
      medium: HugePages
```

注意事項

- HugePage 資源的請求和限制必須相同
- HugePage 以 Pod 級別隔離，未來可能會支持容器級的隔離
- 基於 HugePage 的 EmptyDir 存儲卷最多隻能使用請求的 HugePage 內存
- 使用 `shmget()` 的 `SHM_HUGETLB` 選項時，應用必須運行在匹配 `proc/sys/vm/hugetlb_shm_group` 的用戶組（supplemental group）中

## 優先級

從 v1.8 開始，可以為 Pod 設置一個優先級，保證高優先級的 Pod 優先調度。

優先級調度功能目前為 Beta 版，在 v1.11 版本中默認開啟。對 v1.8-1.10 版本中使用前需要開啟：

- `--feature-gates=PodPriority=true`
- `--runtime-config=scheduling.k8s.io/v1alpha1=true --admission-control=Controller-Foo,Controller-Bar,...,Priority`

為 Pod 設置優先級前，先創建一個 PriorityClass，並設置優先級（數值越大優先級越高）：

```yaml
apiVersion: scheduling.k8s.io/v1alpha1
kind: PriorityClass
metadata:
  name: high-priority
value: 1000000
globalDefault: false
description: "This priority class should be used for XYZ service pods only."
```

> Kubernetes 自動創建了 `system-cluster-critical` 和 `system-node-critical` 等兩個 PriorityClass，用於 Kubernetes 核心組件。

為 Pod 指定優先級

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
  priorityClassName: high-priority
```

當調度隊列有多個 Pod 需要調度時，優先調度高優先級的 Pod。而當高優先級的 Pod 無法調度時，Kubernetes 會嘗試先刪除低優先級的 Pod 再將其調度到對應 Node 上（Preemption）。

注意：**受限於 Kubernetes 的調度策略，搶佔並不總是成功**。

## PodDisruptionBudget

[PodDisruptionBudget (PDB)](https://kubernetes.io/docs/concepts/workloads/pods/disruptions/) 用來保證一組 Pod 同時運行的數量，這些 Pod 需要使用 Deployment、ReplicationController、ReplicaSet 或者 StatefulSet 管理。

```yaml
apiVersion: policy/v1beta1
kind: PodDisruptionBudget
metadata:
  name: zk-pdb
spec:
  maxUnavailable: 1
  selector:
    matchLabels:
      app: zookeeper
```

## Sysctls

Sysctls 允許容器設置內核參數，分為安全 Sysctls 和非安全 Sysctls：

- 安全 Sysctls：即設置後不影響其他 Pod 的內核選項，只作用在容器 namespace 中，默認開啟。包括以下幾種
  - `kernel.shm_rmid_forced`
  - `net.ipv4.ip_local_port_range`
  - `net.ipv4.tcp_syncookies`
- 非安全 Sysctls：即設置好有可能影響其他 Pod 和 Node 上其他服務的內核選項，默認禁止。如果使用，需要管理員在配置 kubelet 時開啟，如 `kubelet --experimental-allowed-unsafe-sysctls 'kernel.msg*,net.ipv4.route.min_pmtu'`

v1.6-v1.10 示例：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: sysctl-example
  annotations:
    security.alpha.kubernetes.io/sysctls: kernel.shm_rmid_forced=1
    security.alpha.kubernetes.io/unsafe-sysctls: net.ipv4.route.min_pmtu=1000,kernel.msgmax=1 2 3
spec:
  ...
```

從 v1.11 開始，Sysctls 升級為 Beta 版本，不再區分安全和非安全 sysctl，統一通過 podSpec.securityContext.sysctls 設置，如

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: sysctl-example
spec:
  securityContext:
    sysctls:
    - name: kernel.shm_rmid_forced
      value: "0"
    - name: net.ipv4.route.min_pmtu
      value: "552"
    - name: kernel.msgmax
      value: "65536"
  ...
```

## Pod 時區

很多容器都是配置了 UTC 時區，與國內集群的 Node 所在時區有可能不一致，可以通過 HostPath 存儲插件給容器配置與 Node 一樣的時區：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: sh
  namespace: default
spec:
  containers:
  - image: alpine
    stdin: true
    tty: true
    volumeMounts:
    - mountPath: /etc/localtime
      name: time
      readOnly: true
  volumes:
  - hostPath:
      path: /etc/localtime
      type: ""
    name: time
```

## 參考文檔

- [What is Pod?](https://kubernetes.io/docs/concepts/workloads/pods/pod/)
- [Kubernetes Pod Lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)
- [DNS Pods and Services](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/)
- [Container capabilities](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/#set-capabilities-for-a-container)
- [Configure Liveness and Readiness Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-probes/)
- [Init Containers](https://kubernetes.io/docs/concepts/workloads/pods/init-containers/)
- [Linux Capabilities](http://man7.org/linux/man-pages/man7/capabilities.7.html)
- [Manage HugePages](https://kubernetes.io/docs/tasks/manage-hugepages/scheduling-hugepages/)
- [Document supported docker image (Dockerfile) features](https://github.com/kubernetes/kubernetes/issues/30039)
