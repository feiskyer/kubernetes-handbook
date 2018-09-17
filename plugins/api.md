# API 扩展

Kubernetes 的架构非常灵活，提供了从 API、认证授权、准入控制、网络、存储、运行时以及云平台等一系列的[扩展机制](https://kubernetes.io/docs/concepts/extend-kubernetes/extend-cluster/)，方便用户无侵入的扩展集群的功能。

从 API 的角度来说，可以通过 Aggregation 和 CustomResourceDefinition（CRD） 等扩展 Kubernetes API。

- API Aggregation 允许在不修改 Kubernetes 核心代码的同时将第三方服务注册到 Kubernetes API 中，这样就可以通过 Kubernetes API 来访问外部服务。
- CustomResourceDefinition 则可以在集群中新增资源对象，并可以与已有资源对象（如 Pod、Deployment 等）相同的方式来管理它们。

CRD 相比 Aggregation 更易用，两者对比如下

| CRDs | Aggregated API |
| --------- | --------- |
| 无需编程即可使用 CRD 管理资源 | 需要使用 Go 来构建 Aggregated APIserver |
| 不需要运行额外服务，但一般需要一个 CRD 控制器同步和管理这些资源 | 需要独立的第三方服务 |
| 任何缺陷都会在 Kubernetes 核心中修复 | 可能需要定期从 Kubernetes 社区同步缺陷修复方法并重新构建 Aggregated APIserver. |
| 无需额外管理版本 | 需要第三方服务来管理版本 |

更多的特性对比

| Feature | Description | CRDs | Aggregated API |
| --------------------- | --------- | --------- | -------------- |
| Validation | Help users prevent errors and allow you to evolve your API independently of your clients. These features are most useful when there are many clients who can’t all update at the same time. | Yes. Most validation can be specified in the CRD using [OpenAPI v3.0 validation](https://kubernetes.io/docs/tasks/access-kubernetes-api/extend-api-custom-resource-definitions/#validation). Any other validations supported by addition of a Validating Webhook. | Yes, arbitrary validation checks |
| Defaulting | See above | Yes, via a Mutating Webhook; Planned, via CRD OpenAPI schema. | Yes  |
| Multi-versioning | Allows serving the same object through two API versions. Can help ease API changes like renaming fields. Less important if you control your client versions. | No, but planned | Yes  |
| Custom Storage | If you need storage with a different performance mode (for example, time-series database instead of key-value store) or isolation for security (for example, encryption secrets or different | No  | Yes  |
| Custom Business Logic | Perform arbitrary checks or actions when creating, reading, updating or deleting an object | Yes, using Webhooks.  | Yes  |
| Scale Subresource | Allows systems like HorizontalPodAutoscaler and PodDisruptionBudget interact with your new resource | [Yes](https://kubernetes.io/docs/tasks/access-kubernetes-api/extend-api-custom-resource-definitions/#scale-subresource) | Yes  |
| Status Subresource | Finer-grained access control: user writes spec section, controller writes status section.Allows incrementing object Generation on custom resource data mutation (requires separate spec and status sections in the resource) | [Yes](https://kubernetes.io/docs/tasks/access-kubernetes-api/extend-api-custom-resource-definitions/#status-subresource) | Yes  |
| Other Subresources | Add operations other than CRUD, such as “logs” or “exec”. | No  | Yes  |
| strategic-merge-patch | The new endpoints support PATCH with `Content-Type: application/strategic-merge-patch+json`. Useful for updating objects that may be modified both locally, and by the server. For more information, see [“Update API Objects in Place Using kubectl patch”](https://kubernetes.io/docs/tasks/run-application/update-api-object-kubectl-patch/) | No, but similar functionality planned | Yes |
| Protocol Buffers | The new resource supports clients that want to use Protocol Buffers | No  | Yes  |
| OpenAPI Schema | Is there an OpenAPI (swagger) schema for the types that can be dynamically fetched from the server? Is the user protected from misspelling field names by ensuring only allowed fields are set? Are types enforced (in other words, don’t put an `int` in a `string` field?) | No, but planned | Yes |

## 使用方法

详细的使用方法请参考

- [Aggregation](aggregation.md)
- [CustomResourceDefinition](../concepts/customresourcedefinition.md)
