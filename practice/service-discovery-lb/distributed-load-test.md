## 分佈式負載測試

該教程描述如何在[Kubernetes](http://kubernetes.io)中進行分佈式負載均衡測試，包括一個web應用、docker鏡像和Kubernetes controllers/services。更多資料請查看[Distributed Load Testing Using Kubernetes](http://cloud.google.com/solutions/distributed-load-testing-using-kubernetes) 。

## 準備

**不需要GCE及其他組件，你只需要有一個kubernetes集群即可。**

如果你還沒有kubernetes集群，可以參考[kubernetes-handbook](https://www.gitbook.com/book/feisky/kubernetes)部署一個。

## 部署Web應用

 `sample-webapp` 目錄下包含一個簡單的web測試應用。我們將其構建為docker鏡像，在kubernetes中運行。你可以自己構建，也可以直接用這個我構建好的鏡像`index.tenxcloud.com/jimmy/k8s-sample-webapp:latest`。

在kubernetes上部署sample-webapp。

```bash
$ cd kubernetes-config
$ kubectl create -f sample-webapp-controller.yaml
$ kubectl create -f sample-webapp-service.yaml
```

## 部署Locust的Controller和Service

`locust-master`和`locust-work`使用同樣的docker鏡像，修改controller中`spec.template.spec.containers.env`字段中的value為你`sample-webapp` service的名字。

    - name: TARGET_HOST
      value: http://sample-webapp:8000

### 創建Controller Docker鏡像（可選）

`locust-master`和`locust-work` controller使用的都是`locust-tasks` docker鏡像。你可以直接下載`gcr.io/cloud-solutions-images/locust-tasks`，也可以自己編譯。自己編譯大概要花幾分鐘時間，鏡像大小為820M。

    $ docker build -t index.tenxcloud.com/jimmy/locust-tasks:latest .
    $ docker push index.tenxcloud.com/jimmy/locust-tasks:latest

**注意**：我使用的是時速雲的鏡像倉庫。

每個controller的yaml的`spec.template.spec.containers.image` 字段指定的是我的鏡像：

    image: index.tenxcloud.com/jimmy/locust-tasks:latest
### 部署locust-master

```bash
$ kubectl create -f locust-master-controller.yaml
$ kubectl create -f locust-master-service.yaml
```

### 部署locust-worker

Now deploy `locust-worker-controller`:

```bash
$ kubectl create -f locust-worker-controller.yaml
```
你可以很輕易的給work擴容，通過命令行方式：

```bash
$ kubectl scale --replicas=20 replicationcontrollers locust-worker
```
當然你也可以通過WebUI：Dashboard - Workloads - Replication Controllers - **ServiceName** - Scale來擴容。

![dashboard-scale](images/dashbaord-scale.jpg)

### 配置Traefik

參考[kubernetes的traefik ingress安裝](https://github.com/feiskyer/kubernetes-handbook/blob/master/practice/service-discovery-lb/traefik-ingress-installation.md)，在`ingress.yaml`中加入如下配置：

```Yaml
  - host: traefik.locust.io
    http:
      paths:
      - path: /
        backend:
          serviceName: locust-master
          servicePort: 8089
```

然後執行`kubectl replace -f ingress.yaml`即可更新traefik。

通過Traefik的dashboard就可以看到剛增加的`traefik.locust.io`節點。

![traefik-dashboard-locust](images/traefik-dashboard-locust.jpg)

## 執行測試

打開`http://traefik.locust.io`頁面，點擊`Edit`輸入偽造的用戶數和用戶每秒發送的請求個數，點擊`Start Swarming`就可以開始測試了。

![locust-start-swarming](images/locust-start-swarming.jpg)

在測試過程中調整`sample-webapp`的pod個數（默認設置了1個pod），觀察pod的負載變化情況。

![sample-webapp-rc](images/sample-webapp-rc.jpg)

從一段時間的觀察中可以看到負載被平均分配給了3個pod。

在locust的頁面中可以實時觀察也可以下載測試結果。

![locust-dashboard](images/locust-dashboard.jpg)

