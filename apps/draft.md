# Draft

Draft 是微軟 Deis 團隊開源（見 <https://github.com/azure/draft>）的容器應用開發輔助工具，它可以幫助開發人員簡化容器應用程序的開發流程。

Draft 主要由三個命令組成

- `draft init`：初始化 docker registry 賬號，並在 Kubernetes 集群中部署 draftd（負責鏡像構建、將鏡像推送到 docker registry 以及部署應用等）
- `draft create`：draft 根據 packs 檢測應用的開發語言，並自動生成 Dockerfile 和 Kubernetes Helm Charts
- `draft up`：根據 Dockfile 構建鏡像，並使用 Helm 將應用部署到 Kubernetes 集群（支持本地或遠端集群）。同時，還會在本地啟動一個 draft client，監控代碼變化，並將更新過的代碼推送給 draftd。

## Draft 安裝

由於 Draft 需要構建鏡像並部署應用到 Kubernetes 集群，因而在安裝 Draft 之前需要

- 部署一個 Kubernetes 集群，部署方法可以參考 [kubernetes 部署方法](../deploy/index.md)
- 安裝並初始化 helm（需要 v2.4.x 版本，並且不要忘記運行 `helm init`），具體步驟可以參考 [helm 使用方法](helm-app.md)
- 註冊 docker registry 賬號，比如 [Docker Hub](https://hub.docker.com/) 或[Quay.io](https://quay.io/)
- 配置 Ingress Controller 並在 DNS 中設置通配符域 `*` 的 A 記錄（如 `*.draft.example.com`）到 Ingress IP 地址。最簡單的 Ingress Controller 創建方式是使用 helm：

```sh
# 部署 nginx ingress controller
$ helm install stable/nginx-ingress --namespace=kube-system --name=nginx-ingress
# 等待 ingress controller 配置完成，並記下外網 IP
$ kubectl --namespace kube-system get services -w nginx-ingress-nginx-ingress-controller
```

> **minikube Ingress Controller**
>
> minikube 中配置和使用 Ingress Controller 的方法可以參考 [這裡](../practice/minikube-ingress.md)。

初始化好 Kubernetes 集群和 Helm 後，可以在 [這裡](https://github.com/Azure/draft/releases/latest) 下載 draft 二進制文件，並配置 draft

```sh
# 注意修改用戶名、密碼和郵件
$ token=$(echo '{"username":"feisky","password":"secret","email":"feisky@email.com"}' | base64)
# 注意修改 registry.org 和 basedomain
$ draft init --set registry.url=docker.io,registry.org=feisky,registry.authtoken=${token},basedomain=app.feisky.xyz
```

## Draft 入門

draft 源碼中提供了很多應用的 [示例](https://github.com/Azure/draft/blob/master/examples)，我們來看一下怎麼用 draft 來簡化 python 應用的開發流程。

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

Draft Up 構建鏡像並部署應用

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

打開一個新的 shell，就可以通過子域名來訪問應用了

```sh
$ curl virulent-sheep.app.feisky.xyz
Hello, World!
```
