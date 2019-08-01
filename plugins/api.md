# API 擴展

Kubernetes 的架構非常靈活，提供了從 API、認證授權、准入控制、網絡、存儲、運行時以及雲平臺等一系列的[擴展機制](https://kubernetes.io/docs/concepts/extend-kubernetes/extend-cluster/)，方便用戶無侵入的擴展集群的功能。

從 API 的角度來說，可以通過 Aggregation 和 CustomResourceDefinition（CRD） 等擴展 Kubernetes API。

- API Aggregation 允許在不修改 Kubernetes 核心代碼的同時將第三方服務註冊到 Kubernetes API 中，這樣就可以通過 Kubernetes API 來訪問外部服務。
- CustomResourceDefinition 則可以在集群中新增資源對象，並可以與已有資源對象（如 Pod、Deployment 等）相同的方式來管理它們。

CRD 相比 Aggregation 更易用，兩者對比如下

| CRDs | Aggregated API |
| --------- | --------- |
| 無需編程即可使用 CRD 管理資源 | 需要使用 Go 來構建 Aggregated APIserver |
| 不需要運行額外服務，但一般需要一個 CRD 控制器同步和管理這些資源 | 需要獨立的第三方服務 |
| 任何缺陷都會在 Kubernetes 核心中修復 | 可能需要定期從 Kubernetes 社區同步缺陷修復方法並重新構建 Aggregated APIserver. |
| 無需額外管理版本 | 需要第三方服務來管理版本 |

更多的特性對比

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

詳細的使用方法請參考

- [Aggregation](aggregation.md)
- [CustomResourceDefinition](../concepts/customresourcedefinition.md)
