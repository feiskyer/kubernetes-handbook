# Prometheus

```sh
helm repo add coreos https://s3-eu-west-1.amazonaws.com/coreos-charts/stable/
helm install coreos/prometheus-operator --name prometheus-operator --namespace monitoring
helm install coreos/kube-prometheus --name kube-prometheus --namespace monitoring
```

If you find that the exporter-kubelets functionality is not working properly, such as reporting a `server returned HTTP status 401 Unauthorized` error, you will need to configure the Kubelet with webhook authentication:

```sh
kubelet --authentication-token-webhook=true --authorization-mode=Webhook
```

If there are alerts like K8SControllerManagerDown and K8SSchedulerDown, this indicates that kube-controller-manager and kube-scheduler are running as Pods within the cluster, and the monitoring services deployed by Prometheus do not match their labels. This can be resolved by modifying the service labels, as shown below:

```
kubectl -n kube-system set selector service kube-prometheus-exporter-kube-controller-manager  component=kube-controller-manager
kubectl -n kube-system set selector service kube-prometheus-exporter-kube-scheduler  component=kube-scheduler
```

## Ingress

```
kubectl apply -f .
```

---

# Prometheus Unlocked: Your Gateway to Kubernetes Monitoring

```sh
helm repo add coreos https://s3-eu-west-1.amazonaws.com/coreos-charts/stable/
helm install coreos/prometheus-operator --name prometheus-operator --namespace monitoring
helm install coreos/kube-prometheus --name kube-prometheus --namespace monitoring
```

If you're trying to get a peek at your Kubernetes nodes' health and hit a snag with the error `server returned HTTP status 401 Unauthorized`, chances are you need to do a bit of tweaking on the Kubelet side. To swing open the doors of authorization, you'd need to switch on webhook authentication like this:

```sh
kubelet --authentication-token-webhook=true --authorization-mode=Webhook
```

Now, if your monitoring dashboard throws big red flags marked K8SControllerManagerDown or K8SSchedulerDown, it's kind of like finding the managers of your Kubernetes 'factory floor' unexpectedly taking a nap. They’re actually there but tagged wrong, leaving Prometheus confused. The trick is a small revamp in service labels:

```
kubectl -n kube-system set selector service kube-prometheus-exporter-kube-controller-manager  component=kube-controller-manager
kubectl -n kube-system set selector service kube-prometheus-exporter-kube-scheduler  component=kube-scheduler
```

## Ingress

Imagine commandeering your entire fleet of intergalactic starships with one powerful command. That's what you're doing here — for your Kubernetes Ingress:

```
kubectl apply -f .
```

Deploying with this single line is like having a universal remote for your clustered architecture, directing traffic with the ease of a maestro!