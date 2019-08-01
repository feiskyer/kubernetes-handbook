# Pod 異常排錯

本章介紹 Pod 運行異常的排錯方法。

一般來說，無論 Pod 處於什麼異常狀態，都可以執行以下命令來查看 Pod 的狀態

- `kubectl get pod <pod-name> -o yaml` 查看 Pod 的配置是否正確
- `kubectl describe pod <pod-name>` 查看 Pod 的事件
- `kubectl logs <pod-name> [-c <container-name>]` 查看容器日誌

這些事件和日誌通常都會有助於排查 Pod 發生的問題。

## Pod 一直處於 Pending 狀態

Pending 說明 Pod 還沒有調度到某個 Node 上面。可以通過 `kubectl describe pod <pod-name>` 命令查看到當前 Pod 的事件，進而判斷為什麼沒有調度。如

```sh
$ kubectl describe pod mypod
...
Events:
  Type     Reason            Age                From               Message
  ----     ------            ----               ----               -------
  Warning  FailedScheduling  12s (x6 over 27s)  default-scheduler  0/4 nodes are available: 2 Insufficient cpu.
```

可能的原因包括

- 資源不足，集群內所有的 Node 都不滿足該 Pod 請求的 CPU、內存、GPU 或者臨時存儲空間等資源。解決方法是刪除集群內不用的 Pod 或者增加新的 Node。
- HostPort 端口已被佔用，通常推薦使用 Service 對外開放服務端口

## Pod 一直處於 Waiting 或 ContainerCreating 狀態

首先還是通過 `kubectl describe pod <pod-name>` 命令查看到當前 Pod 的事件

```sh
$ kubectl -n kube-system describe pod nginx-pod
Events:
  Type     Reason                 Age               From               Message
  ----     ------                 ----              ----               -------
  Normal   Scheduled              1m                default-scheduler  Successfully assigned nginx-pod to node1
  Normal   SuccessfulMountVolume  1m                kubelet, gpu13     MountVolume.SetUp succeeded for volume "config-volume"
  Normal   SuccessfulMountVolume  1m                kubelet, gpu13     MountVolume.SetUp succeeded for volume "coredns-token-sxdmc"
  Warning  FailedSync             2s (x4 over 46s)  kubelet, gpu13     Error syncing pod
  Normal   SandboxChanged         1s (x4 over 46s)  kubelet, gpu13     Pod sandbox changed, it will be killed and re-created.
```

可以發現，該 Pod 的 Sandbox 容器無法正常啟動，具體原因需要查看 Kubelet 日誌：

```sh
$ journalctl -u kubelet
...
Mar 14 04:22:04 node1 kubelet[29801]: E0314 04:22:04.649912   29801 cni.go:294] Error adding network: failed to set bridge addr: "cni0" already has an IP address different from 10.244.4.1/24
Mar 14 04:22:04 node1 kubelet[29801]: E0314 04:22:04.649941   29801 cni.go:243] Error while adding to cni network: failed to set bridge addr: "cni0" already has an IP address different from 10.244.4.1/24
Mar 14 04:22:04 node1 kubelet[29801]: W0314 04:22:04.891337   29801 cni.go:258] CNI failed to retrieve network namespace path: Cannot find network namespace for the terminated container "c4fd616cde0e7052c240173541b8543f746e75c17744872aa04fe06f52b5141c"
Mar 14 04:22:05 node1 kubelet[29801]: E0314 04:22:05.965801   29801 remote_runtime.go:91] RunPodSandbox from runtime service failed: rpc error: code = 2 desc = NetworkPlugin cni failed to set up pod "nginx-pod" network: failed to set bridge addr: "cni0" already has an IP address different from 10.244.4.1/24
```

發現是 cni0 網橋配置了一個不同網段的 IP 地址導致，刪除該網橋（網絡插件會自動重新創建）即可修復

```sh
$ ip link set cni0 down
$ brctl delbr cni0
```

除了以上錯誤，其他可能的原因還有

- 鏡像拉取失敗，比如
  - 配置了錯誤的鏡像
  - Kubelet 無法訪問鏡像（國內環境訪問 `gcr.io` 需要特殊處理）
  - 私有鏡像的密鑰配置錯誤
  - 鏡像太大，拉取超時（可以適當調整 kubelet 的 `--image-pull-progress-deadline` 和 `--runtime-request-timeout` 選項）
- CNI 網絡錯誤，一般需要檢查 CNI 網絡插件的配置，比如
  - 無法配置 Pod 網絡
  - 無法分配 IP 地址
- 容器無法啟動，需要檢查是否打包了正確的鏡像或者是否配置了正確的容器參數



## Pod 處於 ImagePullBackOff 狀態

這通常是鏡像名稱配置錯誤或者私有鏡像的密鑰配置錯誤導致。這種情況可以使用 `docker pull <image>` 來驗證鏡像是否可以正常拉取。

