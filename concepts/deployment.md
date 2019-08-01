# Deployment

## 簡述

Deployment 為 Pod 和 ReplicaSet 提供了一個聲明式定義 (declarative) 方法，用來替代以前的 ReplicationController 來方便的管理應用。

## API 版本對照表

| Kubernetes 版本 |   Deployment 版本 |
| ------------- | ------------------- |
|   v1.5-v1.6   | extensions/v1beta1  |
|     v1.7      |   apps/v1beta1      |
|     v1.8      |   apps/v1beta2      |
|     v1.9      |      apps/v1        |

比如一個簡單的 nginx 應用可以定義為

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
spec:
  replicas: 3
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.7.9
        ports:
        - containerPort: 80
```

擴容：

```
kubectl scale deployment nginx-deployment --replicas 10
```

如果集群支持 horizontal pod autoscaling 的話，還可以為 Deployment 設置自動擴展：

```
kubectl autoscale deployment nginx-deployment --min=10 --max=15 --cpu-percent=80
```

更新鏡像也比較簡單:

```
kubectl set image deployment/nginx-deployment nginx=nginx:1.9.1
```

回滾：

```
kubectl rollout undo deployment/nginx-deployment
```

Deployment 的 ** 典型應用場景 ** 包括：

- 定義 Deployment 來創建 Pod 和 ReplicaSet
- 滾動升級和回滾應用
- 擴容和縮容
- 暫停和繼續 Deployment

## Deployment 概念解析

## Deployment 是什麼？

Deployment 為 Pod 和 Replica Set（下一代 Replication Controller）提供聲明式更新。

你只需要在 Deployment 中描述你想要的目標狀態是什麼，Deployment controller 就會幫你將 Pod 和 Replica Set 的實際狀態改變到你的目標狀態。你可以定義一個全新的 Deployment，也可以創建一個新的替換舊的 Deployment。

一個典型的用例如下：

- 使用 Deployment 來創建 ReplicaSet。ReplicaSet 在後臺創建 pod。檢查啟動狀態，看它是成功還是失敗。
- 然後，通過更新 Deployment 的 PodTemplateSpec 字段來聲明 Pod 的新狀態。這會創建一個新的 ReplicaSet，Deployment 會按照控制的速率將 pod 從舊的 ReplicaSet 移動到新的 ReplicaSet 中。
- 如果當前狀態不穩定，回滾到之前的 Deployment revision。每次回滾都會更新 Deployment 的 revision。
- 擴容 Deployment 以滿足更高的負載。
- 暫停 Deployment 來應用 PodTemplateSpec 的多個修復，然後恢復上線。
- 根據 Deployment 的狀態判斷上線是否 hang 住了。
- 清除舊的不必要的 ReplicaSet。

## 創建 Deployment

下面是一個 Deployment 示例，它創建了一個 Replica Set 來啟動 3 個 nginx pod。

下載示例文件並執行命令：

```sh
$ kubectl create -f docs/user-guide/nginx-deployment.yaml --record
deployment "nginx-deployment" created
```

將 kubectl 的 `—record` 的 flag 設置為 `true` 可以在 annotation 中記錄當前命令創建或者升級了該資源。這在未來會很有用，例如，查看在每個 Deployment revision 中執行了哪些命令。

然後立即執行 `get` 將獲得如下結果：

```sh
$ kubectl get deployments
NAME               DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
nginx-deployment   3         0         0            0           1s
```

輸出結果表明我們希望的 repalica 數是 3（根據 deployment 中的 `.spec.replicas` 配置）當前 replica 數（ `.status.replicas`）是 0, 最新的 replica 數（`.status.updatedReplicas`）是 0，可用的 replica 數（`.status.availableReplicas`）是 0。

過幾秒後再執行 `get` 命令，將獲得如下輸出：

```sh
$ kubectl get deployments
NAME               DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
nginx-deployment   3         3         3            3           18s
```

我們可以看到 Deployment 已經創建了 3 個 replica，所有的 replica 都已經是最新的了（包含最新的 pod template），可用的（根據 Deployment 中的 `.spec.minReadySeconds` 聲明，處於已就緒狀態的 pod 的最少個數）。執行 `kubectl get rs` 和 `kubectl get pods` 會顯示 Replica Set（RS）和 Pod 已創建。

```sh
$ kubectl get rs
NAME                          DESIRED   CURRENT   READY   AGE
nginx-deployment-2035384211   3         3         0       18s
```

你可能會注意到 Replica Set 的名字總是 `<Deployment 的名字>-<pod template 的 hash 值 >`。

```sh
$ kubectl get pods --show-labels
NAME                                READY     STATUS    RESTARTS   AGE       LABELS
nginx-deployment-2035384211-7ci7o   1/1       Running   0          18s       app=nginx,pod-template-hash=2035384211
nginx-deployment-2035384211-kzszj   1/1       Running   0          18s       app=nginx,pod-template-hash=2035384211
nginx-deployment-2035384211-qqcnn   1/1       Running   0          18s       app=nginx,pod-template-hash=2035384211
```

剛創建的 Replica Set 將保證總是有 3 個 nginx 的 pod 存在。

** 注意：**  你必須在 Deployment 中的 selector 指定正確 pod template label（在該示例中是 `app = nginx`），不要跟其他的 controller 搞混了（包括 Deployment、Replica Set、Replication Controller 等）。**Kubernetes 本身不會阻止你這麼做 **，如果你真的這麼做了，這些 controller 之間會相互打架，並可能導致不正確的行為。

## 更新 Deployment

** 注意：**  Deployment 的 rollout 當且僅當 Deployment 的 pod template（例如 `.spec.template`）中的 label 更新或者鏡像更改時被觸發。其他更新，例如擴容 Deployment 不會觸發 rollout。

假如我們現在想要讓 nginx pod 使用 `nginx:1.9.1` 的鏡像來代替原來的 `nginx:1.7.9` 的鏡像。

```sh
$ kubectl set image deployment/nginx-deployment nginx=nginx:1.9.1
deployment "nginx-deployment" image updated
```

我們可以使用 `edit` 命令來編輯 Deployment，修改 `.spec.template.spec.containers[0].image` ，將 `nginx:1.7.9` 改寫成 `nginx:1.9.1`。

```sh
$ kubectl edit deployment/nginx-deployment
deployment "nginx-deployment" edited
```

查看 rollout 的狀態，只要執行：

```sh
$ kubectl rollout status deployment/nginx-deployment
Waiting for rollout to finish: 2 out of 3 new replicas have been updated...
deployment "nginx-deployment" successfully rolled out
```

Rollout 成功後，`get` Deployment：

```sh
$ kubectl get deployments
NAME               DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
nginx-deployment   3         3         3            3           36s
```

UP-TO-DATE 的 replica 的數目已經達到了配置中要求的數目。

CURRENT 的 replica 數表示 Deployment 管理的 replica 數量，AVAILABLE 的 replica 數是當前可用的 replica 數量。

我們通過執行 `kubectl get rs` 可以看到 Deployment 更新了 Pod，通過創建一個新的 Replica Set 並擴容了 3 個 replica，同時將原來的 Replica Set 縮容到了 0 個 replica。

```sh
$ kubectl get rs
NAME                          DESIRED   CURRENT   READY   AGE
nginx-deployment-1564180365   3         3         0       6s
nginx-deployment-2035384211   0         0         0       36s
```

執行 `get pods` 只會看到當前的新的 pod:

```sh
$ kubectl get pods
NAME                                READY     STATUS    RESTARTS   AGE
nginx-deployment-1564180365-khku8   1/1       Running   0          14s
nginx-deployment-1564180365-nacti   1/1       Running   0          14s
nginx-deployment-1564180365-z9gth   1/1       Running   0          14s
```

下次更新這些 pod 的時候，只需要更新 Deployment 中的 pod 的 template 即可。

Deployment 可以保證在升級時只有一定數量的 Pod 是 down 的。默認的，它會確保至少有比期望的 Pod 數量少一個的 Pod 是 up 狀態（最多一個不可用）。

Deployment 同時也可以確保只創建出超過期望數量的一定數量的 Pod。默認的，它會確保最多比期望的 Pod 數量多一個的 Pod 是 up 的（最多 1 個 surge）。

** 在未來的 Kuberentes 版本中，將從 1-1 變成 25%-25%）。**

例如，如果你自己看下上面的 Deployment，你會發現，開始創建一個新的 Pod，然後刪除一些舊的 Pod 再創建一個新的。當新的 Pod 創建出來之前不會殺掉舊的 Pod。這樣能夠確保可用的 Pod 數量至少有 2 個，Pod 的總數最多 4 個。

```sh
$ kubectl describe deployments
Name:           nginx-deployment
Namespace:      default
CreationTimestamp:  Tue, 15 Mar 2016 12:01:06 -0700
Labels:         app=nginx
Selector:       app=nginx
Replicas:       3 updated | 3 total | 3 available | 0 unavailable
StrategyType:       RollingUpdate
MinReadySeconds:    0
RollingUpdateStrategy:  1 max unavailable, 1 max surge
OldReplicaSets:     <none>
NewReplicaSet:      nginx-deployment-1564180365 (3/3 replicas created)
Events:
  FirstSeen LastSeen    Count   From                     SubobjectPath   Type        Reason              Message
  --------- --------    -----   ----                     -------------   --------    ------              -------
  36s       36s         1       {deployment-controller}                 Normal      ScalingReplicaSet   Scaled up replica set nginx-deployment-2035384211 to 3
  23s       23s         1       {deployment-controller}                 Normal      ScalingReplicaSet   Scaled up replica set nginx-deployment-1564180365 to 1
  23s       23s         1       {deployment-controller}                 Normal      ScalingReplicaSet   Scaled down replica set nginx-deployment-2035384211 to 2
  23s       23s         1       {deployment-controller}                 Normal      ScalingReplicaSet   Scaled up replica set nginx-deployment-1564180365 to 2
  21s       21s         1       {deployment-controller}                 Normal      ScalingReplicaSet   Scaled down replica set nginx-deployment-2035384211 to 0
  21s       21s         1       {deployment-controller}                 Normal      ScalingReplicaSet   Scaled up replica set nginx-deployment-1564180365 to 3
