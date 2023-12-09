# Monitoring

The Kubernetes community offers a series of tools for monitoring the status of containers and clusters, and, with the help of Prometheus, alarm functionality is provided.

* cAdvisor is responsible for container and node resource usage statistics within a single node, built-in within Kubelet, and provides an API externally through Kubelet's `/metrics/cadvisor`
* [InfluxDB](https://www.influxdata.com/time-series-platform/influxdb/) is an open-source distributed time series, event, and metrics database; [Grafana](http://grafana.org/), on the other hand, is the Dashboard for InfluxDB, offering powerful chart display capabilities. They are often used in combination to display graphically visualized monitoring data.
* [metrics-server](metrics.md) provides resource monitoring data for the entire cluster, but note that
  * The Metrics API can only query current metric data and does not save historical data
  * The Metrics API URI is `/apis/metrics.k8s.io/` and maintained at [k8s.io/metrics](https://github.com/kubernetes/metrics)
  * `metrics-server` must be deployed to use this API, and metrics-server obtains data by invoking the Kubelet Summary API
* [kube-state-metrics](https://github.com/kubernetes/kube-state-metrics) provides metrics for Kubernetes resource objects (such as DaemonSet, Deployments, etc.).
* [Prometheus](https://prometheus.io) is another monitoring and time-series database, which also provides alarm functionality.
* [Node Problem Detector](https://github.com/kubernetes/node-problem-detector) monitors issues with the Node itself, such as hardware, kernel, or runtime problems.
* ~~[Heapster](https://github.com/kubernetes/heapster)~~ (deprecated) ~~provided resource monitoring across the entire cluster and supported persistent data storage into backends like InfluxDB (deprecated)~~

## cAdvisor

[cAdvisor](https://github.com/google/cadvisor) is a container monitoring tool from Google and is also the built-in container resource collection tool in Kubelet. It automatically collects resource usage statistics for CPU, memory, network, and file systems of containers on the local machine and provides cAdvisor's native API externally (default port is `--cadvisor-port=4194`).

![](../../.gitbook/assets/14842107270881%20%285%29.png)

Starting from v1.7, Kubelet metrics API no longer includes cadvisor metrics but provides an independent API interface:

* Kubelet metrics: `http://127.0.0.1:8001/api/v1/proxy/nodes/<node-name>/metrics`
* Cadvisor metrics: `http://127.0.0.1:8001/api/v1/proxy/nodes/<node-name>/metrics/cadvisor`

Thus, in tools like Prometheus, the new Metrics API must be used to obtain this data, as in the following Prometheus configuration that automatically sets up the cadvisor metrics API:

```bash
helm install stable/prometheus --set rbac.create=true --name prometheus --namespace monitoring
```

Note: The port monitored by cadvisor will be removed in v1.12, and it is recommended that all external tools use the Kubelet Metrics API instead.

## InfluxDB and Grafana

[InfluxDB](https://www.influxdata.com/time-series-platform/influxdb/) is an open-source distributed time series, event, and metrics database; Grafana is InfluxDB's Dashboard, providing powerful chart display capabilities. They are often used in combination to display graphically visualized monitoring data.

![](../../.gitbook/assets/14842114123604%20%282%29.jpg)

## Heapster

Kubelet's built-in cAdvisor only provides single-machine container resource usage statistics, whereas [Heapster](https://github.com/kubernetes/heapster) provides whole-cluster resource monitoring and supports persistent data storage into backends like InfluxDB, Google Cloud Monitoring, or [other backends](https://github.com/kubernetes/heapster). Note:

* Heapster is recommended only for Kubernetes v1.7.X or older clusters.
* Starting from Kubernetes v1.8, resource usage metrics (such as CPU and memory usage of containers) are obtained through the Metrics API, and HPA also queries necessary data from the metrics-server.
* **Heapster has been deprecated in v1.11, and it is recommended to deploy** [**metrics-server**](metrics.md) **instead of Heapster for versions v1.8 and above**

Heapster first queries all Node information from the Kubernetes apiserver, then collects node and container resource usage from the kubelet-provided API, while providing Prometheus format data through the `/metrics` API. Heapster-collected data can be pushed to various persistence backend storages, such as InfluxDB, Google Cloud Monitoring, OpenTSDB, etc.

![](../../.gitbook/assets/14842118198998%20%286%29.png)

### Deploying Heapster, InfluxDB, and Grafana

After Kubernetes deployment is successful, services such as the dashboard, DNS, and monitoring are also typically deployed by default, such as via `cluster/kube-up.sh`:

```bash
$ kubectl cluster-info
Kubernetes master is running at https://kubernetes-master
Heapster is running at https://kubernetes-master/api/v1/proxy/namespaces/kube-system/services/heapster
KubeDNS is running at https://kubernetes-master/api/v1/proxy/namespaces/kube-system/services/kube-dns
kubernetes-dashboard is running at https://kubernetes-master/api/v1/proxy/namespaces/kube-system/services/kubernetes-dashboard
Grafana is running at https://kubernetes-master/api/v1/proxy/namespaces/kube-system/services/monitoring-grafana
InfluxDB is running at https://kubernetes-master/api/v1/proxy/namespaces/kube-system/services/monitoring-influxdb
```

If these services have not been automatically deployed, they can be deployed following the [kubernetes/heapster](https://github.com/kubernetes/heapster/tree/master/deploy/kube-config):

```bash
git clone https://github.com/kubernetes/heapster
cd heapster
kubectl create -f deploy/kube-config/influxdb/
kubectl create -f deploy/kube-config/rbac/heapster-rbac.yaml
```

Note that to access these services, the apiserver certificate must be imported into the browser first for authentication. The visiting process can also be simplified by using the kubectl proxy (no certificate import needed):

```bash
# Start proxy
kubectl proxy --address='0.0.0.0' --port=8080 --accept-hosts='^*$' &
```

Then, open `http://<master-ip>:8080/api/v1/proxy/namespaces/kube-system/services/monitoring-grafana` to access Grafana.

![](../../.gitbook/assets/grafana%20%284%29.png)

## Prometheus

[Prometheus](https://prometheus.io) is another monitoring and time-series database and provides alarm functionality as well. It offers a powerful query language and HTTP interface and also supports data export to Grafana.

![prometheus](../../.gitbook/assets/prometheus%20%284%29.png)

Using Prometheus to monitor Kubernetes requires proper data source configuration, a simple example is [prometheus.yml](https://github.com/feiskyer/kubernetes-handbook/tree/39446adab1639adec0fe906a85dfd0ba1f0b45f9/addons/prometheus.txt).

It is recommended to use [Prometheus Operator](https://github.com/coreos/prometheus-operator) or [Prometheus Chart](https://github.com/kubernetes/charts/tree/master/stable/prometheus) to deploy and manage Prometheus, such as

```bash
helm install stable/prometheus-operator --name prometheus-operator --namespace monitoring
```

Access Prometheus via port forwarding, like `kubectl --namespace monitoring port-forward service/kube-prometheus-prometheus :9090`

![prometheus-web](../../.gitbook/assets/14842125295113%20%281%29.jpg)

If the exporter-kubelets feature is not working properly, such as reporting a `server returned HTTP status 401 Unauthorized` error, webhook authentication needs to be configured for the Kubelet:

```bash
kubelet --authentication-token-webhook=true --authorization-mode=Webhook
```

If you see K8SControllerManagerDown and K8SSchedulerDown alerts, it means that kube-controller-manager and kube-scheduler are running as Pods in the cluster and the labels of the monitoring services deployed by prometheus do not match theirs. The problem can be solved by modifying the service labels, such as

```bash
kubectl -n kube-system set selector service kube-prometheus-exporter-kube-controller-manager  component=kube-controller-manager
kubectl -n kube-system set selector service kube-prometheus-exporter-kube-scheduler  component=kube-scheduler
```

Query the admin password for Grafana

```bash
kubectl get secret --namespace monitoring kube-prometheus-grafana -o jsonpath="{.data.user}" | base64 --decode ; echo
kubectl get secret --namespace monitoring kube-prometheus-grafana -o jsonpath="{.data.password}" | base64 --decode ; echo
```

Then, access the Grafana interface via port forwarding

```bash
kubectl port-forward -n monitoring service/kube-prometheus-grafana :80
```

Add a Prometheus-type Data Source, fill in the original address `http://prometheus-prometheus-server.monitoring`.

> Note: Prometheus Operator does not support service discovery through the `prometheus.io/scrape` annotation and requires you to define [ServiceMonitor](https://github.com/coreos/prometheus-operator/blob/master/Documentation/user-guides/running-exporters.md#generic-servicemonitor-example) to fetch service metrics.

## Node Problem Detector

Kubernetes nodes may experience various hardware, kernel, or runtime issues that could potentially lead to service anomalies. Node Problem Detector (NPD) is a service designed to monitor these anomalies. NPD runs as a DaemonSet on each Node, updating the NodeCondition (such as KernelDaedlock, DockerHung, BadDisk, etc.) or Node Event (such as OOM Kill, etc.) when anomalies occur.

Refer to [kubernetes/node-problem-detector](https://github.com/kubernetes/node-problem-detector#start-daemonset) to deploy NPD, or you can use Helm for deployment:

```bash
# add repo
helm repo add feisky https://feisky.xyz/kubernetes-charts
helm update

# install packages
helm install feisky/node-problem-detector --namespace kube-system --name npd
```

## Node Reboot Daemon

Nodes in Kubernetes clusters typically enable automatic security updates, which helps to minimize losses due to system vulnerabilities. However, updates involving the kernel generally require a system reboot to take effect. At this point, manual or automatic methods are needed to reboot nodes.

[Kured (KUbernetes REboot Daemon)](https://github.com/weaveworks/kured) is such a daemon that

* Monitors `/var/run/reboot-required` signal to reboot nodes
* Restarts one node at a time using DaemonSet Annotation
* Evicts nodes before rebooting and resumes scheduling afterwards
* Cancels reboot based on Prometheus alerts (e.g., `--alert-filter-regexp=^(RebootRequired|AnotherBenignAlert|...$`)
* Slack notifications

Deployment method

```bash
kubectl apply -f https://github.com/weaveworks/kured/releases/download/1.0.0/kured-ds.yaml
```

## Other Container Monitoring Systems

In addition to the above monitoring tools, there are many other open source or commercial systems available to assist with monitoring, such as

* [Sysdig](http://blog.kubernetes.io/2015/11/monitoring-Kubernetes-with-Sysdig.html)
* [Weave scope](https://www.weave.works/docs/scope/latest/features/)
* [Datadog](https://www.datadoghq.com/)
* [Sematext](https://sematext.com/)

### sysdig

sysdig is a container troubleshooting tool that offers both open source and commercial versions. For regular troubleshooting, the open source version suffices.

Aside from sysdig, there are two other auxiliary tools

* csysdig: Automatically installed with sysdig, provides a command-line interface
* [sysdig-inspect](https://github.com/draios/sysdig-inspect): Provides a graphical interface for sysdig-saved trace files (e.g., `sudo sysdig -w filename.scap`) (not real-time)

#### Install sysdig

```bash
# on Linux
curl -s https://s3.amazonaws.com/download.draios.com/stable/install-sysdig | sudo bash

# on MacOS
brew install sysdig
```

Usage examples

```bash
# Refer https://www.sysdig.org/wiki/sysdig-examples/.
# View the top network connections for a single container
sysdig -pc -c topconns

# Show the network data exchanged with the host 192.168.0.1
sysdig -s2000 -A -c echo_fds fd.cip=192.168.0.1

# List all the incoming connections that are not served by apache.
sysdig -p"%proc.name %fd.name" "evt.type=accept and proc.name!=httpd"

# View the CPU/Network/IO usage of the processes running inside the container.
sysdig -pc -c topprocs_cpu container.id=2e854c4525b8
sysdig -pc -c topprocs_net container.id=2e854c4525b8
sysdig -pc -c topfiles_bytes container.id=2e854c4525b8

# See the files where apache spends the most time doing I/O
sysdig -c topfiles_time proc.name=httpd

# Show all the interactive commands executed inside a given container.
sysdig -pc -c spy_users

# Show every time a file is opened under /etc.
sysdig evt.type=open and fd.name
```

### Weave Scope

Weave Scope is another visual container monitoring and troubleshooting tool. Unlike sysdig, it does not have a powerful command-line tool but does offer a straightforward and user-friendly interactive interface that automatically outlines the entire cluster's topology and can be extended by plugins. From its official website description, its features include

* [Interactive topology interface](https://www.weave.works/docs/scope/latest/features/#topology-mapping)
* [Graphic mode and table mode](https://www.weave.works/docs/scope/latest/features/#mode)
* [Filtering function](https://www.weave.works/docs/scope/latest/features/#flexible-filtering)
* [Search function](https://www.weave.works/docs/scope/latest/features/#powerful-search)
* [Real-time metrics](https://www.weave.works/docs/scope/latest/features/#real-time-app-and-container-metrics)
* [Container troubleshooting](https://www.weave.works/docs/scope/latest/features/#interact-with-and-manage-containers)
* [Plugin extensions](https://www.weave.works/docs/scope/latest/features/#custom-plugins)

Weave Scope consists of [App and Probe](https://www.weave.works/docs/scope/latest/how-it-works)

* Probe is responsible for collecting container and host information and sending it to the App
* App processes this information, generates corresponding reports, and displays them in an interactive interface

```bash
                    +--Docker host----------+      +--Docker host----------+
.---------------.   |  +--Container------+  |      |  +--Container------+  |
| Browser       |   |  |                 |  |      |  |                 |  |
|---------------|   |  |  +-----------+  |  |      |  |  +-----------+  |  |
|               |----->|  | scope-app |<-----.    .----->| scope-app |  |  |
|               |   |  |  +-----------+  |  | \  / |  |  +-----------+  |  |
|               |   |  |        ^        |  |  \/  |  |        ^        |  |
'---------------'   |  |        |        |  |  /\  |  |        |        |  |
                    |  | +-------------+ |  | /  \ |  | +-------------+ |  |
                    |  | | scope-probe |-----'    '-----| scope-probe | |  |
                    |  | +-------------+ |  |      |  | +-------------+ |  |
                    |  |                 |  |      |  |                 |  |
                    |  +-----------------+  |      |  +-----------------+  |
                    +-----------------------+      +-----------------------+
```

#### Install Weave Scope

```bash
kubectl apply -f "https://cloud.weave.works/k8s/scope.yaml?k8s-version=$(kubectl version | base64 | tr -d '\n')&k8s-service-type=LoadBalancer"
```

After installation, the interactive interface can be accessed through the weave-scope-app

```bash
kubectl -n weave get service weave-scope-app
```

![](../../.gitbook/assets/weave-scope%20%282%29.png)

You can also view real-time status and metric data of all containers in the Pod by clicking on the Pod:

![](../../.gitbook/assets/scope-pod%20%284%29.png)

## Reference Documents

* [Kubernetes Heapster](https://github.com/kubernetes/heapster)

Now, let's move on to the rephrased version to make it more accessible to a broad audience as a popular science article. 

# Keeping an Eye on Kubernetes: A Guide on Tools and Tips

The Kubernetes community is like a vibrant ecosystem with a toolbox that helps you peek into the health and state of your containerized applications and clusters. Plus, thanks to Prometheus, you can even get a virtual tap on the shoulder with alerts if anything goes awry.

Here's the lowdown on the tools you can strap to your Kubernetes utility belt:

- **cAdvisor** is your on-site inspector, built-in with the Kubelet, keeping tabs on resource consumption for containers and nodes, and chatting up the world with its metrics API.
- Pair **[InfluxDB](https://www.influxdata.com/time-series-platform/influxdb/)** and **[Grafana](http://grafana.org/)**, and you get a dynamic duo providing not just a robust time-series database but also snazzy dashboards to visualize that precious monitoring data.
- The **[metrics-server](metrics.md)** is the cluster's main data cruncher, but remember, it's all about the here and now—no dwelling on the past with historical data.
- If you’re curious about the state of your Kubernetes resources, **[kube-state-metrics](https://github.com/kubernetes/kube-state-metrics)** is your go-to for up-to-the-moment metrics.
- **[Prometheus](https://prometheus.io)** is like the Swiss Army knife in the toolbox—an observant monitoring system and a time-series database, coupled with an alarm bell to alert you.
- **[Node Problem Detector](