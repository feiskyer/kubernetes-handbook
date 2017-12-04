
# 烟雾测试

在本次实验中你将会完成全部的教学实验并确认Kubernetes群集的功能正确性

## 资料加密

在这个部份你将会验证 [encrypt secret data at rest](https://kubernetes.io/docs/tasks/administer-cluster/encrypt-data/#verifying-that-data-is-encrypted)的功能

建立一个Secret:

```
kubectl create secret generic kubernetes-the-hard-way \
  --from-literal="mykey=mydata"
```

印出存在etcd里 16进位编码的 `kubernetes-the-hard-way` secret:

```
gcloud compute ssh controller-0 \
  --command "ETCDCTL_API=3 etcdctl get /registry/secrets/default/kubernetes-the-hard-way | hexdump -C"
```

> 输出为

```
00000000  2f 72 65 67 69 73 74 72  79 2f 73 65 63 72 65 74  |/registry/secret|
00000010  73 2f 64 65 66 61 75 6c  74 2f 6b 75 62 65 72 6e  |s/default/kubern|
00000020  65 74 65 73 2d 74 68 65  2d 68 61 72 64 2d 77 61  |etes-the-hard-wa|
00000030  79 0a 6b 38 73 3a 65 6e  63 3a 61 65 73 63 62 63  |y.k8s:enc:aescbc|
00000040  3a 76 31 3a 6b 65 79 31  3a 70 88 d8 52 83 b7 96  |:v1:key1:p..R...|
00000050  04 a3 bd 7e 42 9e 8a 77  2f 97 24 a7 68 3f c5 ec  |...~B..w/.$.h?..|
00000060  9e f7 66 e8 a3 81 fc c8  3c df 63 71 33 0a 87 8f  |..f.....<.cq3...|
00000070  0e c7 0a 0a f2 04 46 85  33 92 9a 4b 61 b2 10 c0  |......F.3..Ka...|
00000080  0b 00 05 dd c3 c2 d0 6b  ff ff f2 32 3b e0 ec a0  |.......k...2;...|
00000090  63 d3 8b 1c 29 84 88 71  a7 88 e2 26 4b 65 95 14  |c...)..q...&Ke..|
000000a0  dc 8d 59 63 11 e5 f3 4e  b4 94 cc 3d 75 52 c7 07  |..Yc...N...=uR..|
000000b0  73 f5 b4 b0 63 aa f9 9d  29 f8 d6 88 aa 33 c4 24  |s...c...)....3.$|
000000c0  ac c6 71 2b 45 98 9e 5f  c6 a4 9d a2 26 3c 24 41  |..q+E.._....&<$A|
000000d0  95 5b d3 2c 4b 1e 4a 47  c8 47 c8 f3 ac d6 e8 cb  |.[.,K.JG.G......|
000000e0  5f a9 09 93 91 d7 5d c9  c2 68 f8 cf 3c 7e 3b a3  |_.....]..h..<~;.|
000000f0  db d8 d5 9e 0c bf 2a 2f  58 0a                    |......*/X.|
000000fa
```

etcd 的密钥应该要用`k8s:enc:aescbc:v1:key1`做前缀, 表示使用`aescbc`加密资料, 密钥为`key1`。

## 部属

在这步骤你将会验证建立与管理[Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)的功能。

建立一个deployment 用来搭建[nginx](https://nginx.org/en/) web server:

```
kubectl run nginx --image=nginx
```

列出`nginx` deployment的 pods:

```
kubectl get pods -l run=nginx
```
> 输出为


```
NAME                     READY     STATUS    RESTARTS   AGE
nginx-4217019353-b5gzn   1/1       Running   0          15s
```


### Port Forwarding

在这步骤你将会验证从远端进入应用程式的功能, 使用[port forwarding](https://kubernetes.io/docs/tasks/access-application-cluster/port-forward-access-application-cluster/)

取得`nginx` pod 的全名:

```
POD_NAME=$(kubectl get pods -l run=nginx -o jsonpath="{.items[0].metadata.name}")
```
设定在你本地端主机上的`8080` port 到`nginx` pod的 `80` port


```
kubectl port-forward $POD_NAME 8080:80
```


> 输出为

```
Forwarding from 127.0.0.1:8080 -> 80
Forwarding from [::1]:8080 -> 80
```

开一个终端机来做HTTP 请求测试:

```
curl --head http://127.0.0.1:8080
```

> 输出为


```
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

回到前面设定的终端机并停止port forwarding的功能:


```
Forwarding from 127.0.0.1:8080 -> 80
Forwarding from [::1]:8080 -> 80
Handling connection for 8080
^C
```


### Logs

在这步骤你将会验证 [取得 container logs](https://kubernetes.io/docs/concepts/cluster-administration/logging/)的功能

印出`nginx` pod log:


```
kubectl logs $POD_NAME
```

> 输出为


```
127.0.0.1 - - [02/Oct/2017:01:04:20 +0000] "HEAD / HTTP/1.1" 200 0 "-" "curl/7.54.0" "-"
```

### Exec

在这个步骤你将验证[在container里执行指令](https://kubernetes.io/docs/tasks/debug-application-cluster/get-shell-running-container/#running-individual-commands-in-a-container)

印出nginx的版本使用`nginx -v`指令在`nginx` container里:


```
kubectl exec -ti $POD_NAME -- nginx -v
```


> 输出为

```
nginx version: nginx/1.13.5
```



## Services
在这个步骤你将验证服务是否对外开启使用[Service](https://kubernetes.io/docs/concepts/services-networking/service/)

暴露`nginx`deployment 的服务使用[NodePort](https://kubernetes.io/docs/concepts/services-networking/service/#type-nodeport) service:


```
kubectl expose deployment nginx --port 80 --type NodePort
```

> LoadBalancer service type 不能使用是因为没有设置[cloud provider integration](https://kubernetes.io/docs/getting-started-guides/scratch/#cloud-provider)。 设定cloud provider integration 超出本教学范围

取得`nginx` service所设定的node port:
```
NODE_PORT=$(kubectl get svc nginx \
  --output=jsonpath='{range .spec.ports[0]}{.nodePort}')
```
建立防火墙规则让`nginx` node port可以被存取:

```
gcloud compute firewall-rules create kubernetes-the-hard-way-allow-nginx-service \
  --allow=tcp:${NODE_PORT} \
  --network kubernetes-the-hard-way
```

取得worker 节点的外部IP address :

```
EXTERNAL_IP=$(gcloud compute instances describe worker-0 \
  --format 'value(networkInterfaces[0].accessConfigs[0].natIP)')
```


对外部IP address 的`nginx` node port, 做HTTP 请求测试


```
curl -I http://${EXTERNAL_IP}:${NODE_PORT}
```

> 输出为


```
HTTP/1.1 200 OK
Server: nginx/1.13.5
Date: Mon, 02 Oct 2017 01:06:11 GMT
Content-Type: text/html
Content-Length: 612
Last-Modified: Tue, 08 Aug 2017 15:25:00 GMT
Connection: keep-alive
ETag: "5989d7cc-264"
Accept-Ranges: bytes
```


Next: [移除](14-cleanup.md)
