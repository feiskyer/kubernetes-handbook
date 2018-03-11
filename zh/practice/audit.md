# Kubernetes 审计

Kubernetes 审计（Audit）提供了安全相关的时序操作记录，支持日志和 webhook 两种格式，并可以通过审计策略自定义事件类型。

## 审计日志

通过配置 kube-apiserver 的下列参数开启审计日志

- audit-log-path：审计日志路径
- audit-log-maxage：旧日志最长保留天数
- audit-log-maxbackup：旧日志文件最多保留个数
- audit-log-maxsize：日志文件最大大小（单位 MB），超过后自动做轮转（默认为 100MB）

每条审计记录包括两行

- 请求行包括：唯一 ID 和请求的元数据（如源 IP、用户名、请求资源等）
- 响应行包括：唯一 ID（与请求 ID 一致）和响应的元数据（如 HTTP 状态码）

比如，admin 用户查询默认 namespace 的 Pod 列表的审计日志格式为

```sh
2017-03-21T03:57:09.106841886-04:00 AUDIT: id="c939d2a7-1c37-4ef1-b2f7-4ba9b1e43b53" ip="127.0.0.1" method="GET" user="admin" groups="\"system:masters\",\"system:authenticated\""as="<self>"asgroups="<lookup>"namespace="default"uri="/api/v1/namespaces/default/pods"
2017-03-21T03:57:09.108403639-04:00 AUDIT: id="c939d2a7-1c37-4ef1-b2f7-4ba9b1e43b53" response="200"
```

## 审计策略

v1.7 + 支持实验性的高级审计特性，可以自定义审计策略（选择记录哪些事件）和审计存储后端（日志和 webhook）等。开启方法为

```sh
kube-apiserver ... --feature-gates=AdvancedAuditing=true
```

注意开启 AdvancedAuditing 后，日志的格式有一些修改，如新增了 stage 字段（包括 RequestReceived，ResponseStarted ，ResponseComplete，Panic 等）。

## 审计策略

审计策略选择记录哪些事件，设置方法为

```sh
kube-apiserver ... --audit-policy-file=/etc/kubernetes/audit-policy.yaml
```

其中，设计策略的配置格式为

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

在生产环境中，推荐参考 [GCE 审计策略](https://github.com/kubernetes/kubernetes/blob/v1.7.0/cluster/gce/gci/configure-helper.sh#L490) 配置。

### 审计存储后端

审计存储后端支持两种方式

- 日志，配置 `--audit-log-path` 开启，格式为

```
2017-06-15T21:50:50.259470834Z AUDIT: id="591e9fde-6a98-46f6-b7bc-ec8ef575696d" stage="RequestReceived" ip="10.2.1.3" method="update" user="system:serviceaccount:kube-system:default" groups="\"system:serviceaccounts\",\"system:serviceaccounts:kube-system\",\"system:authenticated\""as="<self>"asgroups="<lookup>"namespace="kube-system"uri="/api/v1/namespaces/kube-system/endpoints/kube-controller-manager"response="<deferred>"
2017-06-15T21:50:50.259470834Z AUDIT: id="591e9fde-6a98-46f6-b7bc-ec8ef575696d" stage="ResponseComplete" ip="10.2.1.3" method="update" user="system:serviceaccount:kube-system:default" groups="\"system:serviceaccounts\",\"system:serviceaccounts:kube-system\",\"system:authenticated\""as="<self>"asgroups="<lookup>"namespace="kube-system"uri="/api/v1/namespaces/kube-system/endpoints/kube-controller-manager"response="200"
```

- webhook，配置 `--audit-webhook-config-file=/etc/kubernetes/audit-webhook-kubeconfig --audit-webhook-mode=batch` 开启，其中 audit-webhook-mode 支持 batch 和 blocking 两种格式，而 webhook 配置文件格式为

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

所有的事件以 JSON 格式 POST 给 webhook server，如

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