```

我們可以看到當我們剛開始創建這個 Deployment 的時候，創建了一個 Replica Set（nginx-deployment-2035384211），並直接擴容到了 3 個 replica。

當我們更新這個 Deployment 的時候，它會創建一個新的 Replica Set（nginx-deployment-1564180365），將它擴容到 1 個 replica，然後縮容原先的 Replica Set 到 2 個 replica，此時滿足至少 2 個 Pod 是可用狀態，同一時刻最多有 4 個 Pod 處於創建的狀態。

接著繼續使用相同的 rolling update 策略擴容新的 Replica Set 和縮容舊的 Replica Set。最終，將會在新的 Replica Set 中有 3 個可用的 replica，舊的 Replica Set 的 replica 數目變成 0。

### Rollover（多個 rollout 並行）

每當 Deployment controller 觀測到有新的 deployment 被創建時，如果沒有已存在的 Replica Set 來創建期望個數的 Pod 的話，就會創建出一個新的 Replica Set 來做這件事。已存在的 Replica Set 控制 label 匹配 `.spec.selector` 但是 template 跟 `.spec.template` 不匹配的 Pod 縮容。最終，新的 Replica Set 將會擴容出 `.spec.replicas` 指定數目的 Pod，舊的 Replica Set 會縮容到 0。

如果你更新了一個的已存在並正在進行中的 Deployment，每次更新 Deployment 都會創建一個新的 Replica Set 並擴容它，同時回滾之前擴容的 Replica Set——將它添加到舊的 Replica Set 列表，開始縮容。

例如，假如你創建了一個有 5 個 `niginx:1.7.9` replica 的 Deployment，但是當還只有 3 個 `nginx:1.7.9` 的 replica 創建出來的時候你就開始更新含有 5 個 `nginx:1.9.1` replica 的 Deployment。在這種情況下，Deployment 會立即殺掉已創建的 3 個 `nginx:1.7.9` 的 Pod，並開始創建 `nginx:1.9.1` 的 Pod。它不會等到所有的 5 個 `nginx:1.7.9` 的 Pod 都創建完成後才開始執行滾動更新。

## 回退 Deployment

有時候你可能想回退一個 Deployment，例如，當 Deployment 不穩定時，比如一直 crash looping。

默認情況下，kubernetes 會在系統中保存所有的 Deployment 的 rollout 歷史記錄，以便你可以隨時回退（你可以修改 `revision history limit` 來更改保存的 revision 數）。

** 注意：** 只要 Deployment 的 rollout 被觸發就會創建一個 revision。也就是說當且僅當 Deployment 的 Pod template（如 `.spec.template`）被更改，例如更新 template 中的 label 和容器鏡像時，就會創建出一個新的 revision。

其他的更新，比如擴容 Deployment 不會創建 revision——因此我們可以很方便的手動或者自動擴容。這意味著當你回退到歷史 revision 時，只有 Deployment 中的 Pod template 部分才會回退。

假設我們在更新 Deployment 的時候犯了一個拼寫錯誤，將鏡像的名字寫成了 `nginx:1.91`，而正確的名字應該是 `nginx:1.9.1`：

```sh
$ kubectl set image deployment/nginx-deployment nginx=nginx:1.91
deployment "nginx-deployment" image updated
```

Rollout 將會卡住。

```sh
$ kubectl rollout status deployments nginx-deployment
Waiting for rollout to finish: 2 out of 3 new replicas have been updated...
```

按住 Ctrl-C 停止上面的 rollout 狀態監控。

你會看到舊的 replicas（nginx-deployment-1564180365 和 nginx-deployment-2035384211）和新的 replicas （nginx-deployment-3066724191）數目都是 2 個。

```sh
$ kubectl get rs
NAME                          DESIRED   CURRENT   READY   AGE
nginx-deployment-1564180365   2         2         0       25s
nginx-deployment-2035384211   0         0         0       36s
nginx-deployment-3066724191   2         2         2       6s
```

看下創建 Pod，你會看到有兩個新的 Replica Set 創建的 Pod 處於 ImagePullBackOff 狀態，循環拉取鏡像。

```sh
$ kubectl get pods
NAME                                READY     STATUS             RESTARTS   AGE
nginx-deployment-1564180365-70iae   1/1       Running            0          25s
nginx-deployment-1564180365-jbqqo   1/1       Running            0          25s
nginx-deployment-3066724191-08mng   0/1       ImagePullBackOff   0          6s
nginx-deployment-3066724191-eocby   0/1       ImagePullBackOff   0          6s
```

注意，Deployment controller 會自動停止壞的 rollout，並停止擴容新的 Replica Set。

```sh
$ kubectl describe deployment
Name:           nginx-deployment
Namespace:      default
CreationTimestamp:  Tue, 15 Mar 2016 14:48:04 -0700
Labels:         app=nginx
Selector:       app=nginx
Replicas:       2 updated | 3 total | 2 available | 2 unavailable
StrategyType:       RollingUpdate
MinReadySeconds:    0
RollingUpdateStrategy:  1 max unavailable, 1 max surge
OldReplicaSets:     nginx-deployment-1564180365 (2/2 replicas created)
NewReplicaSet:      nginx-deployment-3066724191 (2/2 replicas created)
Events:
  FirstSeen LastSeen    Count   From                    SubobjectPath   Type        Reason              Message
  --------- --------    -----   ----                    -------------   --------    ------              -------
  1m        1m          1       {deployment-controller}                Normal      ScalingReplicaSet   Scaled up replica set nginx-deployment-2035384211 to 3
  22s       22s         1       {deployment-controller}                Normal      ScalingReplicaSet   Scaled up replica set nginx-deployment-1564180365 to 1
  22s       22s         1       {deployment-controller}                Normal      ScalingReplicaSet   Scaled down replica set nginx-deployment-2035384211 to 2
  22s       22s         1       {deployment-controller}                Normal      ScalingReplicaSet   Scaled up replica set nginx-deployment-1564180365 to 2
  21s       21s         1       {deployment-controller}                Normal      ScalingReplicaSet   Scaled down replica set nginx-deployment-2035384211 to 0
  21s       21s         1       {deployment-controller}                Normal      ScalingReplicaSet   Scaled up replica set nginx-deployment-1564180365 to 3
  13s       13s         1       {deployment-controller}                Normal      ScalingReplicaSet   Scaled up replica set nginx-deployment-3066724191 to 1
  13s       13s         1       {deployment-controller}                Normal      ScalingReplicaSet   Scaled down replica set nginx-deployment-1564180365 to 2
  13s       13s         1       {deployment-controller}                Normal      ScalingReplicaSet   Scaled up replica set nginx-deployment-3066724191 to 2
