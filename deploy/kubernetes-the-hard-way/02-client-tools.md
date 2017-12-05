
# 安装Client 工具

---

本次实验你将会安装一些实用的指令工具, 用来完成这整份教学 :  [cfssl](https://github.com/cloudflare/cfssl), [cfssljson](https://github.com/cloudflare/cfssl), and [kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl)

从[cfssl repository](https://pkg.cfssl.org)下载`cfssl` and `cfssljson` 并安装

### OS X

```
curl -o cfssl https://pkg.cfssl.org/R1.2/cfssl_darwin-amd64
curl -o cfssljson https://pkg.cfssl.org/R1.2/cfssljson_darwin-amd64
```

```
chmod +x cfssl cfssljson
```

```
sudo mv cfssl cfssljson /usr/local/bin/
```

### Linux

```
wget -q --show-progress --https-only --timestamping \
  https://pkg.cfssl.org/R1.2/cfssl_linux-amd64 \
  https://pkg.cfssl.org/R1.2/cfssljson_linux-amd64
```

```
chmod +x cfssl_linux-amd64 cfssljson_linux-amd64
```

```
sudo mv cfssl_linux-amd64 /usr/local/bin/cfssl
```

```
sudo mv cfssljson_linux-amd64 /usr/local/bin/cfssljson
```

### 验证

验证`cfssl`的版本为1.2.0或是更高

```
cfssl version
```

> 输出为

```
Version: 1.2.0
Revision: dev
Runtime: go1.6
```
> cfssljson的指令工具没有提供方法来列出版本

## 安装kubectl

`kubectk`指令工具是用来与 Kubernetes API Server沟通的, 下载并安装`kubectl` ,可在官方取得
### OS X

```
curl -o kubectl https://storage.googleapis.com/kubernetes-release/release/v1.8.0/bin/darwin/amd64/kubectl
```

```
chmod +x kubectl
```

```
sudo mv kubectl /usr/local/bin/
```

### Linux

```
wget https://storage.googleapis.com/kubernetes-release/release/v1.8.0/bin/linux/amd64/kubectl
```

```
chmod +x kubectl
```

```
sudo mv kubectl /usr/local/bin/
```

### 验证

验证`kubectl`的安装版本为 1.8.0 或是更高
```
kubectl version --client
```

> 输出为

```
Client Version: version.Info{Major:"1", Minor:"8", GitVersion:"v1.8.0", GitCommit:"6e937839ac04a38cac63e6a7a306c5d035fe7b0a", GitTreeState:"clean", BuildDate:"2017-09-28T22:57:57Z", GoVersion:"go1.8.3", Compiler:"gc", Platform:"darwin/amd64"}
```

Next: [準备计算资源](03-compute-resources.md)
