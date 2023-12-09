# Argo

Argo is an open-source workflow engine built for Kubernetes with integrated functionalities of Continuous Integration (CI) and Continuous Delivery (CD). The source code can be accessed openly at [https://github.com/argoproj](https://github.com/argoproj).

## Installing Argo

### Using `argo install` command

```bash
# Download Argo.
curl -sSL -o argo https://github.com/argoproj/argo/releases/download/v2.1.0/argo-linux-amd64
chmod +x argo
sudo mv argo /usr/local/bin/argo

# Deploy to Kubernetes
kubectl create namespace argo
argo install -n argo
```

```bash
ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
ACCESS_SECRET_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

helm install --namespace argo --name argo-artifacts --set accessKey=$ACCESS_KEY,secretKey=$ACCESS_SECRET_KEY,service.type=LoadBalancer stable/minio
```

Next, create a bucket named `argo-bucket` (You can use `kubectl port-forward service/argo-artifacts-minio :9000` to reach the Minio UI for operation):

```bash
# download mc client
sudo wget https://dl.minio.io/client/mc/release/linux-amd64/mc -O /usr/local/bin/mc
sudo chmod +x /usr/local/bin/mc

# create argo-bucket
EXTERNAL_IP=$(kubectl -n argo get service argo-artifacts-minio -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
mc config host add argo-artifacts-minio-local http://$EXTERNAL_IP:9000 $ACCESS_KEY $ACCESS_SECRET_KEY --api=s3v4
mc mb argo-artifacts-minio-local/argo-bucket
```

Then, modify the Argo workflow controller to use Minio:

```bash
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

### Installing Using Helm

> Please note: The current Helm Charts use an outdated version of Minio and the deployment might fail.

```bash
# Download Argo.
curl -sSL -o /usr/local/bin/argo https://github.com/argoproj/argo/releases/download/v2.0.0/argo-linux-amd64
chmod +x /usr/local/bin/argo

# Deploy to Kubernetes
helm repo add argo https://argoproj.github.io/argo-helm/
kubectl create clusterrolebinding default-admin --clusterrole=cluster-admin --serviceaccount=kube-system:default
helm install argo/argo-ci --name argo-ci --namespace=kube-system
```

## Accessing the Argo UI

```bash
$ kubectl -n argo port-forward service/argo-ui :80
Forwarding from 127.0.0.1:52592 -> 8001
Forwarding from [::1]:52592 -> 8001

# Open browser and visit 127.0.0.1:52592
```

## Working with workflows

Firstly, give the default ServiceAccount cluster administration permission

```bash
# Authz yourself if you are not admin.
kubectl create clusterrolebinding default-admin --clusterrole=cluster-admin --serviceaccount=argo:default
```

Example 1: The simplest workflow

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

```bash
argo -n argo submit https://raw.githubusercontent.com/argoproj/argo/master/examples/hello-world.yaml
```

Example 2: Workflow with multiple containers

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

```bash
argo -n argo submit https://raw.githubusercontent.com/argoproj/argo/master/examples/artifact-passing.yaml
```

After the workflows are created, their status and logs can be queried, and they can be deleted when no longer needed:

```bash
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

For more information on the format of workflow YAML files, see the [official documentation](https://argoproj.github.io/argo-workflows/).