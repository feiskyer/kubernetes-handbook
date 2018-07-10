# Draft

Draft 是微软 Deis 团队开源（见 <https://github.com/azure/draft>）的容器应用开发辅助工具，它可以帮助开发人员简化容器应用程序的开发流程。

Draft 主要由三个命令组成

- `draft init`：初始化 docker registry 账号，并在 Kubernetes 集群中部署 draftd（负责镜像构建、将镜像推送到 docker registry 以及部署应用等）
- `draft create`：draft 根据 packs 检测应用的开发语言，并自动生成 Dockerfile 和 Kubernetes Helm Charts
- `draft up`：根据 Dockfile 构建镜像，并使用 Helm 将应用部署到 Kubernetes 集群（支持本地或远端集群）。同时，还会在本地启动一个 draft client，监控代码变化，并将更新过的代码推送给 draftd。

## Draft 安装

由于 Draft 需要构建镜像并部署应用到 Kubernetes 集群，因而在安装 Draft 之前需要

- 部署一个 Kubernetes 集群，部署方法可以参考 [kubernetes 部署方法](../deploy/index.md)
- 安装并初始化 helm（需要 v2.4.x 版本，并且不要忘记运行 `helm init`），具体步骤可以参考 [helm 使用方法](helm-app.md)
- 注册 docker registry 账号，比如 [Docker Hub](https://hub.docker.com/) 或[Quay.io](https://quay.io/)
- 配置 Ingress Controller 并在 DNS 中设置通配符域 `*` 的 A 记录（如 `*.draft.example.com`）到 Ingress IP 地址。最简单的 Ingress Controller 创建方式是使用 helm：

```sh
# 部署 nginx ingress controller
$ helm install stable/nginx-ingress --namespace=kube-system --name=nginx-ingress
# 等待 ingress controller 配置完成，并记下外网 IP
$ kubectl --namespace kube-system get services -w nginx-ingress-nginx-ingress-controller
```

> **minikube Ingress Controller**
>
> minikube 中配置和使用 Ingress Controller 的方法可以参考 [这里](../practice/minikube-ingress.md)。

初始化好 Kubernetes 集群和 Helm 后，可以在 [这里](https://github.com/Azure/draft/releases/latest) 下载 draft 二进制文件，并配置 draft

```sh
# 注意修改用户名、密码和邮件
$ token=$(echo '{"username":"feisky","password":"secret","email":"feisky@email.com"}' | base64)
# 注意修改 registry.org 和 basedomain
$ draft init --set registry.url=docker.io,registry.org=feisky,registry.authtoken=${token},basedomain=app.feisky.xyz
```

## Draft 入门

draft 源码中提供了很多应用的 [示例](https://github.com/Azure/draft/blob/master/examples)，我们来看一下怎么用 draft 来简化 python 应用的开发流程。

```sh
$ git clone https://github.com/Azure/draft.git
$ cd draft/examples/python
$ ls
app.py           requirements.txt

$ cat requirements.txt
flask
$ cat app.py
from flask import Flask
app = Flask(__name__)

@app.route('/')
def hello_world():
    return "Hello, World!\n"

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
```

Draft create 生成 Dockerfile 和 chart

```sh
$ draft create
--> Python app detected
--> Ready to sail
$ ls
Dockerfile       app.py           chart            draft.toml       requirements.txt
$ cat Dockerfile
FROM python:onbuild
EXPOSE 8080
ENTRYPOINT ["python"]
CMD ["app.py"]
$ cat draft.toml
[environments]
  [environments.development]
    name = "virulent-sheep"
    namespace = "default"
    watch = true
    watch_delay = 2
```

Draft Up 构建镜像并部署应用

```sh
$ draft up
--> Building Dockerfile
Step 1 : FROM python:onbuild
onbuild: Pulling from library/python
10a267c67f42: Pulling fs layer
....
Digest: sha256:5178d22192c2b8b4e1140a3bae9021ee0e808d754b4310014745c11f03fcc61b
Status: Downloaded newer image for python:onbuild
# Executing 3 build triggers...
Step 1 : COPY requirements.txt /usr/src/app/
Step 1 : RUN pip install --no-cache-dir -r requirements.txt
....
Successfully built f742caba47ed
--> Pushing docker.io/feisky/virulent-sheep:de7e97d0d889b4cdb81ae4b972097d759c59e06e
....
de7e97d0d889b4cdb81ae4b972097d759c59e06e: digest: sha256:7ee10c1a56ced4f854e7934c9d4a1722d331d7e9bf8130c1a01d6adf7aed6238 size: 2840
--> Deploying to Kubernetes
    Release "virulent-sheep" does not exist. Installing it now.
--> Status: DEPLOYED
--> Notes:

  http://virulent-sheep.app.feisky.xyzto access your application

Watching local files for changes...
```

打开一个新的 shell，就可以通过子域名来访问应用了

```sh
$ curl virulent-sheep.app.feisky.xyz
Hello, World!
```