```sh
$ kubectl describe pod mypod
...
Events:
  Type     Reason                 Age                From                                Message
  ----     ------                 ----               ----                                -------
  Normal   Scheduled              36s                default-scheduler                   Successfully assigned sh to k8s-agentpool1-38622806-0
  Normal   SuccessfulMountVolume  35s                kubelet, k8s-agentpool1-38622806-0  MountVolume.SetUp succeeded for volume "default-token-n4pn6"
  Normal   Pulling                17s (x2 over 33s)  kubelet, k8s-agentpool1-38622806-0  pulling image "a1pine"
  Warning  Failed                 14s (x2 over 29s)  kubelet, k8s-agentpool1-38622806-0  Failed to pull image "a1pine": rpc error: code = Unknown desc = Error response from daemon: repository a1pine not found: does not exist or no pull access
  Warning  Failed                 14s (x2 over 29s)  kubelet, k8s-agentpool1-38622806-0  Error: ErrImagePull
  Normal   SandboxChanged         4s (x7 over 28s)   kubelet, k8s-agentpool1-38622806-0  Pod sandbox changed, it will be killed and re-created.
  Normal   BackOff                4s (x5 over 25s)   kubelet, k8s-agentpool1-38622806-0  Back-off pulling image "a1pine"
  Warning  Failed                 1s (x6 over 25s)   kubelet, k8s-agentpool1-38622806-0  Error: ImagePullBackOff
```

如果是私有鏡像，需要首先創建一個 docker-registry 類型的 Secret

```sh
kubectl create secret docker-registry my-secret --docker-server=DOCKER_REGISTRY_SERVER --docker-username=DOCKER_USER --docker-password=DOCKER_PASSWORD --docker-email=DOCKER_EMAIL
```

然後在容器中引用這個 Secret

```yaml
spec:
  containers:
  - name: private-reg-container
    image: <your-private-image>
  imagePullSecrets:
  - name: my-secret
```

## Pod 一直處於 CrashLoopBackOff 狀態

CrashLoopBackOff 狀態說明容器曾經啟動了，但又異常退出了。此時 Pod 的 RestartCounts 通常是大於 0 的，可以先查看一下容器的日誌

```sh
kubectl describe pod <pod-name>
kubectl logs <pod-name>
kubectl logs --previous <pod-name>
```

這裡可以發現一些容器退出的原因，比如

- 容器進程退出
- 健康檢查失敗退出
- OOMKilled

```sh
$ kubectl describe pod mypod
...
Containers:
  sh:
    Container ID:  docker://3f7a2ee0e7e0e16c22090a25f9b6e42b5c06ec049405bc34d3aa183060eb4906
    Image:         alpine
    Image ID:      docker-pullable://alpine@sha256:7b848083f93822dd21b0a2f14a110bd99f6efb4b838d499df6d04a49d0debf8b
    Port:          <none>
    Host Port:     <none>
    State:          Terminated
      Reason:       OOMKilled
      Exit Code:    2
    Last State:     Terminated
      Reason:       OOMKilled
      Exit Code:    2
    Ready:          False
    Restart Count:  3
    Limits:
      cpu:     1
      memory:  1G
    Requests:
      cpu:        100m
      memory:     500M
...
```

如果此時如果還未發現線索，還可以到容器內執行命令來進一步查看退出原因

```sh
kubectl exec cassandra -- cat /var/log/cassandra/system.log
```

如果還是沒有線索，那就需要 SSH 登錄該 Pod 所在的 Node 上，查看 Kubelet 或者 Docker 的日誌進一步排查了

```sh
# Query Node
kubectl get pod <pod-name> -o wide

# SSH to Node
ssh <username>@<node-name>
```

## Pod 處於 Error 狀態

通常處於 Error 狀態說明 Pod 啟動過程中發生了錯誤。常見的原因包括

- 依賴的 ConfigMap、Secret 或者 PV 等不存在
- 請求的資源超過了管理員設置的限制，比如超過了 LimitRange 等
- 違反集群的安全策略，比如違反了 PodSecurityPolicy 等
- 容器無權操作集群內的資源，比如開啟 RBAC 後，需要為 ServiceAccount 配置角色綁定

## Pod 處於 Terminating 或 Unknown 狀態

從 v1.5 開始，Kubernetes 不會因為 Node 失聯而刪除其上正在運行的 Pod，而是將其標記為 Terminating 或 Unknown 狀態。想要刪除這些狀態的 Pod 有三種方法：

- 從集群中刪除該 Node。使用公有云時，kube-controller-manager 會在 VM 刪除後自動刪除對應的 Node。而在物理機部署的集群中，需要管理員手動刪除 Node（如 `kubectl delete node <node-name>`。
- Node 恢復正常。Kubelet 會重新跟 kube-apiserver 通信確認這些 Pod 的期待狀態，進而再決定刪除或者繼續運行這些 Pod。
- 用戶強制刪除。用戶可以執行 `kubectl delete pods <pod> --grace-period=0 --force` 強制刪除 Pod。除非明確知道 Pod 的確處於停止狀態（比如 Node 所在 VM 或物理機已經關機），否則不建議使用該方法。特別是 StatefulSet 管理的 Pod，強制刪除容易導致腦裂或者數據丟失等問題。

