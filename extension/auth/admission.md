# The Power of Admission Control

Admission Control (AC) is a crucial step in the fulfilment of requests in computing systems. Essentially, upon authorization, AC further verifies the request or adds default parameters. While numerous facets like authorization and authentication focus solely on the request's user and operation, AC on the other hand, also addresses the content of the request. Notably, AC is only viable for creating, updating, deleting or connecting (like proxying) operations, and is effectively redundant when dealing with read operations.

Admission Control allows for the simultaneous opening of multiple plugins. In succession, these plugins are called, and only requests vetted and passed by all plugins are allowed to proceed into the system.

Kubernetes, the popular open-source platform, currently offers several types of Admission Control plugins:

-   AlwaysAdmit: All requests are accepted.
-   AlwaysPullImages: It always pulls the latest image, proving invaluable in multi-tenant scenarios.
-   DenyEscalatingExec: Prohibits exec and attach operations of privileged containers.
-   ImagePolicyWebhook: Utilizes a webhook to decide image policies, requires simultaneous configuration of `--admission-control-config-file`. For configuration file format, refer [here](https://kubernetes.io/docs/admin/admission-controllers/#configuration-file-format).
-   ServiceAccount: Automates the creation of default ServiceAccounts, guaranteeing the referenced ServiceAccount by the Pod is existent.
-   And so on, catering to a wide array of specific needs and use-cases. 

Kubernetes v1.7 and later versions also support Initializers and GenericAdmissionWebhook, which considerably facilitate the extension of Admission Control.

## Initializers

Initializers are pivotal in applying strategies or configuring default options to resources. They comprise both Initializer Controllers responsible for executing user-submitted tasks and user-defined Initializer tasks. Post completion, the task is removed from the `metadata.initializers` list. 

Initializers can harness `initializerconfigurations` for the customized activation of resource Initializer functions. Furthermore, Initializers may also be used in various other scenarios like adding a sidecar container or storage volume automatically to a Pod, or improving performance by employing the GenericAdmissionWebhook, among others.

## GenericAdmissionWebhook

The GenericAdmissionWebhook is an Admission Control mechanism which utilizes a webhook. While it doesn't alter request objects, it can validate user requests.

## PodNodeSelector

The PodNodeSelector restricts the nodes where Pods within a Namespace can run. Although it is functionally opposite to Taint.

## Recommended Configurations

For Kubernetes >= 1.9.0, we recommend configuring the following plugins:

    --admission-control=NamespaceLifecycle,LimitRanger,ServiceAccount,DefaultStorageClass,DefaultTolerationSeconds,MutatingAdmissionWebhook,ValidatingAdmissionWebhook,ResourceQuota

For Kubernetes >= 1.6.0, we recommend turning on the following plugins in kube-apiserver:

    --admission-control=NamespaceLifecycle,LimitRanger,ServiceAccount,PersistentVolumeLabel,DefaultStorageClass,ResourceQuota,DefaultTolerationSeconds

For Kubernetes >= 1.4.0, we recommend configuring the following plugins:

    --admission-control=NamespaceLifecycle,LimitRanger,ServiceAccount,DefaultStorageClass,ResourceQuota

## Further Reading

- [Using Admission Controllers](https://kubernetes.io/docs/admin/admission-controllers/)
- [How Kubernetes Initializers work](https://medium.com/google-cloud/how-kubernetes-initializers-work-22f6586e1589) 

In summary, Admission Control underscores the importance of meticulous managing and monitoring of system requests, employing numerous plugins to ensure security and efficacy for a robust computing environment.