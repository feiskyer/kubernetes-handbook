# Kubernetes 配置最佳實踐

本文檔旨在彙總和強調用戶指南、快速開始文檔和示例中的最佳實踐。該文檔會很很活躍並持續更新中。如果你覺得很有用的最佳實踐但是本文檔中沒有包含，歡迎給我們提 Pull Request。

## 通用配置建議

- 定義配置文件的時候，指定最新的穩定 API 版本。
- 在部署配置文件到集群之前應該保存在版本控制系統中。這樣當需要的時候能夠快速回滾，必要的時候也可以快速的創建集群。
- 使用 YAML 格式而不是 JSON 格式的配置文件。在大多數場景下它們都可以互換，但是 YAML 格式比 JSON 更友好。
- 儘量將相關的對象放在同一個配置文件裡，這樣比分成多個文件更容易管理。參考 [guestbook-all-in-one.yaml](https://github.com/kubernetes/examples/blob/master/guestbook/all-in-one/guestbook-all-in-one.yaml) 文件中的配置。
- 使用 `kubectl` 命令時指定配置文件目錄。
- 不要指定不必要的默認配置，這樣更容易保持配置文件簡單並減少配置錯誤。
- 將資源對象的描述放在一個 annotation 中可以更好的內省。


## 裸奔的 Pods vs Replication Controllers 和 Jobs

- 如果有其他方式替代 “裸奔的 pod”（如沒有綁定到 [replication controller ](https://kubernetes.io/docs/user-guide/replication-controller) 上的 pod），那麼就使用其他選擇。
- 在 node 節點出現故障時，裸奔的 pod 不會被重新調度。
- Replication Controller 總是會重新創建 pod，除了明確指定了 [`restartPolicy: Never`](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#restart-policy) 的場景。[Job](https://kubernetes.io/docs/concepts/jobs/run-to-completion-finite-workloads/) 對象也適用。


## Services

- 通常最好在創建相關的 [replication controllers](https://kubernetes.io/docs/concepts/workloads/controllers/replicationcontroller/) 之前先創建 [service](https://kubernetes.io/docs/concepts/services-networking/service/)。這樣可以保證容器在啟動時就配置了該服務的環境變量。對於新的應用，推薦通過服務的 DNS 名字來訪問（而不是通過環境變量）。
- 除非有必要（如運行一個 node daemon），不要使用配置 `hostPort` 的 Pod（用來指定暴露在主機上的端口號）。當你給 Pod 綁定了一個 `hostPort`，該 Pod 會因為端口衝突很難調度。如果是為了調試目的來通過端口訪問的話，你可以使用 [kubectl proxy and apiserver proxy](https://kubernetes.io/docs/tasks/access-kubernetes-api/http-proxy-access-api/) 或者 [kubectl port-forward](https://kubernetes.io/docs/tasks/access-application-cluster/port-forward-access-application-cluster/)。你可使用 [Service](https://kubernetes.io/docs/concepts/services-networking/service/) 來對外暴露服務。如果你確實需要將 pod 的端口暴露到主機上，考慮使用 [NodePort](https://kubernetes.io/docs/user-guide/services/#type-nodeport) service。
- 跟 `hostPort` 一樣的原因，避免使用 `hostNetwork`。
- 如果你不需要 kube-proxy 的負載均衡的話，可以考慮使用使用 [headless services](https://kubernetes.io/docs/user-guide/services/#headless-services)（ClusterIP 為 None）。

## 使用 Label

- 使用 [labels](https://kubernetes.io/docs/user-guide/labels/) 來指定應用或 Deployment 的語義屬性。這樣可以讓你能夠選擇合適於場景的對象組，比如 `app: myapp, tire: frontend, phase: test, deployment: v3`。
- 一個 service 可以被配置成跨越多個 deployment，只需要在它的 label selector 中簡單的省略發佈相關的 label。
- 注意 [Deployment](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) 對象不需要再管理 replication controller 的版本名。Deployment 中描述了對象的期望狀態，如果對 spec 的更改被應用了話，Deployment controller 會以控制的速率來更改實際狀態到期望狀態。
- 利用 label 做調試。因為 Kubernetes replication controller 和 service 使用 label 來匹配 pods，這允許你通過移除 pod 的相關label的方式將其從一個 controller 或者 service 中移除，而 controller 會創建一個新的 pod 來取代移除的 pod。這是一個很有用的方式，幫你在一個隔離的環境中調試之前的 “活著的” pod。

## 容器鏡像

- 默認容器鏡像拉取策略是 `IfNotPresent`, 當本地已存在該鏡像的時候 Kubelet 不會再從鏡像倉庫拉取。如果你希望總是從鏡像倉庫中拉取鏡像的話，在 yaml 文件中指定鏡像拉取策略為 `Always`（ `imagePullPolicy: Always`）或者指定鏡像的 tag 為 `:latest` 。
- 如果你沒有將鏡像標籤指定為 `:latest`，例如指定為 `myimage:v1`，當該標籤的鏡像進行了更新，kubelet 也不會拉取該鏡像。你可以在每次鏡像更新後都生成一個新的 tag（例如 `myimage:v2`），在配置文件中明確指定該版本。
- 可以使用鏡像的摘要（Digest）來保證容器總是使用同一版本的鏡像。
- ** 注意：** 在生產環境下部署容器應該儘量避免使用 `:latest` 標籤，因為這樣很難追溯到底運行的是哪個版本以及發生故障時該如何回滾。

## 使用 kubectl

- 儘量使用 `kubectl create -f <directory>` 或 `kubectl apply -f <directory` 。kubeclt 會自動查找該目錄下的所有後綴名為 `.yaml`、`.yml` 和 `.json` 文件並將它們傳遞給 `create` 或 `apply` 命令。

- `kubectl get` 或 `kubectl delete` 時使用標籤選擇器可以批量操作一組對象。

- 使用 `kubectl run` 和 `expose` 命令快速創建只有單個容器的 Deployment 和 Service，如

  ```sh
  kubectl run hello-world --replicas=2 --labels="run=load-balancer-example" --image=gcr.io/google-samples/node-hello:1.0  --port=8080
  kubectl expose deployment hello-world --type=NodePort --name=example-service
  kubectl get pods --selector="run=load-balancer-example" --output=wide
  ```

## 參考文檔

- [Configuration Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
