# Tensorflow

[Kubeflow](https://github.com/google/kubeflow) 是 Google 发布的用于在 Kubernetes 集群中部署和管理 tensorflow 任务的框架。主要功能包括

- 用于管理 Jupyter 的 JupyterHub 服务
- 用于管理训练任务的 Tensorflow Training Controller
- 用于模型服务的 TF Serving 容器

## 部署

部署之前需要确保

- 一套部署好的 Kubernetes 集群或者 Minikube，并配置好 kubectl 命令行工具
- 安装 [ksonnet](https://github.com/ksonnet/ksonnet) 0.8.0 以上版本

对于开启 RBAC 的 Kubernetes 集群，首先要创建管理员角色绑定：

```
kubectl create clusterrolebinding tf-admin --clusterrole=cluster-admin --serviceaccount=default:tf-job-operator
```

然后运行以下命令部署

```sh
ks init my-kubeflow
cd my-kubeflow
ks registry add kubeflow github.com/google/kubeflow/tree/master/kubeflow
ks pkg install kubeflow/core
ks pkg install kubeflow/tf-serving
ks pkg install kubeflow/tf-job
ks generate core kubeflow-core --name=kubeflow-core
ks apply default -c kubeflow-core
```

如果有多个 Kubernetes 集群，也可以切换到其他其集群中部署，如

```sh
kubectl config use-context gke
ks env add gke
ks apply gke -c kubeflow-core
```

稍等一会，就可以看到 `tf-hub-lb` 服务的公网IP，也就是 JupyterHub 的访问地址

```sh
kubectl get svc tf-hub-lb
```

对于不支持 LoadBalancer Service 的集群，还可以通过端口转发（`http://127.0.0.1:8100`）的方式来访问：

```sh
kubectl port-forward tf-hub-0 8100:8000
```

JupyterHub 默认可以用任意用户名和密码登录。登陆后，可以使用自定义镜像来启动 Notebook Server，比如使用

- `gcr.io/kubeflow/tensorflow-notebook-cpu`
- `gcr.io/kubeflow/tensorflow-notebook-gpu`

## 训练示例

使用 CPU：

```sh
ks generate tf-cnn cnn --name=cnn
ks apply gke -c cnn
```

使用 GPU：

```sh
ks param set cnn num_gpus 1
ks param set  cnn num_workers 1
ks apply default -c cnn
```

## 模型部署

```
MODEL_COMPONENT=serveInception
MODEL_NAME=inception
MODEL_PATH=gs://cloud-ml-dev_jlewi/tmp/inception
ks generate tf-serving ${MODEL_COMPONENT} --name=${MODEL_NAME} --namespace=default --model_path=${MODEL_PATH}

ks apply gke -c ${MODEL_COMPONENT}
```

## 参考文档

- [Introducing Kubeflow - A Composable, Portable, Scalable ML Stack Built for Kubernetes](http://blog.kubernetes.io/2017/12/introducing-kubeflow-composable.html)
- <https://github.com/google/kubeflow>