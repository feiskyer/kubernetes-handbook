# Play with Kubernetes

[Play with Kubernetes](http://play-with-k8s.com)提供了一个免费的Kubernets体验环境，每次创建的集群最长可以使用4小时。

## 集群初始化

打开[play-with-k8s.com](http://play-with-k8s.com)，点击"ADD NEW INSTANCE"，并在新INSTANCE（名字为node1）的TERMINAL中初始化kubernetes master：

```sh
$ kubeadm init --apiserver-advertise-address $(hostname -i)
Initializing machine ID from random generator.
[kubeadm] WARNING: kubeadm is in beta, please do not use it for production clusters.
[init] Using Kubernetes version: v1.7.0
[init] Using Authorization modes: [Node RBAC]
[preflight] Skipping pre-flight checks
[certificates] Generated CA certificate and key.
[certificates] Generated API server certificate and key.
[certificates] API Server serving cert is signed for DNS names [node1 kubernetes kubernetes.default kubernetes.default.svc kubernetes.default.svc.cluster.local] and IPs [10.96.0.1 10.0.1.3]
[certificates] Generated API server kubelet client certificate and key.
[certificates] Generated service account token signing key and public key.
[certificates] Generated front-proxy CA certificate and key.
[certificates] Generated front-proxy client certificate and key.
[certificates] Valid certificates and keys now exist in "/etc/kubernetes/pki"
[kubeconfig] Wrote KubeConfig file to disk: "/etc/kubernetes/admin.conf"
[kubeconfig] Wrote KubeConfig file to disk: "/etc/kubernetes/kubelet.conf"
[kubeconfig] Wrote KubeConfig file to disk: "/etc/kubernetes/controller-manager.conf"
[kubeconfig] Wrote KubeConfig file to disk: "/etc/kubernetes/scheduler.conf"
[apiclient] Created API client, waiting for the control plane to become ready
[apiclient] All control plane components are healthy after 25.001152 seconds
[token] Using token: 35e301.77277e7cafee013c
[apiconfig] Created RBAC rules
[addons] Applied essential addon: kube-proxy
[addons] Applied essential addon: kube-dns

Your Kubernetes master has initialized successfully!

To start using your cluster, you need to run (as a regular user):

  mkdir -p $HOME/.kube
  sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
  sudo chown $(id -u):$(id -g) $HOME/.kube/config

You should now deploy a pod network to the cluster.
Run "kubectl apply -f [podnetwork].yaml" with one of the options listed at:
  http://kubernetes.io/docs/admin/addons/

You can now join any number of machines by running the following on each node
as root:

  kubeadm join --token 35e301.77277e7cafee013c 10.0.1.3:6443

Waiting for api server to startup...........
Warning: kubectl apply should be used on resource created by either kubectl create --save-config or kubectl apply
daemonset "kube-proxy" configured
```

> 注意：记住输出中的`kubeadm join --token 35e301.77277e7cafee013c 10.0.1.3:6443`命令，后面会用来添加新的节点。

## 配置kubectl

```sh
mkdir -p $HOME/.kube
cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
chown $(id -u):$(id -g) $HOME/.kube/config
```

## 初始化网络

```sh
kubectl apply -n kube-system -f "https://cloud.weave.works/k8s/net?k8s-version=$(kubectl version | base64 | tr -d '\n')"
```

## 创建Dashboard

```sh
curl -L -s https://raw.githubusercontent.com/kubernetes/dashboard/v1.10.1/src/deploy/recommended/kubernetes-dashboard.yaml  | sed 's/targetPort: 9090/targetPort: 9090\n  type: LoadBalancer/' | kubectl apply -f -
```

稍等一会，在页面上方会显示Dashborad服务的端口号，点击端口号就可以访问Dashboard页面。

## 添加新的节点

点击"ADD NEW INSTANCE"，并在新INSTANCE的TERMINAL中输入前面第一步记住的`kubeadm join`命令，如

```sh
kubeadm join --token 35e301.77277e7cafee013c 10.0.1.3:6443
```

回到node1的TERMINAL，输入`kubectl get node`即可查看所有Node的状态。等所有Node状态都变成Ready后，整个Kubernetes集群都搭建好了。
