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
  --command "sudo ETCDCTL_API=3 etcdctl get \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/etcd/ca.pem \
  --cert=/etc/etcd/kubernetes.pem \
  --key=/etc/etcd/kubernetes-key.pem\
  /registry/secrets/default/kubernetes-the-hard-way | hexdump -C"
```

输出为

```sh
00000000  2f 72 65 67 69 73 74 72  79 2f 73 65 63 72 65 74  |/registry/secret|
00000010  73 2f 64 65 66 61 75 6c  74 2f 6b 75 62 65 72 6e  |s/default/kubern|
00000020  65 74 65 73 2d 74 68 65  2d 68 61 72 64 2d 77 61  |etes-the-hard-wa|
00000030  79 0a 6b 38 73 3a 65 6e  63 3a 61 65 73 63 62 63  |y.k8s:enc:aescbc|
00000040  3a 76 31 3a 6b 65 79 31  3a 8c 7b 16 f3 26 59 d5  |:v1:key1:.{..&Y.|
00000050  c9 65 1c f0 3a 04 e7 66  2a f6 50 93 4e d4 d7 8c  |.e..:..f*.P.N...|
00000060  ca 24 ab 68 54 5f 31 f6  5c e5 5c c6 29 1d cc da  |.$.hT_1.\.\.)...|
00000070  22 fc c9 be 23 8a 26 b4  9b 38 1d 57 65 87 2a ac  |"...#.&..8.We.*.|
00000080  70 11 ea 06 93 b7 de ba  12 83 42 94 9d 27 8f ee  |p.........B..'..|
00000090  95 05 b0 77 31 ab 66 3d  d9 e2 38 85 f9 a5 59 3a  |...w1.f=..8...Y:|
000000a0  90 c1 46 ae b4 9d 13 05  82 58 71 4e 5b cb ac e2  |..F......XqN[...|
000000b0  3b 6e d7 10 ab 7c fc fe  dd f0 e6 0a 7b 24 2e 68  |;n...|......{$.h|
000000c0  5e 78 98 5f 33 40 f8 d2  10 30 1f de 17 3f 06 a1  |^x._3@...0...?..|
000000d0  81 bd 1f 2e be e9 35 26  2c be 39 16 cf ac c2 6d  |......5&,.9....m|
000000e0  32 56 05 7d 80 39 5d c0  a4 43 46 75 96 0c 87 49  |2V.}.9]..CFu...I|
000000f0  3c 17 1a 1c 8e 52 b1 e8  42 6b a5 e8 b2 b3 27 bc  |<....R..Bk....'.|
00000100  80 a6 53 2a 9f 57 d2 de  a3 f8 7f 84 2c 01 c9 d9  |..S*.W......,...|
00000110  4f e0 3f e7 a7 1e 46 b7  47 dc f0 53 d2 d2 e1 99  |O.?...F.G..S....|
00000120  0b b7 b3 49 d0 3c a5 e8  26 ce 2c 51 42 2c 0f 48  |...I.<..&.,QB,.H|
00000130  b1 9a 1a dd 24 d1 06 d8  34 bf 09 2e 20 cc 3d 3d  |....$...4... .==|
00000140  e2 5a e5 e4 44 b7 ae 57  49 0a                    |.Z..D..WI.|
```

Etcd 的密钥以 `k8s:enc:aescbc:v1:key1` 为前缀, 表示使用密钥为 `key1` 的 `aescbc` 加密数据。

## 部署

本节将会验证建立与管理 [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) 的功能。

创建一个 Deployment 用来搭建 [nginx](https://nginx.org/en/) Web 服务：

```sh
kubectl create deployment nginx --image=nginx
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

> LoadBalancer 类型的 Service 不能使用是因为没有设置 [cloud provider 集成](https://kubernetes.io/docs/setup/#production-environment)。 设定 cloud provider 不在本教程范围之内。

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