```

為了修復這個問題，我們需要回退到穩定的 Deployment revision。

### 檢查 Deployment 升級的歷史記錄

首先，檢查下 Deployment 的 revision：

```sh
$ kubectl rollout history deployment/nginx-deployment
deployments "nginx-deployment":
REVISION    CHANGE-CAUSE
1           kubectl create -f docs/user-guide/nginx-deployment.yaml --record
2           kubectl set image deployment/nginx-deployment nginx=nginx:1.9.1
3           kubectl set image deployment/nginx-deployment nginx=nginx:1.91
```

因為我們創建 Deployment 的時候使用了 `—recored` 參數可以記錄命令，我們可以很方便的查看每次 revison 的變化。

查看單個 revision 的詳細信息：

```sh
$ kubectl rollout history deployment/nginx-deployment --revision=2
deployments "nginx-deployment" revision 2
  Labels:       app=nginx
          pod-template-hash=1159050644
  Annotations:  kubernetes.io/change-cause=kubectl set image deployment/nginx-deployment nginx=nginx:1.9.1
  Containers:
   nginx:
    Image:      nginx:1.9.1
    Port:       80/TCP
     QoS Tier:
        cpu:      BestEffort
        memory:   BestEffort
    Environment Variables:      <none>
  No volumes.
```

### 回退到歷史版本

現在，我們可以決定回退當前的 rollout 到之前的版本：

```sh
$ kubectl rollout undo deployment/nginx-deployment
deployment "nginx-deployment" rolled back
```

也可以使用 `--to-revision` 參數指定某個歷史版本：

```sh
$ kubectl rollout undo deployment/nginx-deployment --to-revision=2
deployment "nginx-deployment" rolled back
```

與 rollout 相關的命令詳細文檔見 [kubectl rollout](https://kubernetes.io/docs/reference/generated/kubectl/kubectl-commands#rollout)。

該 Deployment 現在已經回退到了先前的穩定版本。如你所見，Deployment controller 產生了一個回退到 revison 2 的 `DeploymentRollback` 的 event。

```sh
$ kubectl get deployment
NAME               DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
nginx-deployment   3         3         3            3           30m

