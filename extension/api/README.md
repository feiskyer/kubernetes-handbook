# Powering up with API Extensions

The infrastructure of Kubernetes is highly flexible, offering a series of extension mechanisms ranging from API, authentication authorization, admission control, networking, storage, runtime to cloud platform [20]. These features enable users to conveniently boost the functionality of their clusters without causing any infringement.

From the perspective of API, Kubernetes API can be expanded through methods such as Aggregation and CustomResourceDefinition (CRD).

* API Aggregation allows the integration of third-party services into the Kubernetes API without having to modify the core code of Kubernetes. In this way, external services can also be accessed via the Kubernetes API.
* CustomResourceDefinition allows the addition of new resource objects to the cluster and enables their management in the same way as existing resource objects (like Pod, Deployment etc.)

CRD is more user-friendly in comparison to Aggregation, as illustrated in the table below:

| CRDs | Aggregated API |
| :--- | :--- |
| Resource management through CRD requires no programming | Building of Aggregated APIserver requires Go |
| No extra services needed, though typically a CRD controller is necessary for synchronizing and managing these resources | Requires separate third-party service |
| All defects are addressed in the core of Kubernetes | Regular synchronizing from the Kubernetes community and rebuilding of Aggregated APIserver may be necessary to fix defects |
| No additional version management necessary | Requires third-party service for version management |

More comparison of features

| Feature | Description | CRDs | Aggregated API |
| :--- | :--- | :--- | :--- |
| Validation | Helps users avoid errors and evolve your API independently of your clients. Extremely useful when many clients are unable to update simultaneously. | Yes. Most validation can be specified in the CRD via [OpenAPI v3.0 validation](https://kubernetes.io/docs/tasks/access-kubernetes-api/extend-api-custom-resource-definitions/#validation). Any other validations supported by a Validating Webhook. | Yes, arbitrary validation checks |
| Defaulting | See above | Yes, via a Mutating Webhook; Planned, via CRD OpenAPI schema. | Yes |
| Multi-versioning | Allows the same object to be served through two API versions. Helpful in managing API changes like renaming fields. Less pertinent if you have control over your client versions. | No, but planned | Yes |
| Custom Storage | Useful when you need storage with a different performance mode (e.g., time-series database instead of a key-value store) or isolation for secure reasons (e.g., encryption secrets or different | No | Yes |
| Custom Business Logic | Allows arbitrary checks or actions when creating, reading, updating or deleting an object | Yes, using Webhooks. | Yes |
| Scale Subresource | Lets systems like HorizontalPodAutoscaler and PodDisruptionBudget interact with your new resource | [Yes](https://kubernetes.io/docs/tasks/access-kubernetes-api/extend-api-custom-resource-definitions/#scale-subresource) | Yes |
| Status Subresource | Provides finer-grained access control: users write spec section, controller writes status section. Enables incrementing object Generation on custom resource data mutation (requires separate spec and status sections in the resource) | [Yes](https://kubernetes.io/docs/tasks/access-kubernetes-api/extend-api-custom-resource-definitions/#status-subresource) | Yes |
| Other Subresources | Adds operations other than CRUD, such as “logs” or “exec”. | No | Yes |
| strategic-merge-patch | The new endpoints support PATCH with `Content-Type: application/strategic-merge-patch+json`. Helps to update objects that may be modified locally, and by the server. For more information, see [“Update API Objects in Place Using kubectl patch”](https://kubernetes.io/docs/tasks/run-application/update-api-object-kubectl-patch/) | No, but similar functionality planned | Yes |
| Protocol Buffers | The new resource supports clients that prefer using Protocol Buffers | No | Yes |
| OpenAPI Schema | Is there an OpenAPI (swagger) schema for the types that can be dynamically fetched from the server? Can the user avoid misspelling field names by ensuring only allowed fields are set? Are types enforced (For instance, do not place an `int` in a `string` field?) | No, but planned | Yes |

## Methods of Application

Please, refer to the detailed steps in:

* [Aggregation](aggregation.md)
* [CustomResourceDefinition](customresourcedefinition.md)
