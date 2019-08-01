# GlusterFS 持久化存儲

我們複用 kubernetes 的三臺主機做 GlusterFS 存儲。

## 安裝 GlusterFS

我們直接在物理機上使用 yum 安裝，如果你選擇在 kubernetes 上安裝，請參考 <https://github.com/gluster/gluster-kubernetes/blob/master/docs/setup-guide.md>。

```bash
# 先安裝 gluster 源
$ yum install centos-release-gluster -y

# 安裝 glusterfs 組件
$ yum install -y glusterfs glusterfs-server glusterfs-fuse glusterfs-rdma glusterfs-geo-replication glusterfs-devel

## 創建 glusterfs 目錄
$ mkdir /opt/glusterd

## 修改 glusterd 目錄
$ sed -i 's/var\/lib/opt/g' /etc/glusterfs/glusterd.vol

# 啟動 glusterfs
$ systemctl start glusterd.service

# 設置開機啟動
$ systemctl enable glusterd.service

#查看狀態
$ systemctl status glusterd.service
```

## 配置 GlusterFS

```Bash
# 配置 hosts

$ vi /etc/hosts
172.20.0.113   sz-pg-oam-docker-test-001.tendcloud.com
172.20.0.114   sz-pg-oam-docker-test-002.tendcloud.com
172.20.0.115   sz-pg-oam-docker-test-003.tendcloud.com
```

```bash
# 開放端口
$ iptables -I INPUT -p tcp --dport 24007 -j ACCEPT

# 創建存儲目錄
$ mkdir /opt/gfs_data
```

```bash
# 添加節點到 集群
# 執行操作的本機不需要 probe 本機
[root@sz-pg-oam-docker-test-001 ~]#
gluster peer probe sz-pg-oam-docker-test-002.tendcloud.com
gluster peer probe sz-pg-oam-docker-test-003.tendcloud.com

# 查看集群狀態
$ gluster peer status
Number of Peers: 2

Hostname: sz-pg-oam-docker-test-002.tendcloud.com
Uuid: f25546cc-2011-457d-ba24-342554b51317
State: Peer in Cluster (Connected)

Hostname: sz-pg-oam-docker-test-003.tendcloud.com
Uuid: 42b6cad1-aa01-46d0-bbba-f7ec6821d66d
State: Peer in Cluster (Connected)
```

## 配置 volume

GlusterFS 中的 volume 的模式有很多種，包括以下幾種：

- **分佈卷(默認模式)**：即 DHT, 也叫 分佈卷: 將文件以 hash 算法隨機分佈到 一臺服務器節點中存儲。
- **複製模式**：即 AFR, 創建 volume 時帶 replica x 數量: 將文件複製到 replica x 個節點中。
- **條帶模式**：即 Striped, 創建 volume 時帶 stripe x 數量： 將文件切割成數據塊，分別存儲到 stripe x 個節點中 (類似 raid 0)。
- **分佈式條帶模式**：最少需要 4 臺服務器才能創建。 創建 volume 時 stripe 2 server = 4 個節點： 是 DHT 與 Striped 的組合型。
- **分佈式複製模式**：最少需要 4 臺服務器才能創建。 創建 volume 時 replica 2 server = 4 個節點：是 DHT 與 AFR 的組合型。
- **條帶複製卷模式**：最少需要 4 臺服務器才能創建。 創建 volume 時 stripe 2 replica 2 server = 4 個節點： 是 Striped 與 AFR 的組合型。
- **三種模式混合**： 至少需要 8 臺 服務器才能創建。 stripe 2 replica 2 , 每 4 個節點 組成一個 組。