$ kubectl describe deployment
Name:           nginx-deployment
Namespace:      default
CreationTimestamp:  Tue, 15 Mar 2016 14:48:04 -0700
Labels:         app=nginx
Selector:       app=nginx
Replicas:       3 updated | 3 total | 3 available | 0 unavailable
StrategyType:       RollingUpdate
MinReadySeconds:    0
RollingUpdateStrategy:  1 max unavailable, 1 max surge
OldReplicaSets:     <none>
NewReplicaSet:      nginx-deployment-1564180365 (3/3 replicas created)
Events:
  FirstSeen LastSeen    Count   From                    SubobjectPath   Type        Reason              Message
  --------- --------    -----   ----                    -------------   --------    ------              -------
  30m       30m         1       {deployment-controller}                Normal      ScalingReplicaSet   Scaled up replica set nginx-deployment-2035384211 to 3
  29m       29m         1       {deployment-controller}                Normal      ScalingReplicaSet   Scaled up replica set nginx-deployment-1564180365 to 1
  29m       29m         1       {deployment-controller}                Normal      ScalingReplicaSet   Scaled down replica set nginx-deployment-2035384211 to 2
  29m       29m         1       {deployment-controller}                Normal      ScalingReplicaSet   Scaled up replica set nginx-deployment-1564180365 to 2
  29m       29m         1       {deployment-controller}                Normal      ScalingReplicaSet   Scaled down replica set nginx-deployment-2035384211 to 0
  29m       29m         1       {deployment-controller}                Normal      ScalingReplicaSet   Scaled up replica set nginx-deployment-3066724191 to 2
  29m       29m         1       {deployment-controller}                Normal      ScalingReplicaSet   Scaled up replica set nginx-deployment-3066724191 to 1
  29m       29m         1       {deployment-controller}                Normal      ScalingReplicaSet   Scaled down replica set nginx-deployment-1564180365 to 2
  2m        2m          1       {deployment-controller}                Normal      ScalingReplicaSet   Scaled down replica set nginx-deployment-3066724191 to 0
  2m        2m          1       {deployment-controller}                Normal      DeploymentRollback  Rolled back deployment "nginx-deployment" to revision 2
  29m       2m          2       {deployment-controller}                Normal      ScalingReplicaSet   Scaled up replica set nginx-deployment-1564180365 to 3
