# Scheduler 擴展

如果默認的調度器不滿足要求，還可以部署自定義的調度器。並且，在整個集群中還可以同時運行多個調度器實例，通過 `podSpec.schedulerName` 來選擇使用哪一個調度器（默認使用內置的調度器）。

## 開發自定義調度器

自定義調度器主要的功能是查詢未調度的 Pod，按照自定義的調度策略選擇新的 Node，並將其更新到 Pod 的 Node Binding 上。

比如，一個最簡單的調度器可以用 shell 來編寫（假設 Kubernetes 監聽在 `localhost:8001`）：

```sh
#!/bin/bash
SERVER='localhost:8001'
while true;
do
    for PODNAME in $(kubectl --server $SERVER get pods -o json | jq '.items[] | select(.spec.schedulerName =="my-scheduler") | select(.spec.nodeName == null) | .metadata.name' | tr -d '"')
;
    do
        NODES=($(kubectl --server $SERVER get nodes -o json | jq '.items[].metadata.name' | tr -d '"'))
        NUMNODES=${#NODES[@]}
        CHOSEN=${NODES[$[ $RANDOM % $NUMNODES]]}
        curl --header "Content-Type:application/json" --request POST --data '{"apiVersion":"v1","kind":"Binding","metadata": {"name":"'$PODNAME'"},"target": {"apiVersion":"v1","kind"
: "Node", "name": "'$CHOSEN'"}}' http://$SERVER/api/v1/namespaces/default/pods/$PODNAME/binding/
        echo "Assigned $PODNAME to $CHOSEN"
    done
    sleep 1
done
```

## 使用自定義調度器

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
  labels:
    app: nginx
spec:
  # 選擇使用自定義調度器 my-scheduler
  schedulerName: my-scheduler
  containers:
  - name: nginx
    image: nginx:1.10
```
