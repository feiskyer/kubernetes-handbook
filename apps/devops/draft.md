# Draft: Made for Simplicity

Magically simplify your container application development process with it comes to Draft. It's the open source helper for container app development, generously bestowed on the masses by the devoted Microsoft's Deis team. You'll find it sitting pretty and inviting your curious click [right here on Github](https://github.com/azure/draft).

Keyed by three main commands, Draft makes life a whole lot easier for developers:

* `draft init`: Consider this the magician's wand granting life to your Docker registry account. It oversees image construction, pushes the images to the Docker registry, and manages app deployment in the Kubernetes cluster.
* `draft create`: This little helper analyses your app's development language based on packs, and automatically spins up Dockerfile and Kubernetes Helm Charts.
* `draft up`: This command is the muscle that brings it all together. It constructs images from Dockerfile and uses Helm to deploy your app to Kubernetes clusters (local or remote). No feeling of FOMO here - it simultaneously kicks off a Draft client on your local system to track code changes and push the updated code towards draftd.

## Draft Installation: Getting Down to Business

Before you get all excited and install Draft, make certain you have:

* A Kubernetes cluster on standby. If you're unsure about this step, check out the [Kubernetes deployment guide](../../setup/index.md).
* Installed and initialized Helm (Ensure you have v2.4.x version and you definitely don't want to forget to run `helm init`). Here's a quick [how-to on Helm](../../apps/index/helm.md) for further reference.
* Registered a Docker registry account - think [Docker Hub](https://hub.docker.com/) or [Quay.io](https://quay.io/).
* Configured Ingress Controller and placed wildcard domain `*` A record (example: `*.draft.example.com`) in your DNS, pointing to the Ingress IP address. Check out the simplistic way of creating an Ingress Controller using Helm:

```bash
# Deploy nginx ingress controller
$ helm install stable/nginx-ingress --namespace=kube-system --name=nginx-ingress
# Wait for the completion of ingress controller configuration, and note the public IP
$ kubectl --namespace kube-system get services -w nginx-ingress-nginx-ingress-controller
```

> **minikube Ingress Controller**
>
> Learn how to configure and use Ingress Controller in minikube [here](../../extension/ingress/minikube-ingress.md).

Once you're all set with your Kubernetes cluster and Helm, you're good to download the Draft binary file [here](https://github.com/Azure/draft/releases/latest) and set up Draft.

```bash
# Take note of updating the username, password and email
$ token=$(echo '{"username":"feisky","password":"secret","email":"feisky@email.com"}' | base64)
# Be sure to update registry.org and basedomain
$ draft init --set registry.url=docker.io,registry.org=feisky,registry.authtoken=${token},basedomain=app.feisky.xyz
```

## Draft Onboarding: Learning the Ropes 

Dig into the Draft source code to find a wealth of [examples](https://github.com/Azure/draft/blob/master/examples). Let's take a look at how Draft can streamline the development process of a Python application.

```bash
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

Draft generates Dockerfile and chart using Draft create 

```bash
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

Draft Up builds image and deploys application

```bash
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

Open up a new shell and voila! You can now access your application via the subdomain.

```bash
$ curl virulent-sheep.app.feisky.xyz
Hello, World!
```
So go ahead, give Draft a spin. Let it cast its enchantment around your container app development process.