```

### 清理 Policy

你可以通過設置 `.spec.revisonHistoryLimit` 項來指定 deployment 最多保留多少 revison 歷史記錄。默認的會保留所有的 revision；如果將該項設置為 0，Deployment 就不允許回退了。

## Deployment 擴容

你可以使用以下命令擴容 Deployment：

```sh
$ kubectl scale deployment nginx-deployment --replicas 10
deployment "nginx-deployment" scaled
```

假設你的集群中啟用了 [horizontal pod autoscaling (HPA)](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale-walkthrough/)，你可以給 Deployment 設置一個 autoscaler，基於當前 Pod 的 CPU 利用率選擇最少和最多的 Pod 數。

```sh
$ kubectl autoscale deployment nginx-deployment --min=10 --max=15 --cpu-percent=80
deployment "nginx-deployment" autoscaled
```

## 比例擴容

RollingUpdate Deployment 支持同時運行一個應用的多個版本。當你或者 autoscaler 擴容一個正在 rollout 中（進行中或者已經暫停）的 RollingUpdate Deployment 的時候，為了降低風險，Deployment controller 將會平衡已存在的 active 的 ReplicaSets（有 Pod 的 ReplicaSets）和新加入的 replicas。這被稱為比例擴容。

例如，你正在運行中含有 10 個 replica 的 Deployment。maxSurge=3，maxUnavailable=2。

```sh
$ kubectl get deploy
NAME                 DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
nginx-deployment     10        10        10           10          50s
```

你更新了一個鏡像，而在集群內部無法解析。

```sh
$ kubectl set image deploy/nginx-deployment nginx=nginx:sometag
deployment "nginx-deployment" image updated
```

鏡像更新啟動了一個包含 ReplicaSet nginx-deployment-1989198191 的新的 rollout，但是它被阻塞了，因為我們上面提到的 maxUnavailable。

```sh
$ kubectl get rs
NAME                          DESIRED   CURRENT   READY     AGE
nginx-deployment-1989198191   5         5         0         9s
nginx-deployment-618515232    8         8         8         1m
```

然後發起了一個新的 Deployment 擴容請求。autoscaler 將 Deployment 的 replica 數目增加到了 15 個。Deployment controller 需要判斷在哪裡增加這 5 個新的 replica。如果我們沒有使用比例擴容，所有的 5 個 replica 都會加到一個新的 ReplicaSet 中。如果使用比例擴容，新添加的 replica 將傳播到所有的 ReplicaSet 中。大的部分加入 replica 數最多的 ReplicaSet 中，小的部分加入到 replica 數少的 ReplciaSet 中。0 個 replica 的 ReplicaSet 不會被擴容。

在我們上面的例子中，3 個 replica 將添加到舊的 ReplicaSet 中，2 個 replica 將添加到新的 ReplicaSet 中。rollout 進程最終會將所有的 replica 移動到新的 ReplicaSet 中，假設新的 replica 成為健康狀態。

```sh
$ kubectl get deploy
NAME                 DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
nginx-deployment     15        18        7            8           7m
$ kubectl get rs
NAME                          DESIRED   CURRENT   READY     AGE
nginx-deployment-1989198191   7         7         0         7m
nginx-deployment-618515232    11        11        11        7m
```

## 暫停和恢復 Deployment

你可以在觸發一次或多次更新前暫停一個 Deployment，然後再恢復它。這樣你就能多次暫停和恢復 Deployment，在此期間進行一些修復工作，而不會觸發不必要的 rollout。

例如使用剛剛創建 Deployment：

```sh
$ kubectl get deploy
NAME      DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
nginx     3         3         3            3           1m
[mkargaki@dhcp129-211 kubernetes]$ kubectl get rs
NAME               DESIRED   CURRENT   READY     AGE
nginx-2142116321   3         3         3         1m
```

使用以下命令暫停 Deployment：

```sh
$ kubectl rollout pause deployment/nginx-deployment
deployment "nginx-deployment" paused
```

然後更新 Deplyment 中的鏡像：

```sh
$ kubectl set image deploy/nginx nginx=nginx:1.9.1
deployment "nginx-deployment" image updated
```

注意沒有啟動新的 rollout：

```sh
$ kubectl rollout history deploy/nginx
deployments "nginx"
REVISION  CHANGE-CAUSE
1   <none>

