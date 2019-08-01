# Tensorflow

[Kubeflow](https://github.com/google/kubeflow) 是 Google 發佈的用於在 Kubernetes 集群中部署和管理 tensorflow 任務的框架。主要功能包括

- 用於管理 Jupyter 的 JupyterHub 服務
- 用於管理訓練任務的 Tensorflow Training Controller
- 用於模型服務的 TF Serving 容器

## 部署

部署之前需要確保

- 一套部署好的 Kubernetes 集群或者 Minikube，並配置好 kubectl 命令行工具
- 安裝 [ksonnet](https://github.com/ksonnet/ksonnet) 0.8.0 以上版本

對於開啟 RBAC 的 Kubernetes 集群，首先要創建管理員角色綁定：

```
kubectl create clusterrolebinding tf-admin --clusterrole=cluster-admin --serviceaccount=default:tf-job-operator
```

然後運行以下命令部署

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

如果有多個 Kubernetes 集群，也可以切換到其他其集群中部署，如

```sh
kubectl config use-context gke
ks env add gke
ks apply gke -c kubeflow-core
```

稍等一會，就可以看到 `tf-hub-lb` 服務的公網IP，也就是 JupyterHub 的訪問地址

```sh
kubectl get svc tf-hub-lb
```

對於不支持 LoadBalancer Service 的集群，還可以通過端口轉發（`http://127.0.0.1:8100`）的方式來訪問：

```sh
kubectl port-forward tf-hub-0 8100:8000
```

JupyterHub 默認可以用任意用戶名和密碼登錄。登陸後，可以使用自定義鏡像來啟動 Notebook Server，比如使用

- `gcr.io/kubeflow/tensorflow-notebook-cpu`
- `gcr.io/kubeflow/tensorflow-notebook-gpu`

## 訓練示例

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

## 參考文檔

- [Introducing Kubeflow - A Composable, Portable, Scalable ML Stack Built for Kubernetes](http://blog.kubernetes.io/2017/12/introducing-kubeflow-composable.html)
- <https://github.com/google/kubeflow>