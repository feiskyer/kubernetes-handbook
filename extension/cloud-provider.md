# Unleashing the Power of Cloud Providers in Kubernetes

When running within a cloud platform, Kubernetes is supercharged by a Cloud Provider, harnessing in-built features of the platform such as persistent volume, load balancing, networking, DNS resolution, and auto-scaling.

## Meet the Regulars

Kubernetes comes pre-installed with a trove of Cloud Providers. Frequent flyers include:

* GCE
* AWS
* Azure
* Mesos
* OpenStack
* CloudStack
* Ovirt
* Photon
* Rackspace
* Vsphere

## A Peek Under the hood – How do Cloud Providers Work?

* For apiserver, kubelet, and controller-manager, cloud provider options are set.
* The Kubelet:
  * Connects with the Cloud Provider interface to retrieve the node name.
  * Informs the API Server about the InstanceID, ProviderID, ExternalID and Zone during Node registration.
  * Frequently checks if new IP addresses have been added to the Node.
  * Sets unschedulable conditions until cloud service provider completes routing configuration.
* The kube-apiserver:
  * Distributes SSH keys to all nodes for SSH tunnel creation.
  * The PersistentVolumeLabel takes care of PV labels.
  * The PersistentVolumeClainResize dynamically expands PV size.
* The kube-controller-manager:
  * Node controller checks the status of the VM where the Node resides. If the VM is deleted, it automatically removes the corresponding Node from the API Server.
  * Volume controller interacts directly with the cloud provider to create or delete persistent storage volumes, and mounts or unmounts them onto the specified VM as needed.
  * Route controller configures cloud routes for all registered Nodes.
  * Service controller creates load balancer for services of LoadBalancer type and updates the service's external IP.

## Standalone Cloud Provider: How Does It Work and Track Progress?

Follow the [principle](https://kubernetes.io/docs/tasks/administer-cluster/running-cloud-controller/) and [progress tracking](https://github.com/kubernetes/features/issues/88) guidelines to understand:

* Kubelet must be configured with `--cloud-provider=external`, and neither `kube-apiserver` nor `kube-controller-manager` should have the cloud provider configured.
* The `kube-apiserver` admission control options must not include PersistentVolumeLabel.
* The `cloud-controller-manager` works independently and activates `InitializerConifguration`.
* Kubelet can configure `ExternalID` through the `provider-id` option. After starting, it will automatically add a taint to Node as `node.cloudprovider.kubernetes.io/uninitialized=NoSchedule`.
* `Cloud-controller-manager` will reinitialize Node configuration after receiving Node registration event, add information such as zone or type, and remove the taint automatically created by Kubelet in the previous step.
* Merging the cloud-related logic of kube-apiserver and kube-controller-manager is the primary task.
  * View steps for the Node, Volume, Route and Service controllers above.
  * The PersistentVolumeLabel admission controller takes care of PV labels.
  * The PersistentVolumeClainResize admission controller dynamically expands PV size.

## Developing Your Own Cloud Provider Extension

The current Kubernetes Cloud Provider is under restructuring:

* v1.6 added the standalone `cloud-controller-manager` service, enabling cloud providers to build their own `cloud-controller-manager` without having to touch Kubernetes' core code.
* v1.7-v1.10 further separated `cloud-controller-manager` from Controller Manager, and Cloud Controller's logic was decoupled.
* v1.11 saw the External Cloud Provider upgrade to Beta.

Creating a new Cloud Provider for a new cloud supplier entails:

* Writing a cloud provider code that implements [cloudprovider.Interface](https://github.com/kubernetes/cloud-provider/blob/master/cloud.go).
* Linking the cloud provider to `cloud-controller-manager`.
  * Import the new cloud provider into `cloud-controller-manager`: `import "pkg/new-cloud-provider"`.
  * Pass the name of the new cloud provider at initialization, such as `cloudprovider.InitCloudProvider("rancher", s.CloudConfigFile)`.
* Configuring the kube-controller-manager by `--cloud-provider=external`.
* Starting the `cloud-controller-manager`.

Further guidance and detailed implementation can be found at [rancher-cloud-controller-manager](https://github.com/rancher/rancher-cloud-controller-manager) and [cloud-controller-manager](https://github.com/kubernetes/cloud-provider).