$ kubectl get rs
NAME               DESIRED   CURRENT   READY     AGE
nginx-2142116321   3         3         3         2m
```

你可以進行任意多次更新，例如更新使用的資源：

```sh
$ kubectl set resources deployment nginx -c=nginx --limits=cpu=200m,memory=512Mi
deployment "nginx" resource requirements updated
```

Deployment 暫停前的初始狀態將繼續它的功能，而不會對 Deployment 的更新產生任何影響，只要 Deployment 是暫停的。

最後，恢復這個 Deployment，觀察完成更新的 ReplicaSet 已經創建出來了：

```sh
$ kubectl rollout resume deploy nginx
deployment "nginx" resumed
$ KUBECTL get rs -w
NAME               DESIRED   CURRENT   READY     AGE
nginx-2142116321   2         2         2         2m
nginx-3926361531   2         2         0         6s
nginx-3926361531   2         2         1         18s
nginx-2142116321   1         2         2         2m
nginx-2142116321   1         2         2         2m
nginx-3926361531   3         2         1         18s
nginx-3926361531   3         2         1         18s
nginx-2142116321   1         1         1         2m
nginx-3926361531   3         3         1         18s
nginx-3926361531   3         3         2         19s
nginx-2142116321   0         1         1         2m
nginx-2142116321   0         1         1         2m
nginx-2142116321   0         0         0         2m
nginx-3926361531   3         3         3         20s
^C
$ KUBECTL get rs
NAME               DESIRED   CURRENT   READY     AGE
nginx-2142116321   0         0         0         2m
nginx-3926361531   3         3         3         28s
```

** 注意：** 在恢復 Deployment 之前你無法回退一個暫停了的 Deployment。

## Deployment 狀態

Deployment 在生命週期中有多種狀態。在創建一個新的 ReplicaSet 的時候它可以是 [progressing](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#progressing-deployment) 狀態， [complete](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#complete-deployment) 狀態，或者 [fail to progress](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#failed-deployment) 狀態。

### Progressing Deployment

Kubernetes 將執行過下列任務之一的 Deployment 標記為 *progressing* 狀態：

- Deployment 正在創建新的 ReplicaSet 過程中。
- Deployment 正在擴容一個已有的 ReplicaSet。
- Deployment 正在縮容一個已有的 ReplicaSet。
- 有新的可用的 pod 出現。

你可以使用 `kubectl rollout status` 命令監控 Deployment 的進度。

### Complete Deployment

Kubernetes 將包括以下特性的 Deployment 標記為 *complete* 狀態：

- Deployment 最小可用。最小可用意味著 Deployment 的可用 replica 個數等於或者超過 Deployment 策略中的期望個數。
- 所有與該 Deployment 相關的 replica 都被更新到了你指定版本，也就說更新完成。
- 該 Deployment 中沒有舊的 Pod 存在。

你可以用 `kubectl rollout status` 命令查看 Deployment 是否完成。如果 rollout 成功完成，`kubectl rollout status` 將返回一個 0 值的 Exit Code。

```sh
$ kubectl rollout status deploy/nginx
Waiting for rollout to finish: 2 of 3 updated replicas are available...
deployment "nginx" successfully rolled out
$ echo $?
0
```

### Failed Deployment

你的 Deployment 在嘗試部署新的 ReplicaSet 的時候可能卡住，永遠也不會完成。這可能是因為以下幾個因素引起的：

- 無效的引用
- 不可讀的 probe failure
- 鏡像拉取錯誤
- 權限不夠
- 範圍限制
- 程序運行時配置錯誤

探測這種情況的一種方式是，在你的 Deployment spec 中指定 [`spec.progressDeadlineSeconds`](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#progress-deadline-seconds)。`spec.progressDeadlineSeconds` 表示 Deployment controller 等待多少秒才能確定（通過 Deployment status）Deployment 進程是卡住的。

下面的 `kubectl` 命令設置 `progressDeadlineSeconds` 使 controller 在 Deployment 在進度卡住 10 分鐘後報告：

```sh
$ kubectl patch deployment/nginx-deployment -p '{"spec":{"progressDeadlineSeconds":600}}'
"nginx-deployment" patched
```

當超過截止時間後，Deployment controller 會在 Deployment 的 `status.conditions` 中增加一條 DeploymentCondition，它包括如下屬性：

- Type=Progressing
- Status=False
- Reason=ProgressDeadlineExceeded

瀏覽 [Kubernetes API conventions](https://github.com/kubernetes/community/blob/master/contributors/devel/api-conventions.md#typical-status-properties) 查看關於 status conditions 的更多信息。

**注意:** kubernetes 除了報告 `Reason=ProgressDeadlineExceeded` 狀態信息外不會對卡住的 Deployment 做任何操作。更高層次的協調器可以利用它並採取相應行動，例如，回滾 Deployment 到之前的版本。

** 注意：** 如果你暫停了一個 Deployment，在暫停的這段時間內 kubernetnes 不會檢查你指定的 deadline。你可以在 Deployment 的 rollout 途中安全的暫停它，然後再恢復它，這不會觸發超過 deadline 的狀態。

你可能在使用 Deployment 的時候遇到一些短暫的錯誤，這些可能是由於你設置了太短的 timeout，也有可能是因為各種其他錯誤導致的短暫錯誤。例如，假設你使用了無效的引用。當你 Describe Deployment 的時候可能會注意到如下信息：

```sh
$ kubectl describe deployment nginx-deployment
<...>
Conditions:
  Type            Status  Reason
  ----            ------  ------
  Available       True    MinimumReplicasAvailable
  Progressing     True    ReplicaSetUpdated
  ReplicaFailure  True    FailedCreate
<...>
```

執行 `kubectl get deployment nginx-deployment -o yaml`，Deployement 的狀態可能看起來像這個樣子：

```yaml
status:
  availableReplicas: 2
  conditions:
  - lastTransitionTime: 2016-10-04T12:25:39Z
    lastUpdateTime: 2016-10-04T12:25:39Z
    message: Replica set "nginx-deployment-4262182780" is progressing.
    reason: ReplicaSetUpdated
    status: "True"
    type: Progressing
  - lastTransitionTime: 2016-10-04T12:25:42Z
    lastUpdateTime: 2016-10-04T12:25:42Z
    message: Deployment has minimum availability.
    reason: MinimumReplicasAvailable
    status: "True"
    type: Available
  - lastTransitionTime: 2016-10-04T12:25:39Z
    lastUpdateTime: 2016-10-04T12:25:39Z
    message: 'Error creating: pods"nginx-deployment-4262182780-" is forbidden: exceeded quota:
      object-counts, requested: pods=1, used: pods=3, limited: pods=2'
    reason: FailedCreate
    status: "True"
    type: ReplicaFailure
  observedGeneration: 3
  replicas: 2
  unavailableReplicas: 2
