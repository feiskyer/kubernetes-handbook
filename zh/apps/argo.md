# Argo

Argo 是一个基于 Kubernetes 的工作流引擎，同时也支持 CI、CD 等丰富的功能。Argo 开源在 <https://github.com/argoproj>。

## 安装

### 不用 Helm

```sh
# Downlaod Argo.
curl -sSL -o /usr/local/bin/argo https://github.com/argoproj/argo/releases/download/v2.0.0/argo-linux-amd64
chmod +x /usr/local/bin/argo

# Deploy to kubernetes
argo install
```

```sh
# Install an Artifact Repository
helm install stable/minio --name argo-artifacts --set service.type=LoadBalancer
```

访问 Minio UI（通过 `kubectl port-forward service/argo-artifacts-minio :9000`）并创建名为 `my-bucket` 的 Bucket。然后修改 Argo 工作流控制器使用 Minio：

```sh
$ kubectl -n kube-system create secret generic argo-artifacts-minio --from-literal=accesskey=AKIAIOSFODNN7EXAMPLE --from-literal=secretkey=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
$ kubectl edit configmap workflow-controller-configmap -n kube-system
...
    executorImage: argoproj/argoexec:v2.0.0
    artifactRepository:
      s3:
        bucket: my-bucket
        endpoint: argo-artifacts-minio.default:9000
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

> 注意：当前 Helm Charts 使用的 Minio 版本较老，部署有可能会失败。

```sh
# Downlaod Argo.
curl -sSL -o /usr/local/bin/argo https://github.com/argoproj/argo/releases/download/v2.0.0/argo-linux-amd64
chmod +x /usr/local/bin/argo

# Deploy to kubernetes
helm repo add argo https://argoproj.github.io/argo-helm/
kubectl create clusterrolebinding default-admin --clusterrole=cluster-admin --serviceaccount=kube-system:default
helm install argo/argo-ci --name argo-ci --namespace=kube-system
```

### 访问 Argo UI

```sh
$ kubectl -n kube-system port-forward service/argo-ui :80
Forwarding from 127.0.0.1:52592 -> 8001
Forwarding from [::1]:52592 -> 8001

# 使用浏览器打开 127.0.0.1:52592
```

## 工作流

首先，给默认的 ServiceAccount 授予集群管理权限

```sh
# Authz yourself if you are not admin.
kubectl create clusterrolebinding default-admin --clusterrole=cluster-admin --serviceaccount=default:default
```

示例1： 最简单的工作流

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
argo submit https://raw.githubusercontent.com/argoproj/argo/master/examples/hello-world.yaml
```

示例2：包含多个容器的工作流

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
argo submit https://raw.githubusercontent.com/argoproj/argo/master/examples/artifact-passing.yaml
```

工作流创建完成后，可以查询它们的状态和日志，并在不需要时删除：

```sh
$ argo list
NAME                     STATUS    AGE   DURATION
artifact-passing-65p6g   Running   6s    4s
hello-world-cdnpq        Running   8s    6s

$ argo logs hello-world-4dhg8
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

$ argo delete hello-world-4dhg8
Workflow 'hello-world-4dhg8' deleted
```

更多工作流 YAML 的格式见[官方文档](https://applatix.com/open-source/argo/docs/argo_v2_yaml.html)和[工作流示例](https://github.com/argoproj/argo/tree/master/examples)。
