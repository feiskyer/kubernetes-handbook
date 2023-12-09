# Optimal Setup

This document aims at summarizing and highlighting the best practices found in user guides, quick-start documents, and examples. It is constantly updated and if you think there are useful best practices not included in this document, feel free to submit a Pull Request.

## General Configuration Tips

* When defining a configuration file, specify the latest stable API version.
* Save configuration files in a version control system before deploying them to the cluster. This allows for quick rollback when necessary and makes it easier to quickly create a cluster.
* Use YAML format instead of JSON for configuration files. They are interchangeable in most scenarios, but YAML is more user-friendly.
* Try to keep related objects in the same configuration file, it's easier to manage than splitting them into multiple files. See the configuration in [guestbook-all-in-one.yaml](https://github.com/kubernetes/examples/blob/master/guestbook/all-in-one/guestbook-all-in-one.yaml) for reference.
* Specify the configuration file directory when using the `kubectl` command.
* Avoid specifying unnecessary default configurations, this helps to keep the configuration files simple and reduces configuration errors.
* Placing a description of the resource objects in an annotation can improve introspection.

## Bare Pods vs Replication Controllers and Jobs

* If there are other options to replace "bare pods" (such as pods not bound to a [replication controller](https://kubernetes.io/docs/user-guide/replication-controller)), use them instead.
* Bare pods will not be rescheduled in case of a node failure.
* Replication Controllers will always recreate pods, except in scenarios where [`restartPolicy: Never`](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#restart-policy) is explicitly specified. [Job](https://kubernetes.io/docs/concepts/jobs/run-to-completion-finite-workloads/) objects also apply.

## Services

* It's generally best to create a [service](https://kubernetes.io/docs/concepts/services-networking/service/) before creating its related [replication controllers](https://kubernetes.io/docs/concepts/workloads/controllers/replicationcontroller/). This ensures that the service's environment variables are set up at container startup time. For new applications, it's recommended to access the service by its DNS name (rather than through environment variables).
* Unless necessary (e.g. running a node daemon), don't use Pods with configured `hostPort` (used to specify the port number exposed on the host). When you bind a `hostPort` to a Pod, it can be difficult for the pod to be scheduled due to port conflicts. If you need to access ports for debugging purposes, you can use [kubectl proxy and apiserver proxy](https://kubernetes.io/docs/tasks/extend-kubernetes/http-proxy-access-api/) or [kubectl port-forward](https://kubernetes.io/docs/tasks/access-application-cluster/port-forward-access-application-cluster/). You can expose services to the external world using [Service](https://kubernetes.io/docs/concepts/services-networking/service/). If you do need to expose a Pod's port to the host, consider using a [NodePort](https://kubernetes.io/docs/user-guide/services/#type-nodeport) service.
* For the same reason as `hostPort`, avoid using `hostNetwork`.
* If you don't need kube-proxy's load balancing, consider using [headless services](https://kubernetes.io/docs/user-guide/services/#headless-services) (ClusterIP set to None).

## Utilizing Labels

* Use [labels](https://kubernetes.io/docs/user-guide/labels/) to specify the semantic attributes of an application or Deployment. This allows you to select the suitable object group for the scenario, such as `app: myapp, tire: frontend, phase: test, deployment: v3`.
* A service can be configured to span multiple deployments by simply omitting the release-related labels in its label selector.
* Note that the [Deployment](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) object no longer needs to manage the version name of the replication controller. The Deployment object describes the desired state of the object, and if changes to the spec are applied, the Deployment controller will change the actual state to the desired state at a controlled rate.
* Use labels for debugging. Kubernetes replication controllers and services use labels to match pods, allowing you to remove a pod from a controller or service by removing its relevant label. The controller will create a new pod to replace the removed one. This is a useful way to debug a previously "live" pod in an isolated environment.

## Container Images

* The default container image pull policy is `IfNotPresent`, meaning the Kubelet will not pull from the image repository if the image is already present locally. If you want to always pull images from the repository, set the image pull policy in the yaml file to `Always` (`imagePullPolicy: Always`) or specify the image tag as `:latest`.
* If the image tag is not set to `:latest`, for example `myimage:v1`, and the image with that tag has been updated, the Kubelet will not pull that image. You can generate a new tag (for example `myimage:v2`) after each image update and specify that version in the configuration file.
* You can use the image digest to ensure the container always uses the same version of the image.
* **Note:** In a production environment, avoid using the `:latest` tag when deploying containers. This makes it difficult to trace which version is running and how to rollback in case of failure.

## Using kubectl

* Use `kubectl create -f <directory>` or `kubectl apply -f <directory>`. Kubectl will automatically look for all files with the extensions `.yaml`, `.yml`, and `.json` in the directory and pass them to the `create` or `apply` command.
* Using label selectors with `kubectl get` or `kubectl delete` can operate on a group of objects in bulk.
* Use `kubectl run` and `expose` commands to quickly create a Deployment and Service with a single container, for example:

  ```bash
  kubectl run hello-world --replicas=2 --labels="run=load-balancer-example" --image=gcr.io/google-samples/node-hello:1.0  --port=8080
  kubectl expose deployment hello-world --type=NodePort --name=example-service
  kubectl get pods --selector="run=load-balancer-example" --output=wide
  ```

## References

* [Configuration Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)