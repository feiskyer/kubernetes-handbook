# Log Management

ELK is the golden trio for container log collection, processing, and searching:

* Logstash (or Fluentd) is responsible for log collection
* Elasticsearch stores logs and provides search capabilities
* Kibana handles log querying and visualization

Note: Kubernetes by default uses fluentd (launched as a DaemonSet) to collect logs and then sends them to elasticsearch.

**Pro Tip**

When deploying a cluster with `cluster/kube-up.sh`, you can set the `KUBE_LOGGING_DESTINATION` environment variable to automatically deploy Elasticsearch and Kibana and use fluentd to collect logs \(see configuration at [addons/fluentd-elasticsearch](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/fluentd-elasticsearch)\):

```bash
KUBE_LOGGING_DESTINATION=elasticsearch
KUBE_ENABLE_NODE_LOGGING=true
cluster/kube-up.sh
```

If you're using GCE or GKE, you can also [send logs to Google Cloud Logging](https://kubernetes.io/docs/user-guide/logging/stackdriver/) and integrate with Google Cloud Storage and BigQuery.

For other logging solutions, you can customize the docker log driver to send logs to splunk, awslogs, and more.

## Deployment Method

Since the Fluentd daemonset is only scheduled to run on Nodes with the label `beta.kubernetes.io/fluentd-ds-ready=true`, you need to label the Nodes accordingly:

```bash
kubectl label nodes --all beta.kubernetes.io/fluentd-ds-ready=true
```

Then download the manifest and deploy:

```bash
$ git clone https://github.com/kubernetes/kubernetes
$ cd kubernetes/cluster/addons/fluentd-elasticsearch
$ kubectl apply -f .
clusterrole "elasticsearch-logging" configured
clusterrolebinding "elasticsearch-logging" configured
replicationcontroller "elasticsearch-logging-v1" configured
service "elasticsearch-logging" configured
serviceaccount "elasticsearch-logging" configured
clusterrole "fluentd-es" configured
clusterrolebinding "fluentd-es" configured
daemonset "fluentd-es-v1.24" configured
serviceaccount "fluentd-es" configured
deployment "kibana-logging" configured
service "kibana-logging" configured
```

Note: The Kibana container might take a while during the first startup to optimize and cache bundles (Optimizing and caching bundles for kibana and statusPage. This may take a few minutes). Monitor the initialization via logs:

```bash
$ kubectl -n kube-system logs kibana-logging-1237565573-p88lm -f
```

## Accessing Kibana

You can find the Kibana service access URL from the output of `kubectl cluster-info`. Note that you'll need to import the apiserver certificate into your browser for authentication:

```bash
$ kubectl cluster-info | grep Kibana
Kibana is running at https://10.0.4.3:6443/api/v1/namespaces/kube-system/services/kibana-logging/proxy
```

Alternatively, use the kubectl proxy to access without needing to import the certificate:

```bash
# Start the proxy
kubectl proxy --address='0.0.0.0' --port=8080 --accept-hosts='^*$' &
```

Then open `http://<master-ip>:8080/api/v1/proxy/namespaces/kube-system/services/kibana-logging/app/kibana#`. In the Settings -> Indices page, create an index, select Index contains time-based events, use the default `logstash-*` pattern, and click Create.

![](../../.gitbook/assets/kibana%20%283%29.png)

## Filebeat

