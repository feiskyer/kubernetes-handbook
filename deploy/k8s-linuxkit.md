# 利用 LinuxKit 部署 Kubernetes 集群
LinuxKit 是以 Container 來建立最小、不可變的 Linux 系統框架，可以參考 [LinuxKit](https://github.com/linuxkit/linuxkit) 簡單介紹。本著則將利用 LinuxKit 來建立 Kubernetes 的映像檔，並部署簡單的 Kubernetes 集群。

![](images/moby+kubernetes.png)


本著教學會在 `Mac OS X` 系統上進行，部署的環境資訊如下：
* Kubernetes v1.7.2
* Etcd v3
* Weave
* Docker v17.06.0-ce

## 預先準備資訊

* 主機已安裝與啟動 `Docker` 工具。
* 主機已安裝 `Git` 工具。
* 主機以下載 LinuxKit 項目，並建構了 Moby 與 LinuxKit 工具。

建構 Moby 與 LinuxKit 方法如以下操作：
```sh
$ git clone https://github.com/linuxkit/linuxkit.git
$ cd linuxkit
$ make
$ ./bin/moby version
moby version 0.0
commit: c2b081ed8a9f690820cc0c0568238e641848f58f

$ ./bin/linuxkit version
linuxkit version 0.0
commit: 0e3ca695d07d1c9870eca71fb7dd9ede31a38380
```

## 建構 Kubernetes 系統映像檔
首先要建立一個打包好 Kubernetes 的 Linux 系統，而官方已經有做好範例，利用以下方式即可建構：
```sh
$ cd linuxkit/projects/kubernetes/
$ make build-vm-images
...
Create outputs:
  kube-node-kernel kube-node-initrd.img kube-node-cmdline
```

## 部署 Kubernetes cluster
完成建構映像檔後，就可以透過以下指令來啟動 Master OS，然後獲取節點 IP：
```sh
$ ./boot.sh

(ns: getty) linuxkit-025000000002:~\# ip addr show dev eth0
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP qlen 1000
    link/ether 02:50:00:00:00:02 brd ff:ff:ff:ff:ff:ff
    inet 192.168.65.3/24 brd 192.168.65.255 scope global eth0
       valid_lft forever preferred_lft forever
    inet6 fe80::abf0:9fa4:d0f4:8da2/64 scope link
       valid_lft forever preferred_lft forever
```

啟動後，開啟新的 Console 來 SSH 進入 Master，來利用 kubeadm 初始化 Master：
```sh
$ cd linuxkit/projects/kubernetes/
$ ./ssh_into_kubelet.sh 192.168.65.3
linuxkit-025000000002:/\# kubeadm-init.sh
...
kubeadm join --token 4236d3.29f61af661c49dbf 192.168.65.3:6443
```

一旦 kubeadm 完成後，就會看到 Token，這時請記住 Token 資訊。接著開啟新 Console，然後執行以下指令來啟動 Node：
```sh
console1>$ ./boot.sh 1 --token 4236d3.29f61af661c49dbf 192.168.65.3:6443
```
> P.S. 開啟節點格式為 `./boot.sh <n> [<join_args> ...]`。

接著分別在開兩個 Console 來加入集群：
```sh
console2> $ ./boot.sh 2 --token 4236d3.29f61af661c49dbf 192.168.65.3:6443
console3> $ ./boot.sh 3 --token 4236d3.29f61af661c49dbf 192.168.65.3:6443
```

完成後回到 Master 節點上，執行以下指令來查看節點狀況：
```sh
$ kubectl get no
NAME                    STATUS    AGE       VERSION
linuxkit-025000000002   Ready     16m       v1.7.2
linuxkit-025000000003   Ready     6m        v1.7.2
linuxkit-025000000004   Ready     1m        v1.7.2
linuxkit-025000000005   Ready     1m        v1.7.2
```

## 簡單部署 Nginx 服務
Kubernetes 可以選擇使用指令直接建立應用程式與服務，或者撰寫 YAML 與 JSON 檔案來描述部署應用的配置，以下將建立一個簡單的 Nginx 服務：
```sh
$ kubectl run nginx --image=nginx --replicas=1 --port=80
$ kubectl get pods -o wide
NAME                     READY     STATUS    RESTARTS   AGE       IP          NODE
nginx-1423793266-v0hpb   1/1       Running   0          38s       10.42.0.1   linuxkit-025000000004
```

完成後要接著建立 svc(Service)，來提供外部網絡存取應用：
```sh
$ kubectl expose deploy nginx --port=80 --type=NodePort
$ kubectl get svc
NAME         CLUSTER-IP      EXTERNAL-IP   PORT(S)        AGE
kubernetes   10.96.0.1       <none>        443/TCP        19m
nginx        10.108.41.230   <nodes>       80:31773/TCP   5s
```

由於不是使用物理機器部署，因此網絡使用 Docker namespace 網絡，故需透過 `ubuntu-desktop-lxde-vnc` 來瀏覽 Nginx 應用：
```sh
$ docker run -it --rm -p 6080:80 dorowu/ubuntu-desktop-lxde-vnc
```
> 完成後透過瀏覽器連接 [HTML VNC](localhost:6080)。

![](images/docker-desktop.png)

最後關閉節點只需要執行以下即可：
```sh
$ halt
[1503.034689] reboot: Power down
```
