# Policy Management, Demystified

Mixer serves as a universal policy control layer between your apps and infrastructure backend, handling fundamental tasks such as preconditional checks (authentication and authorization), quota management, and telemetry data collection from an Envoy proxy.

![](../../.gitbook/assets/istio-mixer%20%281%29.png)

The Mixer is a highly modular and expandable component. Its critical function is abstracting the complexities of various backend policies and telemetry collection systems, keeping the Istio remainder blissfully uninformed about backend specifics. The Mixer's adaptability to different infrastructure backends is achieved via a generic plugin model. Each plugin, referred to as an **Adapter**, allows the Mixer to connect with diverse infrastructure backends offering core functionalities like logging, monitoring, quota, ACL checks, etc. Configuration drives the choice of adapter suite used at runtime and facilitates effortless extension towards new or customized infrastructure backends.

![](../../.gitbook/assets/istio-adapters%20%282%29.png)

## Under The Hood

In essence, the Mixer is an [attribute](https://istio.io/docs/concepts/policy-and-control/attributes.html) processing engine wherein incoming requests carry an array of attributes for the Mixer to handle across various stages:

* Introduce new attributes to the request via global Adapters
* Determine, via resolution, the configuration resources needed for handling the request
* Process attributes to generate Adapter parameters
* Dispatch the requests to various Adapters for backend processing

![](../../.gitbook/assets/istio-phase%20%282%29.png)

## Rationing Traffic, An Example

```yaml
apiVersion: "config.istio.io/v1alpha2"
kind: memquota
metadata:
  name: handler
  namespace: istio-system
spec:
  quotas:
  - name: requestcount.quota.istio-system
    maxAmount: 5000
    validDuration: 1s
    # The first matching override is applied.
    # A requestcount instance is checked against override dimensions.
    overrides:
    # The following override applies to 'ratings' when
    # the source is 'reviews'.
    - dimensions:
        destination: ratings
        source: reviews
      maxAmount: 1
      validDuration: 1s
    # The following override applies to 'ratings' regardless
    # of the source.
    - dimensions:
        destination: ratings
      maxAmount: 100
      validDuration: 1s

---
apiVersion: "config.istio.io/v1alpha2"
kind: quota
metadata:
  name: requestcount
  namespace: istio-system
spec:
  dimensions:
    source: source.labels["app"] | source.service | "unknown"
    sourceVersion: source.labels["version"] | "unknown"
    destination: destination.labels["app"] | destination.service | "unknown"
    destinationVersion: destination.labels["version"] | "unknown"

---
apiVersion: "config.istio.io/v1alpha2"
kind: rule
metadata:
  name: quota
  namespace: istio-system
spec:
  actions:
  - handler: handler.memquota
    instances:
    - requestcount.quota
---
apiVersion: config.istio.io/v1alpha2
kind: QuotaSpec
metadata:
  name: request-count
  namespace: istio-system
spec:
  rules:
  - quotas:
    - charge: 1
      quota: requestcount
---
apiVersion: config.istio.io/v1alpha2
kind: QuotaSpecBinding
metadata:
  name: request-count
  namespace: istio-system
spec:
  quotaSpecs:
  - name: request-count
    namespace: istio-system
  services:
  - name: ratings
  - name: reviews
  - name: details
  - name: productpage
```

## For Further Reading

* [Istio Mixer](https://istio.io/docs/concepts/policy-and-control/mixer.html)