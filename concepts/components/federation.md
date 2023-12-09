# Federation

In a Cloud computing environment, services can operate at different range levels: within the same host (Host, Node), spanning hosts within the same available zone (Available Zone), crossing zones within the same region (Region), served from the same Cloud service providers, or even across different cloud platforms. The design of Kubernetes (often referred to as K8s) is aimed at handling a single cluster in the same region because performance within a region can meet K8s's threshold for scheduling and connections between computation storage. However, the concept of clustering Federation is designed to offer services from K8s clusters that cross regions and service providers.

Each Federation comes equipped with its distributed storage, API Server, and Controller Manager. Users are able to register K8s Clusters to a Federation's API Server. When users create or modify API objects through the Federation's API Server, the Federation API Server will create a replica of the same API object in all its registered sub K8s Clusters. When serving business requests, K8s Federation first balances the load among its own sub Clusters. For requests directed to a specific K8s Cluster, it follows the same scheduling pattern as when the K8s Cluster operates independently, providing internal load balancing within that K8s Cluster. Load balancing between Clusters is realized through domain service load balancing.

![](../../.gitbook/assets/federation-service%20%282%29.png)

All designs aim to reduce impact on existing K8s Cluster mechanisms. Thus, each individual K8s Cluster does not need an additional outer layer of K8s Federation, which implies that existing K8s code and mechanisms do not need to be altered due to Federation functionality.

![](../../.gitbook/assets/federation%20%286%29.png)

Federation mainly consists of three components:

- federation-apiserver: similar to kube-apiserver but provides REST API across clusters
- federation-controller-manager: like the kube-controller-manager, but ensures synchronization across multiple cluster states
- kubefed: a command line tool for managing Federation

The code for Federation is maintained at [https://github.com/kubernetes/federation](https://github.com/kubernetes/federation).

The next section delves into the steps of deploying Federation, which includes downloading kubefed and kubectl, initializing a main cluster, customizing DNS, deploying on physical machinery and, customizing etcd storage.

Once the Federation is deployed, you can use it by registering clusters other than the main cluster using the `kubefed join` command, query registered kubernetes clusters list, use annotation `federation.alpha.kubernetes.io/cluster-selector` for new object selection as of version 1.7+, and implement policy-based scheduling. Try utilizing the Federation by deploying resources such as Federated ConfigMap, Federated Service, Federated DaemonSet, and more!

Ending the Federation operation is also possible by removing the cluster or the Federation.

With technological advancement making cross-region, cross-service operations a reality, Federation is increasingly becoming an intrinsic part of K8s operations. It's time to embrace the future of digital transformation with Federation - at your fingertips!

For further information, check out [Kubernetes federation](https://kubernetes.io/blog/2018/12/12/kubernetes-federation-evolution/) and [kubefed](https://github.com/kubernetes-sigs/kubefed).
