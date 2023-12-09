# Service Governance

This section will fill you on Kubernetes service governance including container application management, Service Mesh, and Operator, amongst others.

One prevalent practice is managing Manifests manually, as in the case of Kubernetes' GitHub code library that provides a host of manifest examples: 

* [https://github.com/kubernetes/kubernetes/tree/master/cluster/addons](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons)
* [https://github.com/kubernetes/examples](https://github.com/kubernetes/examples)
* [https://github.com/kubernetes/contrib](https://github.com/kubernetes/contrib)
* [https://github.com/kubernetes/ingress-nginx](https://github.com/kubernetes/ingress-nginx)

Nonetheless, managing things manually can be quite a handful, especially when you're dealing with complex applications sporting a warren of Manifests. Plus, planning their deployment intersections can be a real brain-teaser. In light of this, the Kubernetes open-source community is pushing for simpler management methods such as:

* [General Guidelines](patterns.md)
* [Rolling Updates](service-rolling-update.md)
* [Helm](helm.md)
* [Operator](operator.md)
* [Service Mesh](service-mesh.md)
* [Linkerd](linkerd.md)
* [Istio](../istio/), which includes:
  * [Installation](../istio/istio-deploy.md)
  * [Traffic Management](../istio/istio-traffic-management.md)
  * [Security Management](../istio/istio-security.md)
  * [Policy Management](../istio/istio-policy.md)
  * [Metrics](../istio/istio-metrics.md)
  * [Troubleshooting](../istio/istio-troubleshoot.md)
  * [Community](../istio/istio-community.md)
* Also, participating within the realm of [Devops](../devops/), are:
  * [Draft](../devops/draft.md)
  * [Jenkins X](../devops/jenkinsx.md)
  * [Spinnaker](../devops/spinnaker.md)
  * [Kompose](../devops/kompose.md)
  * [Skaffold](../devops/skaffold.md)
  * [Argo](../devops/argo.md)
  * [Flux GitOps](../devops/flux.md)
  
Given the distinction between direct translations and the need to appeal to a wider audience, the second translation attempts to incorporate a blend of both, striking a balance between accuracy and relatability. The goal is to accurately convey the technical content while ensuring that it is digestible for a lay reader.