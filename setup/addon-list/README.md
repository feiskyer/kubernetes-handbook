# Add-On Components

Upon deploying a Kubernetes cluster, it becomes essential to install a series of add-on components (addons). These addons are often crucial for the regular operation of the cluster.

The [addon-manager](addon-manager.md), commonly utilized to manage the add-ons in a cluster, operates within the Kubernetes cluster's Master node. It oversees all the extensions in the `$ADDON_PATH` (defaulting to `/etc/kubernetes/addons/`) directory to ensure they are functioning as intended.

Some of the common components include:

* [addon-manager](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/addon-manager)
* [cluster-loadbalancing](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/cluster-loadbalancing)
* [dashboard](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/dashboard)
* [device-plugins/nvidia-gpu](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/device-plugins/nvidia-gpu)
* [dns-horizontal-autoscaler](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/dns-horizontal-autoscaler)
* [dns](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/dns)
* [fluentd-elasticsearch](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/fluentd-elasticsearch)
* [ip-masq-agent](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/ip-masq-agent)
* [istio](https://istio.io)
* [kube-proxy](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/kube-proxy)
* [metrics-server](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/metrics-server)
* [node-problem-detector](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/node-problem-detector)
* [prometheus](https://prometheus.io/)
* [storage-class](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/storage-class)

For additional extensions, refer to [Installing Addons](https://kubernetes.io/docs/concepts/cluster-administration/addons/) and [Legacy Addons](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons).

---

# Power-Up Your Kubernetes: Essential Add-Ons for Peak Performance

Once you've got your Kubernetes cluster up and running, think of it like a smartphone without apps—it's functional, but you're not getting the most out of it. That's where add-ons come in—they're like the apps that power-up your cluster's capabilities.

Picture a digital maestro—[addon-manager](addon-manager.md)—nestled within the Master node of your Kubernetes command center. This wizard is keeping an eagle eye on the `$ADDON_PATH` (which, by default, is the `/etc/kubernetes/addons/` directory), ensuring every component is humming along just right.

Ready for the tour? Here's the all-star lineup of add-ons that can turn your cluster into a powerhouse:

* **Command Central, [addon-manager](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/addon-manager)**: Keeps your add-ons tightly regulated.
* **Traffic Cop, [cluster-loadbalancing](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/cluster-loadbalancing)**: Directs digital traffic efficiently.
* **Mission Control, [dashboard](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/dashboard)**: A clear visual on your cluster activities.
* **The Muscle, [device-plugins/nvidia-gpu](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/device-plugins/nvidia-gpu)**: Amping up your computing power.
* **The Balancer, [dns-horizontal-autoscaler](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/dns-horizontal-autoscaler)**: Keeps network naming at peak performance.
* **The Communicator, [dns](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/dns)**: For seamless service-name resolutions.
* **The Analyzer, [fluentd-elasticsearch](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/fluentd-elasticsearch)**: Dives deep into data logs.
* **Stealth Mode, [ip-masq-agent](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/ip-masq-agent)**: Keeps IP addresses under wraps.
* **The Envoy, [istio](https://istio.io)**: Smart networking for your services.
* **The Enforcer, [kube-proxy](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/kube-proxy)**: Manages network rules and connections.
* **The Scout, [metrics-server](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/metrics-server)**: Keeps an eye on resource usage.
* **The Watchdog, [node-problem-detector](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/node-problem-detector)**: On the lookout for pesky issues.
* **The Statistician, [prometheus](https://prometheus.io/)**: Monitors and alerts like a pro.
* **The Organizer, [storage-class](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/storage-class)**: Manages your storage needs efficiently.

For those hungry for even more power-ups, gear up with additional extensions detailed in [Installing Addons](https://kubernetes.io/docs/concepts/cluster-administration/addons/) and for a nostalgic twist, visit [Legacy Addons](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons). Your Kubernetes cluster is set for the big leagues now!
