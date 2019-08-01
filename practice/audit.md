# Kubernetes 審計

Kubernetes 審計（Audit）提供了安全相關的時序操作記錄，支持日誌和 webhook 兩種格式，並可以通過審計策略自定義事件類型。

## 審計日誌

通過配置 kube-apiserver 的下列參數開啟審計日誌

- audit-log-path：審計日誌路徑
- audit-log-maxage：舊日誌最長保留天數
- audit-log-maxbackup：舊日誌文件最多保留個數
- audit-log-maxsize：日誌文件最大大小（單位 MB），超過後自動做輪轉（默認為 100MB）

每條審計記錄包括兩行

- 請求行包括：唯一 ID 和請求的元數據（如源 IP、用戶名、請求資源等）
- 響應行包括：唯一 ID（與請求 ID 一致）和響應的元數據（如 HTTP 狀態碼）

比如，admin 用戶查詢默認 namespace 的 Pod 列表的審計日誌格式為

```sh
2017-03-21T03:57:09.106841886-04:00 AUDIT: id="c939d2a7-1c37-4ef1-b2f7-4ba9b1e43b53" ip="127.0.0.1" method="GET" user="admin" groups="\"system:masters\",\"system:authenticated\""as="<self>"asgroups="<lookup>"namespace="default"uri="/api/v1/namespaces/default/pods"
2017-03-21T03:57:09.108403639-04:00 AUDIT: id="c939d2a7-1c37-4ef1-b2f7-4ba9b1e43b53" response="200"
```

## 審計策略

v1.7 + 支持實驗性的高級審計特性，可以自定義審計策略（選擇記錄哪些事件）和審計存儲後端（日誌和 webhook）等。開啟方法為

```sh
kube-apiserver ... --feature-gates=AdvancedAuditing=true
```

注意開啟 AdvancedAuditing 後，日誌的格式有一些修改，如新增了 stage 字段（包括 RequestReceived，ResponseStarted ，ResponseComplete，Panic 等）。

## 審計策略

審計策略選擇記錄哪些事件，設置方法為

```sh
kube-apiserver ... --audit-policy-file=/etc/kubernetes/audit-policy.yaml
```

其中，設計策略的配置格式為

```yaml
rules:
  # Don't log watch requests by the"system:kube-proxy" on endpoints or services
  - level: None
    users: ["system:kube-proxy"]
    verbs: ["watch"]
    resources:
    - group: "" # core API group
      resources: ["endpoints", "services"]

  # Don't log authenticated requests to certain non-resource URL paths.
  - level: None
    userGroups: ["system:authenticated"]
    nonResourceURLs:
    - "/api*" # Wildcard matching.
    - "/version"

  # Log the request body of configmap changes in kube-system.
  - level: Request
    resources:
    - group: "" # core API group
      resources: ["configmaps"]
    # This rule only applies to resources in the "kube-system" namespace.
    # The empty string "" can be used to select non-namespaced resources.
    namespaces: ["kube-system"]

  # Log configmap and secret changes in all other namespaces at the Metadata level.
  - level: Metadata
    resources:
    - group: "" # core API group
      resources: ["secrets", "configmaps"]

  # Log all other resources in core and extensions at the Request level.
  - level: Request
    resources:
    - group: "" # core API group
    - group: "extensions" # Version of group should NOT be included.

  # A catch-all rule to log all other requests at the Metadata level.
  - level: Metadata
```

在生產環境中，推薦參考 [GCE 審計策略](https://github.com/kubernetes/kubernetes/blob/v1.7.0/cluster/gce/gci/configure-helper.sh#L490) 配置。

### 審計存儲後端

審計存儲後端支持兩種方式

- 日誌，配置 `--audit-log-path` 開啟，格式為

```
2017-06-15T21:50:50.259470834Z AUDIT: id="591e9fde-6a98-46f6-b7bc-ec8ef575696d" stage="RequestReceived" ip="10.2.1.3" method="update" user="system:serviceaccount:kube-system:default" groups="\"system:serviceaccounts\",\"system:serviceaccounts:kube-system\",\"system:authenticated\""as="<self>"asgroups="<lookup>"namespace="kube-system"uri="/api/v1/namespaces/kube-system/endpoints/kube-controller-manager"response="<deferred>"
2017-06-15T21:50:50.259470834Z AUDIT: id="591e9fde-6a98-46f6-b7bc-ec8ef575696d" stage="ResponseComplete" ip="10.2.1.3" method="update" user="system:serviceaccount:kube-system:default" groups="\"system:serviceaccounts\",\"system:serviceaccounts:kube-system\",\"system:authenticated\""as="<self>"asgroups="<lookup>"namespace="kube-system"uri="/api/v1/namespaces/kube-system/endpoints/kube-controller-manager"response="200"
```

- webhook，配置 `--audit-webhook-config-file=/etc/kubernetes/audit-webhook-kubeconfig --audit-webhook-mode=batch` 開啟，其中 audit-webhook-mode 支持 batch 和 blocking 兩種格式，而 webhook 配置文件格式為

```yaml
# clusters refers to the remote service.
clusters:
  - name: name-of-remote-audit-service
    cluster:
      certificate-authority: /path/to/ca.pem  # CA for verifying the remote service.
      server: https://audit.example.com/audit # URL of remote service to query. Must use 'https'.

# users refers to the API server's webhook configuration.
users:
  - name: name-of-api-server
    user:
      client-certificate: /path/to/cert.pem # cert for the webhook plugin to use
      client-key: /path/to/key.pem          # key matching the cert

# kubeconfig files require a context. Provide one for the API server.
current-context: webhook
contexts:
- context:
    cluster: name-of-remote-audit-service
    user: name-of-api-sever
  name: webhook
```

所有的事件以 JSON 格式 POST 給 webhook server，如

```json
{
  "kind": "EventList",
  "apiVersion": "audit.k8s.io/v1alpha1",
  "items": [
    {
      "metadata": {
        "creationTimestamp": null
      },
      "level": "Metadata",
      "timestamp": "2017-06-15T23:07:40Z",
      "auditID": "4faf711a-9094-400f-a876-d9188ceda548",
      "stage": "ResponseComplete",
      "requestURI": "/apis/rbac.authorization.k8s.io/v1beta1/namespaces/kube-public/rolebindings/system:controller:bootstrap-signer",
      "verb": "get",
      "user": {
        "username": "system:apiserver",
        "uid": "97a62906-e4d7-4048-8eda-4f0fb6ff8f1e",
        "groups": [
          "system:masters"
        ]
      },
      "sourceIPs": [
        "127.0.0.1"
      ],
      "objectRef": {
        "resource": "rolebindings",
        "namespace": "kube-public",
        "name": "system:controller:bootstrap-signer",
        "apiVersion": "rbac.authorization.k8s.io/v1beta1"
      },
      "responseStatus": {
        "metadata": {},
        "code": 200
      }
    }
  ]
}
```
