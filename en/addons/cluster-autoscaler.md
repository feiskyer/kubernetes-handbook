# Cluster AutoScaler

Cluster AutoScaler 是一個自動擴展和收縮 Kubernetes 集群 Node 的擴展。當集群容量不足時，它會自動去 Cloud Provider （支持 GCE、GKE 和 AWS）創建新的 Node，而在 Node 長時間資源利用率很低時自動將其刪除以節省開支。

Cluster AutoScaler 獨立於 Kubernetes 主代碼庫，維護在 <https://github.com/kubernetes/autoscaler>。

## 部署

Cluster AutoScaler v1.0+ 可以基於 Docker 鏡像 `gcr.io/google_containers/cluster-autoscaler:v1.0.0` 來部署，詳細的部署步驟可以參考

- GCE: <https://kubernetes.io/docs/concepts/cluster-administration/cluster-management/>
- GKE: <https://cloud.google.com/container-engine/docs/cluster-autoscaler>
- AWS: <https://github.com/kubernetes/autoscaler/blob/master/cluster-autoscaler/cloudprovider/aws/README.md>
- Azure: <https://github.com/kubernetes/autoscaler/tree/master/cluster-autoscaler/cloudprovider/azure>

比如 Azure 中的部署方式為

```yaml
apiVersion: v1
data:
  ClientID: <client-id>
  ClientSecret: <client-secret>
  ResourceGroup: <resource-group>
  SubscriptionID: <subscription-id>
  TenantID: <tenand-id>
  ScaleSetName: <scale-set-name>
kind: ConfigMap
metadata:
  name: cluster-autoscaler-azure
  namespace: kube-system
---
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: cluster-autoscaler
  namespace: kube-system
  labels:
    app: cluster-autoscaler
spec:
  replicas: 1
  selector:
    matchLabels:
      app: cluster-autoscaler
  template:
    metadata:
      labels:
        app: cluster-autoscaler
    spec:
      tolerations:
      - effect: NoSchedule
        key: node-role.kubernetes.io/master
      nodeSelector:
        kubernetes.io/role: master
      containers:
      - image: gcr.io/google_containers/cluster-autoscaler:{{ca_version}}
        name: cluster-autoscaler
        resources:
          limits:
            cpu: 100m
            memory: 300Mi
          requests:
            cpu: 100m
            memory: 300Mi
        env:
        - name: ARM_SUBSCRIPTION_ID
          valueFrom:
            configMapKeyRef:
              name: cluster-autoscaler-azure
              key: SubscriptionID
        - name: ARM_RESOURCE_GROUP
          valueFrom:
            configMapKeyRef:
              name: cluster-autoscaler-azure
              key: ResourceGroup
        - name: ARM_TENANT_ID
          valueFrom:
            configMapKeyRef:
              name: cluster-autoscaler-azure
              key: TenantID
        - name: ARM_CLIENT_ID
          valueFrom:
            configMapKeyRef:
              name: cluster-autoscaler-azure
              key: ClientID
        - name: ARM_CLIENT_SECRET
          valueFrom:
            configMapKeyRef:
              name: cluster-autoscaler-azure
              key: ClientSecret
        - name: ARM_SCALE_SET_NAME
          valueFrom:
            configMapKeyRef:
              name: cluster-autoscaler-azure
              key: ScaleSetName
        command:
          - ./cluster-autoscaler
          - --v=4
          - --cloud-provider=azure
          - --skip-nodes-with-local-storage=false
          - --nodes="1:10:$(ARM_SCALE_SET_NAME)"
        volumeMounts:
          - name: ssl-certs
            mountPath: /etc/ssl/certs/ca-certificates.crt
            readOnly: true
        imagePullPolicy: "Always"
      volumes:
      - name: ssl-certs
        hostPath:
          path: "/etc/ssl/certs/ca-certificates.crt"
```

## 工作原理

Cluster AutoScaler 定期（默認間隔 10s）檢測是否有充足的資源來調度新創建的 Pod，當資源不足時會調用 Cloud Provider 創建新的 Node。

![](images/15084813044270.png)

為了自動創建和初始化 Node，Cluster Autoscaler 要求 Node 必須屬於某個 Node Group，比如

- GCE/GKE 中的 Managed instance groups（MIG）
- AWS 中的 Autoscaling Groups
- Azure 中的 Scale Sets 和 Availability Sets

當集群中有多個 Node Group 時，可以通過 `--expander=<option>` 選項配置選擇 Node Group 的策咯，支持如下四種方式

- random：隨機選擇
- most-pods：選擇容量最大（可以創建最多 Pod）的 Node Group
- least-waste：以最小浪費原則選擇，即選擇有最少可用資源的 Node Group
- price：選擇最便宜的 Node Group（僅支持 GCE 和 GKE）

目前，Cluster Autoscaler 可以保證

- 小集群（小於 100 個 Node）可以在不超過 30 秒內完成擴展（平均 5 秒）
- 大集群（100-1000 個 Node）可以在不超過 60 秒內完成擴展（平均 15 秒）

Cluster AutoScaler 也會定期（默認間隔 10s）自動監測 Node 的資源使用情況，當一個 Node 長時間（超過 10 分鐘其期間沒有執行任何擴展操作）資源利用率都很低時（低於 50%）自動將其所在虛擬機從雲服務商中刪除（注意刪除時會有 1 分鐘的 graceful termination 時間）。此時，原來的 Pod 會自動調度到其他 Node 上面（通過 Deployment、StatefulSet 等控制器）。

![](images/15084813160226.png)

注意，Cluster Autoscaler 僅根據 Pod 的調度情況和 Node 的整體資源使用清空來增刪 Node，跟 Pod 或 Node 的資源度量（metrics）沒有直接關係。

用戶在啟動 Cluster AutoScaler 時可以配置 Node 數量的範圍（包括最大 Node 數和最小 Node 數）。

在使用 Cluster AutoScaler 時需要注意：

- 由於在刪除 Node 時會發生 Pod 重新調度的情況，所以應用必須可以容忍重新調度和短時的中斷（比如使用多副本的 Deployment）
- 當 Node 上面的 [Pods 滿足下面的條件之一](https://github.com/kubernetes/autoscaler/blob/master/cluster-autoscaler/FAQ.md#what-types-of-pods-can-prevent-ca-from-removing-a-node) 時，Node 不會刪除
  - Pod 配置了 PodDisruptionBudget (PDB)
  - kube-system Pod 默認不在 Node 上運行或者未配置 PDB
  - Pod 不是通過 deployment, replica set, job, stateful set 等控制器創建的
  - Pod 使用了本地存儲
  - 其他原因導致的 Pod 無法重新調度，如資源不足，其他 Node 無法滿足 NodeSelector 或 Affinity 等

## 最佳實踐

- Cluster AutoScaler 可以和 Horizontal Pod Autoscaler（HPA）配合使用
- 不要手動修改 Node 配置，保證集群內的所有 Node 有相同的配置並屬於同一個 Node 組
- 運行 Pod 時指定資源請求
- 必要時使用 PodDisruptionBudgets 阻止 Pod 被誤刪除
- 確保雲服務商的配額充足
- Cluster AutoScaler **與雲服務商提供的 Node 自動擴展功能以及基於 CPU 利用率的 Node 自動擴展機制衝突，不要同時啟用**

## 參考文檔

- [Kubernetes Autoscaler](https://github.com/kubernetes/autoscaler)
- [Kubernetes Cluster AutoScaler Support](http://blog.spotinst.com/2017/06/14/k8-autoscaler-support/)
