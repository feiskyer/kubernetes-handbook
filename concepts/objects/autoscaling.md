# Autoscaling Demystified

The Horizontal Pod Autoscaling (HPA) system offers a smart solution, enabling automatic extension of the Pod quantity based on CPU usage or an application's custom metrics. It seamlessly supports replication controllers, deployments and replica sets.

* Monitor managers survey the resource usage of the metrics every 15 seconds (adjustable via `--horizontal-pod-autoscaler-sync-period`)
* It can work with three types of metrics:
  * Predefined metrics (like Pod's CPU) are calculated as a ratio or usage rate
  * Custom Pod metrics are calculated as raw value amounts 
  * Custom object metrics
* Metrics can be retrieved using Heapster or the customized REST API
* It is capable of managing multiple metrics

Do note that the extent of our discussion here is limited to Pod's automatic scaling; to comprehend Node's automatic scaling, refer to [Cluster AutoScaler](../../setup/addon-list/cluster-autoscaler.md). Before using the HPA, further, it is necessary to ensure that the [**metrics-server**](../../setup/addon-list/metrics.md) is properly deployed.

## API Version Comparison Table

| Kubernetes Version | Autoscaling API Version | Supported Metrics |
| :--- | :--- | :--- |
| v1.5+ | autoscaling/v1 | CPU |
| v1.6+ | autoscaling/v2beta1 | Memory and Custom |

## Examples

```bash
# This segment demonstrates how to create a pod and service
$ kubectl run php-apache --image=k8s.gcr.io/hpa-example --requests=cpu=200m --expose --port=80
service "php-apache" created
deployment "php-apache" created

# Here, we create the autoscaler
$ kubectl autoscale deployment php-apache --cpu-percent=50 --min=1 --max=10
deployment "php-apache" autoscaled

...

```

The snippet above walks you through an example; from creating a pod and service, generating an autoscaler, increasing loads to finally witnessing the reduction of load and automatic reduction of pod quantity. This offers an illustrative explanation of how the autoscaling functions.

## Custom Metrics

The control manager can be enabled and configured with `--horizontal-pod-autoscaler-use-rest-clients` and `--master` or `--kubeconfig` respectively. Custom metrics API, such as [https://github.com/kubernetes-incubator/custom-metrics-apiserver](https://github.com/kubernetes-incubator/custom-metrics-apiserver) and [https://github.com/kubernetes/metrics](https://github.com/kubernetes/metrics), should be registered in the API Server Aggregator. For reference, you can check out [k8s.io/metics](https://github.com/kubernetes/metrics) to develop your custom metrics API server.

For example, HorizontalPodAutoscaler promises that each Pod will consume 50% of the CPU, 1000pps, and 10,000 requests per second:

## HPA Best Practices

Looking for a smoother scaling experience? Follow these best practices:

* Set CPU Requests for Containers
* Adjust HPA target appropriately, aiming for 30% reserve for applications and containers
* Maintain robust Pods and Nodes to avoid frequent rebuilding of Pods
* Implement user request load balancing
* Monitor resource usage with `kubectl top node` and `kubectl top pod`
  
For more in-depth understanding on this topic, refer to [Ensure High Availability and Uptime With Kubernetes Horizontal Pod Autoscaler and Prometheus](https://www.weave.works/blog/kubernetes-horizontal-pod-autoscaler-and-prometheus).