# Auditing in Kubernetes

Kubernetes auditing offers a chronological record of security-relevant operational actions, with support for both log and webhook formats. The type of events to record can be customized through audit policies.

## Audit Logs

Activate audit logs by configuring the following parameters on kube-apiserver:

* audit-log-path: The path to the audit log file
* audit-log-maxage: Maximum number of days to retain old log files
* audit-log-maxbackup: The maximum number of old log files to retain
* audit-log-maxsize: The maximum size (in MB) of the log file before it is rotated (defaults to 100MB)

Each audit record consists of two lines:

* The request line includes: a unique ID and metadata of the request (e.g., source IP, username, requested resource, etc.)
* The response line includes: a unique ID (matching the request ID) and metadata of the response (e.g., HTTP status code)

For instance, the audit log format for the admin user querying the pod list in the default namespace is:

```bash
2017-03-21T03:57:09.106841886-04:00 AUDIT: id="c939d2a7-1c37-4ef1-b2f7-4ba9b1e43b53" ip="127.0.0.1" method="GET" user="admin" groups="\"system:masters\",\"system:authenticated\"" as="<self>" asgroups="<lookup>" namespace="default" uri="/api/v1/namespaces/default/pods"
2017-03-21T03:57:09.108403639-04:00 AUDIT: id="c939d2a7-1c37-4ef1-b2f7-4ba9b1e43b53" response="200"
```

## Audit Policy

Starting with v1.7+, Kubernetes supports experimental advanced auditing features, allowing customization of audit policies (to select which events to record) and audit backends (including log and webhook). Enable this by setting:

```bash
kube-apiserver ... --feature-gates=AdvancedAuditing=true
```

Note that with AdvancedAuditing enabled, the log format will have some changes, such as an additional 'stage' field (including stages like RequestReceived, ResponseStarted, ResponseComplete, Panic, etc.).

### Audit Policy Details

The audit policy determines which events to record and is configured using:

```bash
kube-apiserver ... --audit-policy-file=/etc/kubernetes/audit-policy.yaml
```

The configuration format for defining policies is:

```yaml
rules:
  # Don't log watch requests by the "system:kube-proxy" on endpoints or services
  - level: None
    users: ["system:kube-proxy"]
    verbs: ["watch"]
    resources:
    - group: ""
      resources: ["endpoints", "services"]

  # Omit logging authenticated requests to certain non-resource URL paths
  - level: None
    userGroups: ["system:authenticated"]
    nonResourceURLs:
    - "/api*" # Wildcard matching
    - "/version"

  # Log request bodies of configmap changes in the kube-system namespace
  - level: Request
    resources:
    - group: ""
      resources: ["configmaps"]
    namespaces: ["kube-system"]

  # Log metadata for configmap and secret changes in all other namespaces
  - level: Metadata
    resources:
    - group: ""
      resources: ["secrets", "configmaps"]

  # Log requests for all other resources in core and extensions at the Request level
  - level: Request
    resources:
    - group: ""
    - group: "extensions"

  # A catch-all rule to log all other requests at the Metadata level
  - level: Metadata
```

In a production environment, it's recommended to refer to the [GCE Audit Policy](https://github.com/kubernetes/kubernetes/blob/v1.7.0/cluster/gce/gci/configure-helper.sh#L490) for configuration guidance.

### Audit Backends

Two types of audit storage backends are supported:

* Logs, enabled by setting `--audit-log-path`, with an example format being:

```text
2017-06-15T21:50:50.259470834Z AUDIT: id="591e9fde-6a98-46f6-b7bc-ec8ef575696d" stage="RequestReceived" ip="10.2.1.3" method="update" user="system:serviceaccount:kube-system:default" groups="\"system:serviceaccounts\",\"system:serviceaccounts:kube-system\",\"system:authenticated\"" as="<self>" asgroups="<lookup>" namespace="kube-system" uri="/api/v1/namespaces/kube-system/endpoints/kube-controller-manager" response="<deferred>"
2017-06-15T21:50:50.259470834Z AUDIT: id="591e9fde-6a98-46f6-b7bc-ec8ef575696d" stage="ResponseComplete" ip="10.2.1.3" method="update" user="system:serviceaccount:kube-system:default" groups="\"system:serviceaccounts\",\"system:serviceaccounts:kube-system\",\"system:authenticated\"" as="<self>" asgroups="<lookup>" namespace="kube-system" uri="/api/v1/namespaces/kube-system/endpoints/kube-controller-manager" response="200"
```

* Webhook, activated with `--audit-webhook-config-file=/etc/kubernetes/audit-webhook-kubeconfig --audit-webhook-mode=batch`, where audit-webhook-mode can be either batch or blocking. The webhook configuration file is formatted as follows:

```yaml
# clusters refers to the remote service.
clusters:
  - name: name-of-remote-audit-service
    cluster:
      certificate-authority: /path/to/ca.pem  # CA to verify the remote service.
      server: https://audit.example.com/audit # URL of the remote service to query. Must use 'https'.

# users refers to the API server's webhook configuration.
users:
  - name: name-of-api-server
    user:
      client-certificate: /path/to/cert.pem  # cert for the webhook plugin to use
      client-key: /path/to/key.pem           # key matching the cert

# kubeconfig files require a context. Provide one for the API server.
current-context: webhook
contexts:
- context:
    cluster: name-of-remote-audit-service
    user: name-of-api-server
  name: webhook
```

All events are POSTed in JSON format to the webhook server, like so:

```javascript
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

---

Stepping into the world of Kubernetes, we encounter the vital role of "auditing" – a security guard that dutifully chronicles the sequence of events occurring within our cluster fortress. It holds the keys to the past, presented in the form of logs and webhooks, and allows us to tailor our historical narratives with custom-crafted policies.

In the heart of our command center, we spin up these narratives by tuning our kube-apiserver's knobs with settings like audit-log-path, dictating where our tales are penned, and audit-log-maxage, determining the longevity of our archived accounts.

These stories come in pairs: a request line, detailing every who, what, and where of a cluster challenge; then its companion, the response line, echoing back with the aftermath, sealing the fate of the request with a mere HTTP status code.

Take, for instance, an admin's quest for pods in the default realm. This chronicle unfolds with timestamps and identifiers, crafting a narrative of keystrokes and code.

The sage of the audit carries on with wizardry known as policies, setting forth commandments to decide which events transcend time and which fade into oblivion, like whispers in the wind. Some speak of the time when access to configmaps was an epic chronicled in full, while trivial watches by system:kube-proxy upon endpoints and services quietly pass unrecorded.

With these policies, we shape our world and configure our memory, often drawing inspiration from the storied GCE Audit Policy. And we etch these records not only in the stones of logs but also in the winds of webhooks, casting them out to distant lands where server whispers back with certainty or doubt – enveloped in the sanctity of HTTPS.

This is our story, metered in JSON, resonating within the digital echoes of our Kubernetes abode.