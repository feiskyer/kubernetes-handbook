# Installation

Before dabbling into the installation of Istio, it is necessary to ensure that your Kubernetes cluster (only versions v1.9.0 and later are supported) is already deployed and that you have set up your local kubectl client appropriately. For instance, using minikube, you would need:

```bash
minikube start --memory=4096 --kubernetes-version=v1.11.1 --vm-driver=hyperkit
```

## Downloading Istio

```bash
curl -L https://git.io/getLatestIstio | sh -
sudo apt-get install -y jq
ISTIO_VERSION=$(curl -L -s https://api.github.com/repos/istio/istio/releases/latest | jq -r .tag_name)
cd istio-${ISTIO_VERSION}
cp bin/istioctl /usr/local/bin
```

## Deploying Istio Service

Initiating the Helm Tiller:

```bash
kubectl create -f install/kubernetes/helm/helm-service-account.yaml
helm init --service-account tiller
```

Then, deploy through Helm:

```bash
kubectl apply -f install/kubernetes/helm/istio/templates/crds.yaml
helm install install/kubernetes/helm/istio --name istio --namespace istio-system \
  --set ingress.enabled=true \
  --set gateways.enabled=true \
  --set galley.enabled=true \
  --set sidecarInjectorWebhook.enabled=true \
  --set mixer.enabled=true \
  --set prometheus.enabled=true \
  --set grafana.enabled=true \
  --set servicegraph.enabled=true \
  --set tracing.enabled=true \
  --set kiali.enabled=false
```

Upon completion, you can validate whether services within the isotio-system namespace are running properly:

```bash
$ kubectl -n istio-system get pod
$ kubectl -n istio-system get service
```

## Mesh Extension

Istio also supports the management of non-Kubernetes applications. At this point, it's required to deploy Istio on VMs or physical servers where the applications are staged, with detailed steps available at [https://istio.io/docs/setup/kubernetes/additional-setup/mesh-expansion/](https://istio.io/docs/setup/kubernetes/additional-setup/mesh-expansion/). Note that certain prerequisites need to be fulfilled before deployment

* The server to be connected must be accessible via IP to service endpoints within the mesh, which often requires support from VPN or VPC, or non-NAT and non-firewall blocked direct routes provided by container networks. There's no need for the server to access cluster IP addresses assigned by Kubernetes.
* The Istio control plane services (Pilot, Mixer, Citadel) and Kubernetes’ DNS server must be accessible from the virtual machine, often fulfilled using an [internal load balancer](https://kubernetes.io/docs/concepts/services-networking/service/#internal-load-balancer), running Istio components on the virtual machine, or custom network configurations. 

After deployment, applications can be registered with Istio, like so:

```bash
# istioctl register servicename machine-ip portname:port
$ istioctl -n onprem register mysql 1.2.3.4 3306
$ istioctl -n onprem register svc1 1.2.3.4 http:7000
```

## Prometheus, Grafana, and Zipkin

Once all pods are up and running, these services can be accessed through NodePort, the external IP of the load balancing service, or `kubectl proxy`. For instance, to access through `kubectl proxy`, launch it first:

```bash
$ kubectl proxy
```
Then access Grafana at `http://localhost:8001/api/v1/namespaces/istio-system/services/grafana:3000/proxy/`, and ServiceGraph at `http://localhost:8001/api/v1/namespaces/istio-system/services/servicegraph:8088/proxy/`, which displays a diagram of the connections between services.

* `/force/forcegraph.html` An interactive [D3.js](https://d3js.org/) visualization.
* `/dotviz` A static [Graphviz](https://www.graphviz.org/) visualization.
* `/dotgraph` Provides a [DOT](https://en.wikipedia.org/wiki/DOT_%28graph_description_language%29) serialization.
* `/d3graph` Provides a JSON serialization for D3 visualization.
* `/graph` Provides a generic JSON serialization.

You can access the Zipkin trace page at `http://localhost:8001/api/v1/namespaces/istio-system/services/zipkin:9411/proxy/`, and the Prometheus page at `http://localhost:8001/api/v1/namespaces/istio-system/services/prometheus:9090/proxy/`.

![](../../.gitbook/assets/grafana%20%2810%29.png)
![](../../.gitbook/assets/servicegraph%20%282%29.png)
![](../../.gitbook/assets/zipkin%20%283%29.png)
![](../../.gitbook/assets/prometheus%20%288%29.png)