```

最終，一旦超過 Deployment 進程的 deadline，kuberentes 會更新狀態和導致 Progressing 狀態的原因：

```sh
Conditions:
  Type            Status  Reason
  ----            ------  ------
  Available       True    MinimumReplicasAvailable
  Progressing     False   ProgressDeadlineExceeded
  ReplicaFailure  True    FailedCreate

```

你可以通過縮容 Deployment 的方式解決配額不足的問題，或者增加你的 namespace 的配額。如果你滿足了配額條件後，Deployment controller 就會完成你的 Deployment rollout，你將看到 Deployment 的狀態更新為成功狀態（`Status=True` 並且 `Reason=NewReplicaSetAvailable`）。

```sh
Conditions:
  Type          Status  Reason
  ----          ------  ------
  Available     True    MinimumReplicasAvailable
  Progressing   True    NewReplicaSetAvailable

```

`Type=Available`、 `Status=True` 意味著你的 Deployment 有最小可用性。 最小可用性是在 Deployment 策略中指定的參數。
`Type=Progressing` 、 `Status=True` 意味著你的 Deployment 或者在部署過程中，或者已經成功部署，達到了期望的最少的可用 replica 數量（查看特定狀態的 Reason——在我們的例子中 `Reason=NewReplicaSetAvailable` 意味著 Deployment 已經完成）。

你可以使用 `kubectl rollout status` 命令查看 Deployment 進程是否失敗。當 Deployment 過程超過了 deadline，`kubectl rollout status` 將返回非 0 的 exit code。

```sh
$ kubectl rollout status deploy/nginx
Waiting for rollout to finish: 2 out of 3 new replicas have been updated...
error: deployment "nginx" exceeded its progress deadline
$ echo $?
1
```

### 操作失敗的 Deployment

所有對完成的 Deployment 的操作都適用於失敗的 Deployment。你可以對它擴／縮容，回退到歷史版本，你甚至可以多次暫停它來應用 Deployment pod template。

## 清理 Policy

你可以設置 Deployment 中的 `.spec.revisionHistoryLimit` 項來指定保留多少舊的 ReplicaSet。 餘下的將在後臺被當作垃圾收集。默認的，所有的 revision 歷史都會被保留。在未來的版本中，將會更改為 2。

**注意：** 將該值設置為 0，將導致該 Deployment 的所有歷史記錄都被清除，也就無法回退了。

## 用例

### Canary Deployment

如果你想要使用 Deployment 對部分用戶或服務器發佈 release，你可以創建多個 Deployment，每個對一個 release，參照 [managing resources](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) 中對 canary 模式的描述。

## 編寫 Deployment Spec

在所有的 Kubernetes 配置中，Deployment 也需要 `apiVersion`，`kind` 和 `metadata` 這些配置項。配置文件的通用使用說明查看 [部署應用](https://kubernetes.io/docs/tasks/run-application/run-stateless-application-deployment/)，配置容器，和[使用 kubeclt 管理資源](https://kubernetes.io/docs/concepts/overview/working-with-objects/object-management/) 文檔。

Deployment 也需要 [`.spec` section](https://github.com/kubernetes/community/blob/master/contributors/devel/api-conventions.md#spec-and-status).

### Pod Template

 `.spec.template` 是 `.spec` 中唯一要求的字段。

`.spec.template` 是 [pod template](https://kubernetes.io/docs/concepts/workloads/controllers/replicationcontroller/#pod-template). 它跟 [Pod](https://kubernetes.io/docs/concepts/workloads/pods/pod-overview/) 有一模一樣的 schema，除了它是嵌套的並且不需要 `apiVersion` 和 `kind` 字段。

另外為了劃分 Pod 的範圍，Deployment 中的 pod template 必須指定適當的 label（不要跟其他 controller 重複了，參考 [selector](https://github.com/kubernetes/kubernetes.github.io/blob/master/docs/concepts/workloads/controllers/deployment.md#selector)）和適當的重啟策略。

[`.spec.template.spec.restartPolicy`](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/) 可以設置為 `Always` , 如果不指定的話這就是默認配置。

### Replicas

`.spec.replicas` 是可以選字段，指定期望的 pod 數量，默認是 1。

### Selector

`.spec.selector` 是可選字段，用來指定 [label selector](https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/) ，圈定 Deployment 管理的 pod 範圍。

如果被指定， `.spec.selector` 必須匹配 `.spec.template.metadata.labels`，否則它將被 API 拒絕。如果 `.spec.selector` 沒有被指定， `.spec.selector.matchLabels` 默認是 `.spec.template.metadata.labels`。

在 Pod 的 template 跟 `.spec.template` 不同或者數量超過了 `.spec.replicas` 規定的數量的情況下，Deployment 會殺掉 label 跟 selector 不同的 Pod。

** 注意：** 你不應該再創建其他 label 跟這個 selector 匹配的 pod，或者通過其他 Deployment，或者通過其他 Controller，例如 ReplicaSet 和 ReplicationController。否則該 Deployment 會被把它們當成都是自己創建的。Kubernetes 不會阻止你這麼做。

如果你有多個 controller 使用了重複的 selector，controller 們就會互相打架並導致不正確的行為。

### 策略

`.spec.strategy` 指定新的 Pod 替換舊的 Pod 的策略。 `.spec.strategy.type` 可以是 "Recreate" 或者是 "RollingUpdate"。"RollingUpdate" 是默認值。

#### Recreate Deployment

`.spec.strategy.type==Recreate` 時，在創建出新的 Pod 之前會先殺掉所有已存在的 Pod。

#### Rolling Update Deployment

`.spec.strategy.type==RollingUpdate` 時，Deployment 使用 [rolling update](https://kubernetes.io/docs/tasks/run-application/rolling-update-replication-controller/) 的方式更新 Pod 。你可以指定 `maxUnavailable` 和 `maxSurge` 來控制 rolling update 進程。

##### Max Unavailable

`.spec.strategy.rollingUpdate.maxUnavailable` 是可選配置項，用來指定在升級過程中不可用 Pod 的最大數量。該值可以是一個絕對值（例如 5），也可以是期望 Pod 數量的百分比（例如 10%）。通過計算百分比的絕對值向下取整。如果 `.spec.strategy.rollingUpdate.maxSurge` 為 0 時，這個值不可以為 0。默認值是 1。

例如，該值設置成 30%，啟動 rolling update 後舊的 ReplicatSet 將會立即縮容到期望的 Pod 數量的 70%。新的 Pod ready 後，隨著新的 ReplicaSet 的擴容，舊的 ReplicaSet 會進一步縮容，確保在升級的所有時刻可以用的 Pod 數量至少是期望 Pod 數量的 70%。

##### Max Surge

`.spec.strategy.rollingUpdate.maxSurge` 是可選配置項，用來指定可以超過期望的 Pod 數量的最大個數。該值可以是一個絕對值（例如 5）或者是期望的 Pod 數量的百分比（例如 10%）。當 `MaxUnavailable` 為 0 時該值不可以為 0。通過百分比計算的絕對值向上取整。默認值是 1。

例如，該值設置成 30%，啟動 rolling update 後新的 ReplicatSet 將會立即擴容，新老 Pod 的總數不能超過期望的 Pod 數量的 130%。舊的 Pod 被殺掉後，新的 ReplicaSet 將繼續擴容，舊的 ReplicaSet 會進一步縮容，確保在升級的所有時刻所有的 Pod 數量和不會超過期望 Pod 數量的 130%。

### Progress Deadline Seconds

`.spec.progressDeadlineSeconds` 是可選配置項，用來指定在系統報告 Deployment 的 [failed progressing](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#failed-deployment) ——表現為 resource 的狀態中 `type=Progressing`、`Status=False`、 `Reason=ProgressDeadlineExceeded` 前可以等待的 Deployment 進行的秒數。Deployment controller 會繼續重試該 Deployment。未來，在實現了自動回滾後， deployment controller 在觀察到這種狀態時就會自動回滾。

如果設置該參數，該值必須大於 `.spec.minReadySeconds`。

### Min Ready Seconds

`.spec.minReadySeconds` 是一個可選配置項，用來指定沒有任何容器 crash 的 Pod 並被認為是可用狀態的最小秒數。默認是 0（Pod 在 ready 後就會被認為是可用狀態）。進一步瞭解什麼時候 Pod 會被認為是 ready 狀態，參閱 [Container Probes](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#container-probes)。

### Rollback To

`.spec.rollbackTo` 是一個可以選配置項，用來配置 Deployment 回退的配置。設置該參數將觸發回退操作，每次回退完成後，該值就會被清除。

#### Revision

`.spec.rollbackTo.revision` 是一個可選配置項，用來指定回退到的 revision。默認是 0，意味著回退到上一個 revision。

### Revision History Limit

Deployment revision history 存儲在它控制的 ReplicaSets 中。

`.spec.revisionHistoryLimit` 是一個可選配置項，用來指定可以保留的舊的 ReplicaSet 數量。該理想值取決於新 Deployment 的頻率和穩定性。如果該值沒有設置的話，默認所有舊的 Replicaset 或會被保留，將資源存儲在 etcd 中，使用 `kubectl get rs` 查看輸出。每個 Deployment 的該配置都保存在 ReplicaSet 中，然而，一旦你刪除的舊的 RepelicaSet，你的 Deployment 就無法再回退到那個 revison 了。

如果你將該值設置為 0，所有具有 0 個 replica 的 ReplicaSet 都會被刪除。在這種情況下，新的 Deployment rollout 無法撤銷，因為 revision history 都被清理掉了。

### Paused

`.spec.paused` 是可選配置項，boolean 值。用來指定暫停和恢復 Deployment。Paused 和非 paused 的 Deployment 之間的唯一區別就是，所有對 paused deployment 中的 PodTemplateSpec 的修改都不會觸發新的 rollout。Deployment 被創建之後默認是非 paused。

## Alternative to Deployments

### kubectl rolling update

[Kubectl rolling update](https://kubernetes.io/docs/tasks/run-application/rolling-update-replication-controller/) 雖然使用類似的方式更新 Pod 和 ReplicationController。但是我們推薦使用 Deployment，因為它是聲明式的，客戶端側，具有附加特性，例如即使滾動升級結束後也可以回滾到任何歷史版本。
