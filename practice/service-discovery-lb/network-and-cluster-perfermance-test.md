# Kubernetes網絡和集群性能測試

## 準備

**測試環境**

在以下幾種環境下進行測試：

- Kubernetes集群node節點上通過Cluster IP方式訪問
- Kubernetes集群內部通過service訪問
- Kubernetes集群外部通過traefik ingress暴露的地址訪問

**測試地址**

Cluster IP: 10.254.149.31

Service Port：8000

Ingress Host：traefik.sample-webapp.io

**測試工具**

- [Locust](http://locust.io)：一個簡單易用的用戶負載測試工具，用來測試web或其他系統能夠同時處理的併發用戶數。
- curl
- [kubemark](https://github.com/kubernetes/kubernetes/tree/master/test/e2e)
- 測試程序：sample-webapp，源碼見Github [kubernetes的分佈式負載測試](https://github.com/feiskyer/kubernetes-handbook/blob/master/practice/service-discovery-lb/distributed-load-test.md)

**測試說明**

通過向`sample-webapp`發送curl請求獲取響應時間，直接curl後的結果為：

```Bash
$ curl "http://10.254.149.31:8000/"
Welcome to the "Distributed Load Testing Using Kubernetes" sample web app
```

## 網絡延遲測試

### 場景一、 Kubernetes集群node節點上通過Cluster IP訪問

**測試命令**

```shell
curl -o /dev/null -s -w '%{time_connect} %{time_starttransfer} %{time_total}' "http://10.254.149.31:8000/"
```

**10組測試結果**

| No   | time_connect | time_starttransfer | time_total |
| ---- | ------------ | ------------------ | ---------- |
| 1    | 0.000        | 0.003              | 0.003      |
| 2    | 0.000        | 0.002              | 0.002      |
| 3    | 0.000        | 0.002              | 0.002      |
| 4    | 0.000        | 0.002              | 0.002      |
| 5    | 0.000        | 0.002              | 0.002      |
| 6    | 0.000        | 0.002              | 0.002      |
| 7    | 0.000        | 0.002              | 0.002      |
| 8    | 0.000        | 0.002              | 0.002      |
| 9    | 0.000        | 0.002              | 0.002      |
| 10   | 0.000        | 0.002              | 0.002      |

**平均響應時間：2ms**

**時間指標說明**

單位：秒

time_connect：建立到服務器的 TCP 連接所用的時間

time_starttransfer：在發出請求之後，Web 服務器返回數據的第一個字節所用的時間

time_total：完成請求所用的時間

### 場景二、Kubernetes集群內部通過service訪問

**測試命令**

```Shell
curl -o /dev/null -s -w '%{time_connect} %{time_starttransfer} %{time_total}' "http://sample-webapp:8000/"
```

**10組測試結果**

| No   | time_connect | time_starttransfer | time_total |
| ---- | ------------ | ------------------ | ---------- |
| 1    | 0.004        | 0.006              | 0.006      |
| 2    | 0.004        | 0.006              | 0.006      |
| 3    | 0.004        | 0.006              | 0.006      |
| 4    | 0.004        | 0.006              | 0.006      |
| 5    | 0.004        | 0.006              | 0.006      |
| 6    | 0.004        | 0.006              | 0.006      |
| 7    | 0.004        | 0.006              | 0.006      |
| 8    | 0.004        | 0.006              | 0.006      |
| 9    | 0.004        | 0.006              | 0.006      |
| 10   | 0.004        | 0.006              | 0.006      |

**平均響應時間：6ms**

### 場景三、在公網上通過traefik ingress訪問

**測試命令**

```Shell
curl -o /dev/null -s -w '%{time_connect} %{time_starttransfer} %{time_total}' "http://traefik.sample-webapp.io" >>result
```

**10組測試結果**

| No   | time_connect | time_starttransfer | time_total |
| ---- | ------------ | ------------------ | ---------- |
| 1    | 0.043        | 0.085              | 0.085      |
| 2    | 0.052        | 0.093              | 0.093      |
| 3    | 0.043        | 0.082              | 0.082      |
| 4    | 0.051        | 0.093              | 0.093      |
| 5    | 0.068        | 0.188              | 0.188      |
| 6    | 0.049        | 0.089              | 0.089      |
| 7    | 0.051        | 0.113              | 0.113      |
| 8    | 0.055        | 0.120              | 0.120      |
| 9    | 0.065        | 0.126              | 0.127      |
| 10   | 0.050        | 0.111              | 0.111      |

**平均響應時間：110ms**

### 測試結果

在這三種場景下的響應時間測試結果如下：

- Kubernetes集群node節點上通過Cluster IP方式訪問：2ms
- Kubernetes集群內部通過service訪問：6ms
- Kubernetes集群外部通過traefik ingress暴露的地址訪問：110ms

*注意：執行測試的node節點/Pod與serivce所在的pod的距離（是否在同一臺主機上），對前兩個場景可以能會有一定影響。*

## 網絡性能測試

網絡使用flannel的vxlan模式。

使用iperf進行測試。

服務端命令：

```shell
iperf -s -p 12345 -i 1 -M
```

客戶端命令：

```shell
iperf -c ${server-ip} -p 12345 -i 1 -t 10 -w 20K
```

### 場景一、主機之間

```
[ ID] Interval       Transfer     Bandwidth
[  3]  0.0- 1.0 sec   598 MBytes  5.02 Gbits/sec
[  3]  1.0- 2.0 sec   637 MBytes  5.35 Gbits/sec
[  3]  2.0- 3.0 sec   664 MBytes  5.57 Gbits/sec
[  3]  3.0- 4.0 sec   657 MBytes  5.51 Gbits/sec
[  3]  4.0- 5.0 sec   641 MBytes  5.38 Gbits/sec
[  3]  5.0- 6.0 sec   639 MBytes  5.36 Gbits/sec
[  3]  6.0- 7.0 sec   628 MBytes  5.26 Gbits/sec
[  3]  7.0- 8.0 sec   649 MBytes  5.44 Gbits/sec
[  3]  8.0- 9.0 sec   638 MBytes  5.35 Gbits/sec
[  3]  9.0-10.0 sec   652 MBytes  5.47 Gbits/sec
[  3]  0.0-10.0 sec  6.25 GBytes  5.37 Gbits/sec
```

### 場景二、不同主機的Pod之間(使用flannel的vxlan模式)

```
[ ID] Interval       Transfer     Bandwidth
[  3]  0.0- 1.0 sec   372 MBytes  3.12 Gbits/sec
[  3]  1.0- 2.0 sec   345 MBytes  2.89 Gbits/sec
[  3]  2.0- 3.0 sec   361 MBytes  3.03 Gbits/sec
[  3]  3.0- 4.0 sec   397 MBytes  3.33 Gbits/sec
[  3]  4.0- 5.0 sec   405 MBytes  3.40 Gbits/sec
[  3]  5.0- 6.0 sec   410 MBytes  3.44 Gbits/sec
[  3]  6.0- 7.0 sec   404 MBytes  3.39 Gbits/sec
[  3]  7.0- 8.0 sec   408 MBytes  3.42 Gbits/sec
[  3]  8.0- 9.0 sec   451 MBytes  3.78 Gbits/sec
[  3]  9.0-10.0 sec   387 MBytes  3.25 Gbits/sec
[  3]  0.0-10.0 sec  3.85 GBytes  3.30 Gbits/sec
```

### 場景三、Node與非同主機的Pod之間（使用flannel的vxlan模式）

```
[ ID] Interval       Transfer     Bandwidth
[  3]  0.0- 1.0 sec   372 MBytes  3.12 Gbits/sec
[  3]  1.0- 2.0 sec   420 MBytes  3.53 Gbits/sec
[  3]  2.0- 3.0 sec   434 MBytes  3.64 Gbits/sec
[  3]  3.0- 4.0 sec   409 MBytes  3.43 Gbits/sec
[  3]  4.0- 5.0 sec   382 MBytes  3.21 Gbits/sec
[  3]  5.0- 6.0 sec   408 MBytes  3.42 Gbits/sec
[  3]  6.0- 7.0 sec   403 MBytes  3.38 Gbits/sec
[  3]  7.0- 8.0 sec   423 MBytes  3.55 Gbits/sec
[  3]  8.0- 9.0 sec   376 MBytes  3.15 Gbits/sec
[  3]  9.0-10.0 sec   451 MBytes  3.78 Gbits/sec
[  3]  0.0-10.0 sec  3.98 GBytes  3.42 Gbits/sec
```

### 場景四、不同主機的Pod之間（使用flannel的host-gw模式）

```
[ ID] Interval       Transfer     Bandwidth
[  5]  0.0- 1.0 sec   530 MBytes  4.45 Gbits/sec
[  5]  1.0- 2.0 sec   576 MBytes  4.84 Gbits/sec
[  5]  2.0- 3.0 sec   631 MBytes  5.29 Gbits/sec
[  5]  3.0- 4.0 sec   580 MBytes  4.87 Gbits/sec
[  5]  4.0- 5.0 sec   627 MBytes  5.26 Gbits/sec
[  5]  5.0- 6.0 sec   578 MBytes  4.85 Gbits/sec
[  5]  6.0- 7.0 sec   584 MBytes  4.90 Gbits/sec
[  5]  7.0- 8.0 sec   571 MBytes  4.79 Gbits/sec
[  5]  8.0- 9.0 sec   564 MBytes  4.73 Gbits/sec
[  5]  9.0-10.0 sec   572 MBytes  4.80 Gbits/sec
[  5]  0.0-10.0 sec  5.68 GBytes  4.88 Gbits/sec
```

### 場景五、Node與非同主機的Pod之間（使用flannel的host-gw模式）

```
[ ID] Interval       Transfer     Bandwidth
[  3]  0.0- 1.0 sec   570 MBytes  4.78 Gbits/sec
[  3]  1.0- 2.0 sec   552 MBytes  4.63 Gbits/sec
[  3]  2.0- 3.0 sec   598 MBytes  5.02 Gbits/sec
[  3]  3.0- 4.0 sec   580 MBytes  4.87 Gbits/sec
[  3]  4.0- 5.0 sec   590 MBytes  4.95 Gbits/sec
[  3]  5.0- 6.0 sec   594 MBytes  4.98 Gbits/sec
[  3]  6.0- 7.0 sec   598 MBytes  5.02 Gbits/sec
[  3]  7.0- 8.0 sec   606 MBytes  5.08 Gbits/sec
[  3]  8.0- 9.0 sec   596 MBytes  5.00 Gbits/sec
[  3]  9.0-10.0 sec   604 MBytes  5.07 Gbits/sec
[  3]  0.0-10.0 sec  5.75 GBytes  4.94 Gbits/sec
```

### 網絡性能對比綜述

使用Flannel的**vxlan**模式實現每個pod一個IP的方式，會比宿主機直接互聯的網絡性能損耗30%～40%，符合網上流傳的測試結論。而flannel的host-gw模式比起宿主機互連的網絡性能損耗大約是10%。

Vxlan會有一個封包解包的過程，所以會對網絡性能造成較大的損耗，而host-gw模式是直接使用路由信息，網絡損耗小，關於host-gw的架構請訪問[Flannel host-gw architecture](https://docs.openshift.com/container-platform/3.4/architecture/additional_concepts/flannel.html)。

## Kubernete的性能測試

參考[Kubernetes集群性能測試](https://supereagle.github.io/2017/03/09/kubemark/)中的步驟，對kubernetes的性能進行測試。

我的集群版本是Kubernetes1.6.0，首先克隆代碼，將kubernetes目錄複製到`$GOPATH/src/k8s.io/`下然後執行：

```bash
$ ./hack/generate-bindata.sh
/usr/local/src/k8s.io/kubernetes /usr/local/src/k8s.io/kubernetes
Generated bindata file : test/e2e/generated/bindata.go has 13498 test/e2e/generated/bindata.go lines of lovely automated artifacts
No changes in generated bindata file: pkg/generated/bindata.go
/usr/local/src/k8s.io/kubernetes
$ make WHAT="test/e2e/e2e.test"
...
+++ [0425 17:01:34] Generating bindata:
    test/e2e/generated/gobindata_util.go
/usr/local/src/k8s.io/kubernetes /usr/local/src/k8s.io/kubernetes/test/e2e/generated
/usr/local/src/k8s.io/kubernetes/test/e2e/generated
+++ [0425 17:01:34] Building go targets for linux/amd64:
    test/e2e/e2e.test
$ make ginkgo
+++ [0425 17:05:57] Building the toolchain targets:
    k8s.io/kubernetes/hack/cmd/teststale
    k8s.io/kubernetes/vendor/github.com/jteeuwen/go-bindata/go-bindata
+++ [0425 17:05:57] Generating bindata:
    test/e2e/generated/gobindata_util.go
/usr/local/src/k8s.io/kubernetes /usr/local/src/k8s.io/kubernetes/test/e2e/generated
/usr/local/src/k8s.io/kubernetes/test/e2e/generated
+++ [0425 17:05:58] Building go targets for linux/amd64:
    vendor/github.com/onsi/ginkgo/ginkgo

$ export KUBERNETES_PROVIDER=local
$ export KUBECTL_PATH=/usr/bin/kubectl
$ go run hack/e2e.go -v -test  --test_args="--host=http://172.20.0.113:8080 --ginkgo.focus=\[Feature:Performance\]" >>log.txt
```

**測試結果**

```bash
Apr 25 18:27:31.461: INFO: API calls latencies: {
  "apicalls": [
    {
      "resource": "pods",
      "verb": "POST",
      "latency": {
        "Perc50": 2148000,
        "Perc90": 13772000,
        "Perc99": 14436000,
        "Perc100": 0
      }
    },
    {
      "resource": "services",
      "verb": "DELETE",
      "latency": {
        "Perc50": 9843000,
        "Perc90": 11226000,
        "Perc99": 12391000,
        "Perc100": 0
      }
    },
    ...
Apr 25 18:27:31.461: INFO: [Result:Performance] {
  "version": "v1",
  "dataItems": [
    {
      "data": {
        "Perc50": 2.148,
        "Perc90": 13.772,
        "Perc99": 14.436
      },
      "unit": "ms",
      "labels": {
        "Resource": "pods",
        "Verb": "POST"
      }
    },
...
2.857: INFO: Running AfterSuite actions on all node
Apr 26 10:35:32.857: INFO: Running AfterSuite actions on node 1

Ran 2 of 606 Specs in 268.371 seconds
SUCCESS! -- 2 Passed | 0 Failed | 0 Pending | 604 Skipped PASS

Ginkgo ran 1 suite in 4m28.667870101s
Test Suite Passed
```

從kubemark輸出的日誌中可以看到**API calls latencies**和**Performance**。

**日誌裡顯示，創建90個pod用時40秒以內，平均創建每個pod耗時0.44秒。**

### 不同type的資源類型API請求耗時分佈

| Resource  | Verb   | 50%     | 90%      | 99%      |
| --------- | ------ | ------- | -------- | -------- |
| services  | DELETE | 8.472ms | 9.841ms  | 38.226ms |
| endpoints | PUT    | 1.641ms | 3.161ms  | 30.715ms |
| endpoints | GET    | 931µs   | 10.412ms | 27.97ms  |
| nodes     | PATCH  | 4.245ms | 11.117ms | 18.63ms  |
| pods      | PUT    | 2.193ms | 2.619ms  | 17.285ms |

從`log.txt`日誌中還可以看到更多詳細請求的測試指標。

![kubernetes-dashboard](http://olz1di9xf.bkt.clouddn.com/kubenetes-e2e-test.jpg)

### 注意事項

測試過程中需要用到docker鏡像存儲在GCE中，需要翻牆下載，我沒看到哪裡配置這個鏡像的地址。該鏡像副本已上傳時速雲：

用到的鏡像有如下兩個：

- gcr.io/google_containers/pause-amd64:3.0
- gcr.io/google_containers/serve_hostname:v1.4

時速雲鏡像地址：

- index.tenxcloud.com/jimmy/pause-amd64:3.0
- index.tenxcloud.com/jimmy/serve_hostname:v1.4

將鏡像pull到本地後重新打tag。

## Locust測試

請求統計

| Method | Name     | # requests | # failures | Median response time | Average response time | Min response time | Max response time | Average Content Size | Requests/s |
| ------ | -------- | ---------- | ---------- | -------------------- | --------------------- | ----------------- | ----------------- | -------------------- | ---------- |
| POST   | /login   | 5070       | 78         | 59000                | 80551                 | 11218             | 202140            | 54                   | 1.17       |
| POST   | /metrics | 5114232    | 85879      | 63000                | 82280                 | 29518             | 331330            | 94                   | 1178.77    |
| None   | Total    | 5119302    | 85957      | 63000                | 82279                 | 11218             | 331330            | 94                   | 1179.94    |

響應時間分佈

| Name          | # requests | 50%   | 66%    | 75%    | 80%    | 90%    | 95%    | 98%    | 99%    | 100%   |
| ------------- | ---------- | ----- | ------ | ------ | ------ | ------ | ------ | ------ | ------ | ------ |
| POST /login   | 5070       | 59000 | 125000 | 140000 | 148000 | 160000 | 166000 | 174000 | 176000 | 202140 |
| POST /metrics | 5114993    | 63000 | 127000 | 142000 | 149000 | 160000 | 166000 | 172000 | 176000 | 331330 |
| None Total    | 5120063    | 63000 | 127000 | 142000 | 149000 | 160000 | 166000 | 172000 | 176000 | 331330 |

以上兩個表格都是瞬時值。請求失敗率在2%左右。

Sample-webapp起了48個pod。

Locust模擬10萬用戶，每秒增長100個。

![locust-test](http://olz1di9xf.bkt.clouddn.com/kubernetes-locust-test.jpg)

## 參考

[基於 Python 的性能測試工具 locust (與 LR 的簡單對比)](https://testerhome.com/topics/4839)

[Locust docs](http://docs.locust.io/en/latest/what-is-locust.html)

[python用戶負載測試工具：locust](http://timd.cn/2015/09/17/locust/)

[Kubernetes集群性能測試](https://supereagle.github.io/2017/03/09/kubemark/)

[CoreOS是如何將Kubernetes的性能提高10倍的](http://dockone.io/article/1050)

[Kubernetes 1.3 的性能和彈性 —— 2000 節點，60,0000 Pod 的集群](http://blog.fleeto.us/translation/updates-performance-and-scalability-kubernetes-13-2000-node-60000-pod-clusters)

[運用Kubernetes進行分佈式負載測試](http://www.csdn.net/article/2015-07-07/2825155)

[Kubemark User Guide](https://github.com/kubernetes/community/blob/master/contributors/devel/kubemark-guide.md)

[Flannel host-gw architecture](https://docs.openshift.com/container-platform/3.4/architecture/additional_concepts/flannel.html)
