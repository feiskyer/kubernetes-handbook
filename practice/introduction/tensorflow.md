# Tensorflow

Kubeflow is a framework released by Google for deploying and managing tensorflow tasks in Kubernetes clusters. Its main features include:

* JupyterHub service for managing Jupyter notebooks
* Tensorflow Training Controller for managing training tasks
* TF Serving container for model services

## Deployment

Before deploying, ensure that:

* A Kubernetes cluster or Minikube is set up, with the kubectl command-line tool configured
* [ksonnet](https://github.com/ksonnet/ksonnet) version 0.8.0 or higher is installed

For Kubernetes clusters with RBAC enabled, first create a cluster role binding for admins:

```text
kubectl create clusterrolebinding tf-admin --clusterrole=cluster-admin --serviceaccount=default:tf-job-operator
```

Then run the following commands to deploy:

```bash
ks init my-kubeflow
cd my-kubeflow
ks registry add kubeflow github.com/google/kubeflow/tree/master/kubeflow
ks pkg install kubeflow/core
ks pkg install kubeflow/tf-serving
ks pkg install kubeflow/tf-job
ks generate core kubeflow-core --name=kubeflow-core
ks apply default -c kubeflow-core
```

If you have multiple Kubernetes clusters, you can switch to another cluster to deploy, for example:

```bash
kubectl config use-context gke
ks env add gke
ks apply gke -c kubeflow-core
```

After a while, you can see the public IP of the `tf-hub-lb` service, which is the access address for JupyterHub:

```bash
kubectl get svc tf-hub-lb
```

For clusters that do not support LoadBalancer Service, you can also access it through port forwarding (`http://127.0.0.1:8100`):

```bash
kubectl port-forward tf-hub-0 8100:8000
```

By default, JupyterHub can be logged in with any username and password. After logging in, you can use custom images to start the Notebook Server, such as:

* `gcr.io/kubeflow/tensorflow-notebook-cpu`
* `gcr.io/kubeflow/tensorflow-notebook-gpu`

## Training Example

Using CPU:

```bash
ks generate tf-cnn cnn --name=cnn
ks apply gke -c cnn
```

Using GPU:

```bash
ks param set cnn num_gpus 1
ks param set cnn num_workers 1
ks apply default -c cnn
```

## Model Deployment

```text
MODEL_COMPONENT=serveInception
MODEL_NAME=inception
MODEL_PATH=gs://cloud-ml-dev_jlewi/tmp/inception
ks generate tf-serving ${MODEL_COMPONENT} --name=${MODEL_NAME} --namespace=default --model_path=${MODEL_PATH}

ks apply gke -c ${MODEL_COMPONENT}
```

## Reference Documents

* [Introducing Kubeflow - A Composable, Portable, Scalable ML Stack Built for Kubernetes](http://blog.kubernetes.io/2017/12/introducing-kubeflow-composable.html)
* [https://github.com/google/kubeflow](https://github.com/google/kubeflow)

---

# Tensorflow

## Kubeflow: Google's Kubernetes-Based Framework for Managing TensorFlow Tasks

[Kubeflow](https://github.com/google/kubeflow), crafted by Google, is an exceptional tool for deploying and overseeing TensorFlow processes within Kubernetes environments. It boasts a suite of impressive features, such as:

* JupyterHub services for the seamless running of Jupyter notebooks
* A dedicated Tensorflow Training Controller for orchestrating training operations
* A ready-to-serve TF Serving container aimed at model deployment

## How to Deploy

Before ushering into the deployment phase, ensure the following prerequisites are met:

* An operational Kubernetes cluster or Minikube, along with the adeptly configured kubectl CLI
* Installation of [ksonnet](https://github.com/ksonnet/ksonnet) version 0.8.0 or higher is complete

In the case of Kubernetes clusters that are fortified with RBAC, kick off by assembling an admin-level cluster role binding:

```text
kubectl create clusterrolebinding tf-admin --clusterrole=cluster-admin --serviceaccount=default:tf-job-operator
```

Subsequently, embark on the deployment journey with these commands:

```bash
ks init my-kubeflow
cd my-kubeflow
ks registry add kubeflow github.com/google/kubeflow/tree/master/kubeflow
ks pkg install kubeflow/core
ks pkg install kubeflow/tf-serving
ks pkg install kubeflow/tf-job
ks generate core kubeflow-core --name=kubeflow-core
ks apply default -c kubeflow-core
```

Got more than one Kubernetes cluster? No problem! Simply swap over to another and proceed with the deployment, take for instance:

```bash
kubectl config use-context gke
ks env add gke
ks apply gke -c kubeflow-core
```

Hang tight for a bit, and soon the `tf-hub-lb` service's public IP surfaces, serving as your gateway to JupyterHub:

```bash
kubectl get svc tf-hub-lb
```

In scenarios where the LoadBalancer Service isn't in the cards, reach your destination via port forwarding (`http://127.0.0.1:8100`):

```bash
kubectl port-forward tf-hub-0 8100:8000
```

JupyterHub's doors are open to any username and password by default. Once inside, spark up your Notebook Server using custom images like:

* `gcr.io/kubeflow/tensorflow-notebook-cpu`
* `gcr.io/kubeflow/tensorflow-notebook-gpu`

## Training Showcase

Flexing CPU Muscles:

```bash
ks generate tf-cnn cnn --name=cnn
ks apply gke -c cnn
```

Tapping into GPU Power:

```bash
ks param set cnn num_gpus 1
ks param set cnn num_workers 1
ks apply default -c cnn
```

## Model On the Move

```text
MODEL_COMPONENT=serveInception
MODEL_NAME=inception
MODEL_PATH=gs://cloud-ml-dev_jlewi/tmp/inception
ks generate tf-serving ${MODEL_COMPONENT} --name=${MODEL_NAME} --namespace=default --model_path=${MODEL_PATH}

ks apply gke -c ${MODEL_COMPONENT}
```

## Handy Guides

* [Introducing Kubeflow - A Composable, Portable, Scalable ML Stack Built for Kubernetes](http://blog.kubernetes.io/2017/12/introducing-kubeflow-composable.html)
* [https://github.com/google/kubeflow](https://github.com/google/kubeflow)