In addition to Fluentd and Logstash, you can use [Filebeat](https://www.elastic.co/products/beats/filebeat) for log collection:

```bash
kubectl apply -f https://raw.githubusercontent.com/elastic/beats/master/deploy/kubernetes/filebeat-kubernetes.yaml
```

Note: The default setup assumes Elasticsearch is accessible via `elasticsearch:9200`. If it's different, modify the details before deployment:

```bash
- name: ELASTICSEARCH_HOST
  value: elasticsearch
- name: ELASTICSEARCH_PORT
  value: "9200"
- name: ELASTICSEARCH_USERNAME
  value: elastic
- name: ELASTICSEARCH_PASSWORD
  value: changeme
```

## Reference Documents

* [Logging Agent For Elasticsearch](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/fluentd-elasticsearch)
* [Logging Using Elasticsearch and Kibana](https://kubernetes.io/docs/tasks/debug-application-cluster/logging-elasticsearch-kibana/)

---

# The Golden Trio for Log Mastery

ELK stands out as the go-to combination for handling the entire lifecycle of log data in container environments:

- Logstash (or its alternative, Fluentd) takes on the role of log collection.
- Elasticsearch acts as the data storehouse, providing robust search capabilities.
- Kibana serves up the user interface, streamlining log queries and visual presentation.

Quick heads-up: Kubernetes has a default set-up with fluentd, running as a DaemonSet, to scoop up logs and shuttle them off to Elasticsearch.

**Handy Hint**

Deploying your cluster with `cluster/kube-up.sh` gets even better when you use the `KUBE_LOGGING_DESTINATION` environment variable. This nifty trick sets up Elasticsearch and Kibana on autopilot, with fluentd gathering the logs for you (dive into the settings at [addons/fluentd-elasticsearch](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/fluentd-elasticsearch)):

```bash
KUBE_LOGGING_DESTINATION=elasticsearch
KUBE_ENABLE_NODE_LOGGING=true
cluster/kube-up.sh
```

Google's Cloud ecosystem users (think GCE or GKE) can funnel logs straight to Google Cloud Logging and also bring Google Cloud Storage and BigQuery into the mix.

Feeling adventurous with logging solutions? Swap out the docker log driver to integrate services like Splunk or awslogs.

## Setting the Scene for Deployment

Fluentd daemonsets have a VIP list, and only nodes wearing the `beta.kubernetes.io/fluentd-ds-ready=true` badge get the daemonsets' attention. So start by tagging your nodes:

```bash
kubectl label nodes --all beta.kubernetes.io/fluentd-ds-ready=true
```

Next up, grab the manifest and deploy to your heart's content:

```bash
$ git clone https://github.com/kubernetes/kubernetes
$ cd kubernetes/cluster/addons/fluentd-elasticsearch
$ kubectl apply -f .
```
(Expect the usual "configured" symphony for roles, bindings, services, and deployments.)

Just a note: The first time Kibana boots up, it's going to take its sweet time optimizing and caching (imagine it humming "Optimizing and caching bundles for kibana and statusPage. This may take a few minutes"). You can keep an eye on the warm-up process via logs:

```bash
$ kubectl -n kube-system logs kibana-logging-1237565573-p88lm -f
```

## Peeking into Kibana

Kibana's door can be found in the `kubectl cluster-info` output. Just a reminder to sync up with the apiserver certificate in your browser for a smooth handshake:

```bash
$ kubectl cluster-info | grep Kibana
```

Or, bypass the whole certificate song and dance by delegating to kubectl proxy:

```bash
# Activate the proxy
kubectl proxy --address='0.0.0.0' --port=8080 --accept-hosts='^*$' &
```

Go ahead and launch `http://<master-ip>:8080/api/v1/proxy/namespaces/kube-system/services/kibana-logging/app/kibana#`. When you land, set up a new index. Go with the flow—choose Index contains time-based events, stick with the `logstash-*` default, and hit Create.

![](../../.gitbook/assets/kibana%20%283%29.png)

## Enter Filebeat

For those who march to a different beat, Filebeat from the Elastic family offers another avenue for gathering logs with gusto:

```bash
kubectl apply -f https://raw.githubusercontent.com/elastic/beats/master/deploy/kubernetes/filebeat-kubernetes.yaml
```

Bear in mind, it presumes you can waltz straight into Elasticsearch at `elasticsearch:9200`. If your access route is different, adjust the settings and then deploy:

```bash
- name: ELASTICSEARCH_HOST
  value: elasticsearch
```
(and so on, with the port, username, and password)

## Treasure Trove of References

If you're itching to explore deeper, check out these documents:

- [Logging Agent For Elasticsearch](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/fluentd-elasticsearch)
- [Logging Using Elasticsearch and Kibana](https://kubernetes.io/docs/tasks/debug-application-cluster/logging-elasticsearch-kibana/)