這幾種模式的示例圖參考 [GlusterFS Documentation](https://docs.gluster.org/en/latest/Quick-Start-Guide/Architecture/#types-of-volumes)。

因為我們只有三臺主機，在此我們使用默認的**分佈卷模式**。**請勿在生產環境上使用該模式，容易導致數據丟失。**

```bash
# 創建分佈卷
$ gluster volume create k8s-volume transport tcp sz-pg-oam-docker-test-001.tendcloud.com:/opt/gfs_data sz-pg-oam-docker-test-002.tendcloud.com:/opt/gfs_data sz-pg-oam-docker-test-003.tendcloud.com:/opt/gfs_data force

# 查看 volume 狀態
$ gluster volume info
Volume Name: k8s-volume
Type: Distribute
Volume ID: 9a3b0710-4565-4eb7-abae-1d5c8ed625ac
Status: Created
Snapshot Count: 0
Number of Bricks: 3
Transport-type: tcp
Bricks:
Brick1: sz-pg-oam-docker-test-001.tendcloud.com:/opt/gfs_data
Brick2: sz-pg-oam-docker-test-002.tendcloud.com:/opt/gfs_data
Brick3: sz-pg-oam-docker-test-003.tendcloud.com:/opt/gfs_data
Options Reconfigured:
transport.address-family: inet
nfs.disable: on

# 啟動 分佈卷
$ gluster volume start k8s-volume
```

## Glusterfs 調優

```bash
# 開啟 指定 volume 的配額
$ gluster volume quota k8s-volume enable

# 限制 指定 volume 的配額
$ gluster volume quota k8s-volume limit-usage / 1TB

# 設置 cache 大小, 默認 32MB
$ gluster volume set k8s-volume performance.cache-size 4GB

# 設置 io 線程, 太大會導致進程崩潰
$ gluster volume set k8s-volume performance.io-thread-count 16

# 設置 網絡檢測時間, 默認 42s
$ gluster volume set k8s-volume network.ping-timeout 10

# 設置 寫緩衝區的大小, 默認 1M
$ gluster volume set k8s-volume performance.write-behind-window-size 1024MB
```

## Kubernetes 中使用 GlusterFS

官方的文檔見<https://github.com/kubernetes/examples/tree/master/staging/volumes/glusterfs>.

以下用到的所有 yaml 和 json 配置文件可以在 [glusterfs](https://github.com/feiskyer/kubernetes-handbook/tree/master/manifests/glusterfs) 中找到。注意替換其中私有鏡像地址為你自己的鏡像地址。


## kubernetes 安裝客戶端

```bash
# 在所有 k8s node 中安裝 glusterfs 客戶端
$ yum install -y glusterfs glusterfs-fuse

# 配置 hosts
$ vi /etc/hosts
172.20.0.113   sz-pg-oam-docker-test-001.tendcloud.com
172.20.0.114   sz-pg-oam-docker-test-002.tendcloud.com
172.20.0.115   sz-pg-oam-docker-test-003.tendcloud.com
```

因為我們 glusterfs 跟 kubernetes 集群複用主機，因為此這一步可以省去。

## 配置 endpoints

```bash
$ curl -O https://raw.githubusercontent.com/kubernetes/kubernetes/master/examples/volumes/glusterfs/glusterfs-endpoints.json

# 修改 endpoints.json ，配置 glusters 集群節點 ip
# 每一個 addresses 為一個 ip 組

    {
      "addresses": [
        {
          "ip": "172.22.0.113"
        }
      ],
      "ports": [
        {
          "port": 1990
        }
      ]
    },

# 導入 glusterfs-endpoints.json

$ kubectl apply -f glusterfs-endpoints.json

# 查看 endpoints 信息
$ kubectl get ep
```

## 配置 service

```bash
$ curl -O https://raw.githubusercontent.com/kubernetes/kubernetes/master/examples/volumes/glusterfs/glusterfs-service.json

# service.json 裡面查找的是 enpointes 的名稱與端口，端口默認配置為 1，我改成了 1990

# 導入 glusterfs-service.json
$ kubectl apply -f glusterfs-service.json

# 查看 service 信息
$ kubectl get svc
```

## 創建測試 pod

```bash
$ curl -O https://github.com/kubernetes/examples/raw/master/staging/volumes/glusterfs/glusterfs-pod.json

# 編輯 glusterfs-pod.json
# 修改 volumes  下的 path 為上面創建的 volume 名稱

"path": "k8s-volume"

# 導入 glusterfs-pod.json
$ kubectl apply -f glusterfs-pod.json

# 查看 pods 狀態
$ kubectl get pods
NAME                             READY     STATUS    RESTARTS   AGE
glusterfs                        1/1       Running   0          1m

# 查看 pods 所在 node
$ kubectl describe pods/glusterfs

# 登陸 node 物理機，使用 df 可查看掛載目錄
$ df -h
172.20.0.113:k8s-volume  1.0T     0  1.0T   0% /var/lib/kubelet/pods/3de9fc69-30b7-11e7-bfbd-8af1e3a7c5bd/volumes/kubernetes.io~glusterfs/glusterfsvol
```

## 配置 PersistentVolume

PersistentVolume（PV）和 PersistentVolumeClaim（PVC）是 kubernetes 提供的兩種 API 資源，用於抽象存儲細節。管理員關注於如何通過 pv 提供存儲功能而無需關注用戶如何使用，同樣的用戶只需要掛載 PVC 到容器中而不需要關注存儲卷採用何種技術實現。PVC 和 PV 的關係跟 pod 和 node 關係類似，前者消耗後者的資源。PVC 可以向 PV 申請指定大小的存儲資源並設置訪問模式。

**PV 屬性 **

- storage 容量
- 讀寫屬性：分別為
  - ReadWriteOnce：單個節點讀寫；
  - ReadOnlyMany：多節點只讀 ；
  - ReadWriteMany：多節點讀寫

```bash
$ cat glusterfs-pv.yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: gluster-dev-volume
spec:
  capacity:
    storage: 8Gi
  accessModes:
    - ReadWriteMany
  glusterfs:
    endpoints: "glusterfs-cluster"
    path: "k8s-volume"
    readOnly: false

# 導入 PV
$ kubectl apply -f glusterfs-pv.yaml

# 查看 pv
$ kubectl get pv
NAME                 CAPACITY   ACCESSMODES   RECLAIMPOLICY   STATUS      CLAIM     STORAGECLASS   REASON    AGE
gluster-dev-volume   8Gi        RWX           Retain          Available                                      3s
```

PVC 屬性

- 訪問屬性與 PV 相同
- 容量：向 PV 申請的容量 <= PV 總容量

## 配置 PVC

```Bash
$ cat glusterfs-pvc.yaml
kind: PersistentVolumeClaim
apiVersion: v1
metadata:
  name: glusterfs-nginx
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 8Gi

# 導入 pvc
$ kubectl apply -f glusterfs-pvc.yaml

# 查看 pvc

$ kubectl get pv
NAME              STATUS    VOLUME               CAPACITY   ACCESSMODES   STORAGECLASS   AGE
glusterfs-nginx   Bound     gluster-dev-volume   8Gi        RWX                          4s
```

## 創建 nginx deployment 掛載 volume

```Bash
$ vi nginx-deployment.yaml
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: nginx-dm
spec:
  replicas: 2
  template:
    metadata:
      labels:
        name: nginx
    spec:
      containers:
        - name: nginx
          image: nginx:alpine
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 80
          volumeMounts:
            - name: gluster-dev-volume
              mountPath: "/usr/share/nginx/html"
      volumes:
      - name: gluster-dev-volume
        persistentVolumeClaim:
          claimName: glusterfs-nginx

# 導入 deployment
$ kubectl apply -f nginx-deployment.yaml

# 查看 deployment
$ kubectl get pods |grep nginx-dm
nginx-dm-3698525684-g0mvt       1/1       Running   0          6s
nginx-dm-3698525684-hbzq1       1/1       Running   0          6s

# 查看 掛載
$ kubectl exec -it nginx-dm-3698525684-g0mvt -- df -h|grep k8s-volume
172.20.0.113:k8s-volume         1.0T     0  1.0T   0% /usr/share/nginx/html

# 創建文件 測試
$ kubectl exec -it nginx-dm-3698525684-g0mvt -- touch /usr/share/nginx/html/index.html

$ kubectl exec -it nginx-dm-3698525684-g0mvt -- ls -lt /usr/share/nginx/html/index.html
-rw-r--r-- 1 root root 0 May  4 11:36 /usr/share/nginx/html/index.html

# 驗證 glusterfs
# 因為我們使用分佈卷，所以可以看到某個節點中有文件
[root@sz-pg-oam-docker-test-001 ~] ls /opt/gfs_data/
[root@sz-pg-oam-docker-test-002 ~] ls /opt/gfs_data/
index.html
[root@sz-pg-oam-docker-test-003 ~] ls /opt/gfs_data/
```

## 參考

- [CentOS 7 安裝 GlusterFS](http://www.cnblogs.com/jicki/p/5801712.html)
- <https://github.com/gluster/gluster-kubernetes>