如果 Kubelet 是以 Docker 容器的形式運行的，此時 kubelet 日誌中可能會發現[如下的錯誤](https://github.com/kubernetes/kubernetes/issues/51835)：

```json
{"log":"I0926 19:59:07.162477   54420 kubelet.go:1894] SyncLoop (DELETE, \"api\"): \"billcenter-737844550-26z3w_meipu(30f3ffec-a29f-11e7-b693-246e9607517c)\"\n","stream":"stderr","time":"2017-09-26T11:59:07.162748656Z"}
{"log":"I0926 19:59:39.977126   54420 reconciler.go:186] operationExecutor.UnmountVolume started for volume \"default-token-6tpnm\" (UniqueName: \"kubernetes.io/secret/30f3ffec-a29f-11e7-b693-246e9607517c-default-token-6tpnm\") pod \"30f3ffec-a29f-11e7-b693-246e9607517c\" (UID: \"30f3ffec-a29f-11e7-b693-246e9607517c\") \n","stream":"stderr","time":"2017-09-26T11:59:39.977438174Z"}
{"log":"E0926 19:59:39.977461   54420 nestedpendingoperations.go:262] Operation for \"\\\"kubernetes.io/secret/30f3ffec-a29f-11e7-b693-246e9607517c-default-token-6tpnm\\\" (\\\"30f3ffec-a29f-11e7-b693-246e9607517c\\\")\" failed. No retries permitted until 2017-09-26 19:59:41.977419403 +0800 CST (durationBeforeRetry 2s). Error: UnmountVolume.TearDown failed for volume \"default-token-6tpnm\" (UniqueName: \"kubernetes.io/secret/30f3ffec-a29f-11e7-b693-246e9607517c-default-token-6tpnm\") pod \"30f3ffec-a29f-11e7-b693-246e9607517c\" (UID: \"30f3ffec-a29f-11e7-b693-246e9607517c\") : remove /var/lib/kubelet/pods/30f3ffec-a29f-11e7-b693-246e9607517c/volumes/kubernetes.io~secret/default-token-6tpnm: device or resource busy\n","stream":"stderr","time":"2017-09-26T11:59:39.977728079Z"}
```

如果是這種情況，則需要給 kubelet 容器設置 `--containerized` 參數並傳入以下的存儲卷

```sh
# 以使用 calico 網絡插件為例
      -v /:/rootfs:ro,shared \
      -v /sys:/sys:ro \
      -v /dev:/dev:rw \
      -v /var/log:/var/log:rw \
      -v /run/calico/:/run/calico/:rw \
      -v /run/docker/:/run/docker/:rw \
      -v /run/docker.sock:/run/docker.sock:rw \
      -v /usr/lib/os-release:/etc/os-release \
      -v /usr/share/ca-certificates/:/etc/ssl/certs \
      -v /var/lib/docker/:/var/lib/docker:rw,shared \
      -v /var/lib/kubelet/:/var/lib/kubelet:rw,shared \
      -v /etc/kubernetes/ssl/:/etc/kubernetes/ssl/ \
      -v /etc/kubernetes/config/:/etc/kubernetes/config/ \
      -v /etc/cni/net.d/:/etc/cni/net.d/ \
      -v /opt/cni/bin/:/opt/cni/bin/ \
```

處於 `Terminating` 狀態的 Pod 在 Kubelet 恢復正常運行後一般會自動刪除。但有時也會出現無法刪除的情況，並且通過 `kubectl delete pods <pod> --grace-period=0 --force` 也無法強制刪除。此時一般是由於 `finalizers` 導致的，通過 `kubectl edit` 將 finalizers 刪除即可解決。

```yaml
"finalizers": [
  "foregroundDeletion"
]
```

## Pod 行為異常

這裡所說的行為異常是指 Pod 沒有按預期的行為執行，比如沒有運行 podSpec 裡面設置的命令行參數。這一般是 podSpec yaml 文件內容有誤，可以嘗試使用 `--validate` 參數重建容器，比如

```sh
kubectl delete pod mypod
kubectl create --validate -f mypod.yaml
```

也可以查看創建後的 podSpec 是否是對的，比如

```sh
kubectl get pod mypod -o yaml
```

## 修改靜態 Pod 的 Manifest 後未自動重建

Kubelet 使用 inotify 機制檢測 `/etc/kubernetes/manifests` 目錄（可通過 Kubelet 的 `--pod-manifest-path` 選項指定）中靜態 Pod 的變化，並在文件發生變化後重新創建相應的 Pod。但有時也會發生修改靜態 Pod 的 Manifest 後未自動創建新 Pod 的情景，此時一個簡單的修復方法是重啟 Kubelet。

## Nginx 啟動失敗

Nginx 啟動失敗，錯誤消息是 `nginx: [emerg] socket() [::]:8000 failed (97: Address family not supported by protocol)`。這是由於服務器未開啟 IPv6 導致的，解決方法有兩種：

- 第一種方法，服務器開啟 IPv6；
- 或者，第二種方法，刪除或者註釋掉 `/etc/nginx/conf.d/default.conf` 文件中的 ` listen       [::]:80 default_server;`。

### 參考文檔

- [Troubleshoot Applications](https://kubernetes.io/docs/tasks/debug-application-cluster/debug-application/)
