# Argo

Argo 是一個基於 Kubernetes 的工作流引擎，同時也支持 CI、CD 等豐富的功能。Argo 開源在 <https://github.com/argoproj>。

## 安裝 Argo

### 使用 argo install

```sh
# Download Argo.
curl -sSL -o argo https://github.com/argoproj/argo/releases/download/v2.1.0/argo-linux-amd64
chmod +x argo
sudo mv argo /usr/local/bin/argo

# Deploy to kubernetes
kubectl create namespace argo
argo install -n argo
```

```sh
ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
ACCESS_SECRET_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

helm install --namespace argo --name argo-artifacts --set accessKey=$ACCESS_KEY,secretKey=$ACCESS_SECRET_KEY,service.type=LoadBalancer stable/minio
```

創建名為 `argo-bucket` 的 Bucket（可以通過 `kubectl port-forward service/argo-artifacts-minio :9000` 訪問 Minio UI 來操作）：

```sh
# download mc client
sudo wget https://dl.minio.io/client/mc/release/linux-amd64/mc -O /usr/local/bin/mc
sudo chmod +x /usr/local/bin/mc

# create argo-bucket
EXTERNAL_IP=$(kubectl -n argo get service argo-artifacts-minio -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
mc config host add argo-artifacts-minio-local http://$EXTERNAL_IP:9000 $ACCESS_KEY $ACCESS_SECRET_KEY --api=s3v4
mc mb argo-artifacts-minio-local/argo-bucket
```

然後修改 Argo 工作流控制器使用 Minio：

```sh
$ kubectl -n argo create secret generic argo-artifacts-minio --from-literal=accesskey=$ACCESS_KEY --from-literal=secretkey=$ACCESS_SECRET_KEY
$ kubectl edit configmap workflow-controller-configmap -n argo
...
    executorImage: argoproj/argoexec:v2.0.0
    artifactRepository:
      s3:
        bucket: argo-bucket
        endpoint: argo-artifacts-minio.argo:9000
        insecure: true
        # accessKeySecret and secretKeySecret are secret selectors.
        # It references the k8s secret named 'argo-artifacts-minio'
        # which was created during the minio helm install. The keys,
        # 'accesskey' and 'secretkey', inside that secret are where the
        # actual minio credentials are stored.
        accessKeySecret:
          name: argo-artifacts-minio
          key: accesskey
        secretKeySecret:
          name: argo-artifacts-minio
          key: secretkey
```

### 使用 Helm

> 注意：當前 Helm Charts 使用的 Minio 版本較老，部署有可能會失敗。

```sh
# Download Argo.
curl -sSL -o /usr/local/bin/argo https://github.com/argoproj/argo/releases/download/v2.0.0/argo-linux-amd64
chmod +x /usr/local/bin/argo

# Deploy to kubernetes
helm repo add argo https://argoproj.github.io/argo-helm/
kubectl create clusterrolebinding default-admin --clusterrole=cluster-admin --serviceaccount=kube-system:default
helm install argo/argo-ci --name argo-ci --namespace=kube-system
```

## 訪問 Argo UI

```sh
$ kubectl -n argo port-forward service/argo-ui :80
Forwarding from 127.0.0.1:52592 -> 8001
Forwarding from [::1]:52592 -> 8001

# 使用瀏覽器打開 127.0.0.1:52592
```

## 工作流

首先，給默認的 ServiceAccount 授予集群管理權限

```sh
# Authz yourself if you are not admin.
kubectl create clusterrolebinding default-admin --clusterrole=cluster-admin --serviceaccount=argo:default
```

示例1： 最簡單的工作流

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  generateName: hello-world-
spec:
  entrypoint: whalesay
  templates:
  - name: whalesay
    container:
      image: docker/whalesay:latest
      command: [cowsay]
      args: ["hello world"]
```

```sh
argo -n argo submit https://raw.githubusercontent.com/argoproj/argo/master/examples/hello-world.yaml
```

示例2：包含多個容器的工作流

```yaml
# This example demonstrates the ability to pass artifacts
# from one step to the next.
apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  generateName: artifact-passing-
spec:
  entrypoint: artifact-example
  templates:
  - name: artifact-example
    steps:
    - - name: generate-artifact
        template: whalesay
    - - name: consume-artifact
        template: print-message
        arguments:
          artifacts:
          - name: message
            from: "{{steps.generate-artifact.outputs.artifacts.hello-art}}"

  - name: whalesay
    container:
      image: docker/whalesay:latest
      command: [sh, -c]
      args: ["cowsay hello world | tee /tmp/hello_world.txt"]
    outputs:
      artifacts:
      - name: hello-art
        path: /tmp/hello_world.txt

  - name: print-message
    inputs:
      artifacts:
      - name: message
        path: /tmp/message
    container:
      image: alpine:latest
      command: [sh, -c]
      args: ["cat /tmp/message"]
```

```sh
argo -n argo submit https://raw.githubusercontent.com/argoproj/argo/master/examples/artifact-passing.yaml
```

工作流創建完成後，可以查詢它們的狀態和日誌，並在不需要時刪除：

```sh
$ argo list
NAME                     STATUS    AGE   DURATION
artifact-passing-65p6g   Running   6s    4s
hello-world-cdnpq        Running   8s    6s

$ argo -n argo logs hello-world-4dhg8
 _____________
< hello world >
 -------------
    \
     \
      \
                    ##        .
              ## ## ##       ==
           ## ## ## ##      ===
       /""""""""""""""""___/ ===
  ~~~ {~~ ~~~~ ~~~ ~~~~ ~~ ~ /  ===- ~~~
       \______ o          __/
        \    \        __/
          \____\______/

$ argo -n argo delete hello-world-4dhg8
Workflow 'hello-world-4dhg8' deleted
```

更多工作流 YAML 的格式見[官方文檔](https://applatix.com/open-source/argo/docs/argo_v2_yaml.html)和[工作流示例](https://github.com/argoproj/argo/tree/master/examples)。
