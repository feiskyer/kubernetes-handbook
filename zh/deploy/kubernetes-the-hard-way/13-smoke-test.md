# 烟雾测试

本部分将会运行一系列的测试来验证 Kubernetes 集群的功能正常。

## 数据加密

本节将会验证 [encrypt secret data at rest](https://kubernetes.io/docs/tasks/administer-cluster/encrypt-data/#verifying-that-data-is-encrypted) 的功能。

创建一个 Secret:

```sh
kubectl create secret generic kubernetes-the-hard-way \
  --from-literal="mykey=mydata"
```

查询存在 etcd 里 16 进位编码的 `kubernetes-the-hard-way` secret:

```sh
gcloud compute ssh controller-0 \
  --command "ETCDCTL_API=3 etcdctl get /registry/secrets/default/kubernetes-the-hard-way | hexdump -C"
```

输出为

```sh
00000000  2f 72 65 67 69 73 74 72  79 2f 73 65 63 72 65 74  |/registry/secret|
00000010  73 2f 64 65 66 61 75 6c  74 2f 6b 75 62 65 72 6e  |s/default/kubern|
00000020  65 74 65 73 2d 74 68 65  2d 68 61 72 64 2d 77 61  |etes-the-hard-wa|
00000030  79 0a 6b 38 73 3a 65 6e  63 3a 61 65 73 63 62 63  |y.k8s:enc:aescbc|
00000040  3a 76 31 3a 6b 65 79 31  3a ea 7c 76 32 43 62 6f  |:v1:key1:.|v2Cbo|
00000050  44 02 02 8c b7 ca fe 95  a5 33 f6 a1 18 6c 3d 53  |D........3...l=S|
00000060  e7 9c 51 ee 32 f6 e4 17  ea bb 11 d5 2f e2 40 00  |..Q.2......./.@.|
00000070  ae cf d9 e7 ba 7f 68 18  d3 c1 10 10 93 43 35 bd  |......h......C5.|
00000080  24 dd 66 b4 f8 f9 82 77  4a d5 78 03 19 41 1e bc  |$.f....wJ.x..A..|
00000090  94 3f 17 41 ad cc 8c ba  9f 8f 8e 56 97 7e 96 fb  |.?.A.......V.~..|
000000a0  8f 2e 6a a5 bf 08 1f 0b  c3 4b 2b 93 d1 ec f8 70  |..j......K+....p|
000000b0  c1 e4 1d 1a d2 0d f8 74  3a a1 4f 3c e0 c9 6d 3f  |.......t:.O<..m?|
000000c0  de a3 f5 fd 76 aa 5e bc  27 d9 3c 6b 8f 54 97 45  |....v.^.'.<k.T.E|
000000d0  31 25 ff 23 90 a4 2a f2  db 78 b1 3b ca 21 f3 6b  |1%.#..*..x.;.!.k|
000000e0  dd fb 8e 53 c6 23 0d 35  c8 0a                    |...S.#.5..|
000000ea
```

Etcd 的密钥以 `k8s:enc:aescbc:v1:key1` 为前缀, 表示使用密钥为 `key1` 的 `aescbc` 加密数据。

## 部署

本节将会验证建立与管理 [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) 的功能。

创建一个 Deployment 用来搭建 [nginx](https://nginx.org/en/) Web 服务：

```sh
kubectl run nginx --image=nginx
```

列出 `nginx` deployment 的 pods:

```sh
kubectl get pods -l run=nginx
```

输出为

```sh
NAME                     READY     STATUS    RESTARTS   AGE
nginx-4217019353-b5gzn   1/1       Running   0          15s
```

### 端口转发

本节将会验证使用 [port forwarding](https://kubernetes.io/docs/tasks/access-application-cluster/port-forward-access-application-cluster/) 从远端进入容器的功能。

查询 `nginx` pod 的全名:

```sh
POD_NAME=$(kubectl get pods -l run=nginx -o jsonpath="{.items[0].metadata.name}")
```

将本地机器的 8080 端口转发到 nginx pod 的 80 端口：

```sh
kubectl port-forward $POD_NAME 8080:80
```

输出为

```sh
Forwarding from 127.0.0.1:8080 -> 80
Forwarding from [::1]:8080 -> 80
```

开一个新的终端来做 HTTP 请求测试:

```sh
curl --head http://127.0.0.1:8080
```

输出为

```sh
HTTP/1.1 200 OK
Server: nginx/1.13.5
Date: Mon, 02 Oct 2017 01:04:20 GMT
Content-Type: text/html
Content-Length: 612
Last-Modified: Tue, 08 Aug 2017 15:25:00 GMT
Connection: keep-alive
ETag: "5989d7cc-264"
Accept-Ranges: bytes
```

回到前面的终端并按下 `Ctrl + C` 停止 port forwarding 命令：

```sh
Forwarding from 127.0.0.1:8080 -> 80
Forwarding from [::1]:8080 -> 80
Handling connection for 8080
^C
```

### 容器日志

本节会验证 [获取容器日志](https://kubernetes.io/docs/concepts/cluster-administration/logging/) 的功能。

输出 nginx Pod 的容器日志：

```sh
kubectl logs $POD_NAME
```

输出为

```sh
127.0.0.1 - - [02/Oct/2017:01:04:20 +0000] "HEAD / HTTP/1.1" 200 0 "-" "curl/7.54.0" "-"
```

### 执行容器命令

本节将验证 [在容器里执行命令](https://kubernetes.io/docs/tasks/debug-application-cluster/get-shell-running-container/#running-individual-commands-in-a-container) 的功能。

使用 `nginx -v` 命令在 `nginx` Pod 中输出 nginx 的版本：

```sh
kubectl exec -ti $POD_NAME -- nginx -v
```

输出为

```sh
nginx version: nginx/1.13.7
```

## 服务（Service）

本节将验证 Kubernetes [Service](https://kubernetes.io/docs/concepts/services-networking/service/)。

将 `nginx` 部署导出为 [NodePort](https://kubernetes.io/docs/concepts/services-networking/service/#type-nodeport) 类型的 Service：

```sh
kubectl expose deployment nginx --port 80 --type NodePort
```

> LoadBalancer 类型的 Service 不能使用是因为没有设置 [cloud provider 集成](https://kubernetes.io/docs/getting-started-guides/scratch/#cloud-provider)。 设定 cloud provider 不在本教程范围之内。

查询 `nginx` 服务分配的 Node Port：

```sh
NODE_PORT=$(kubectl get svc nginx \
  --output=jsonpath='{range .spec.ports[0]}{.nodePort}')
```

建立防火墙规则允许外网访问该 Node 端口：

```sh
gcloud compute firewall-rules create kubernetes-the-hard-way-allow-nginx-service \
  --allow=tcp:${NODE_PORT} \
  --network kubernetes-the-hard-way
```

查询 worker 节点的外网 IP 地址：

```sh
EXTERNAL_IP=$(gcloud compute instances describe worker-0 \
  --format 'value(networkInterfaces[0].accessConfigs[0].natIP)')
```

对得到的外网 IP 地址 + nginx 服务的 Node Port 做 HTTP 请求测试：

```sh
curl -I http://${EXTERNAL_IP}:${NODE_PORT}
```

输出为


```sh
HTTP/1.1 200 OK
Server: nginx/1.13.7
Date: Mon, 18 Dec 2017 14:52:09 GMT
Content-Type: text/html
Content-Length: 612
Last-Modified: Tue, 21 Nov 2017 14:28:04 GMT
Connection: keep-alive
ETag: "5a1437f4-264"
Accept-Ranges: bytes
```

下一步：[删除集群](14-cleanup.md)。
