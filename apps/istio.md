# Istio 和 Service Mesh

Istio 是 Google、IBM 和 Lyft 聯合開源的服務網格（Service Mesh）框架，旨在解決大量微服務的發現、連接、管理、監控以及安全等問題。Istio 對應用是透明的，不需要改動任何服務代碼就可以實現透明的服務治理。

Istio 的主要特性包括：

- HTTP、gRPC、WebSocket 和 TCP 網絡流量的自動負載均衡
- 細粒度的網絡流量行為控制， 包括豐富的路由規則、重試、故障轉移和故障注入等
- 可選策略層和配置 API 支持訪問控制、速率限制以及配額管理
- 自動度量、日誌記錄和跟蹤所有進出的流量
- 強大的身份認證和授權機制實現服務間的安全通信

## Istio 原理

Istio 從邏輯上可以分為數據平面和控制平面：

- **數據平面**主要由一系列的智能代理（默認為 Envoy）組成，管理微服務之間的網絡通信
- **控制平面**負責管理和配置代理來路由流量，並配置 Mixer 以進行策略部署和遙測數據收集

Istio 架構可以如下圖所示

![](images/istio-arch.png)

它主要由以下組件構成

- [Envoy](https://www.envoyproxy.io//)：Lyft 開源的高性能代理，用於調解服務網格中所有服務的入站和出站流量。它支持動態服務發現、負載均衡、TLS 終止、HTTP/2 和 gPRC 代理、熔斷、健康檢查、故障注入和性能測量等豐富的功能。Envoy 以 sidecar 的方式部署在相關的服務的 Pod 中，從而無需重新構建或重寫代碼。
- Mixer：負責訪問控制、執行策略並從 Envoy 代理中收集遙測數據。Mixer 支持靈活的插件模型，方便擴展（支持 GCP、AWS、Prometheus、Heapster 等多種後端）。
- Pilot：動態管理 Envoy 實例的生命週期，提供服務發現、智能路由和彈性流量管理（如超時、重試）等功能。它將流量管理策略轉化為 Envoy 數據平面配置，並傳播到 sidecar 中。
- [Pilot](https://istio.io/zh/docs/concepts/traffic-management/#pilot-%E5%92%8C-envoy) 為 Envoy sidecar 提供服務發現功能，為智能路由（例如 A/B 測試、金絲雀部署等）和彈性（超時、重試、熔斷器等）提供流量管理功能。它將控制流量行為的高級路由規則轉換為特定於 Envoy 的配置，並在運行時將它們傳播到 sidecar。Pilot 將服務發現機制抽象為符合 [Envoy 數據平面 API](https://github.com/envoyproxy/data-plane-api) 的標準格式，以便支持在多種環境下運行並保持流量管理的相同操作接口。
- Citadel 通過內置身份和憑證管理提供服務間和最終用戶的身份認證。支持基於角色的訪問控制、基於服務標識的策略執行等。

![](images/istio-service.png)

在數據平面上，除了 [Envoy](https://www.envoyproxy.io)，還可以選擇使用 [nginxmesh](https://github.com/nginmesh/nginmesh)、[linkerd](https://linkerd.io/getting-started) 等作為網絡代理。比如，使用 nginxmesh 時，Istio 的控制平面（Pilot、Mixer、Auth）保持不變，但用 Nginx Sidecar 取代 Envoy：

![](images/nginx_sidecar.png)

## 安裝

Istio 的安裝部署步驟見 [這裡](istio-deploy.md)。

## 注入 Sidecar 容器前對 Pod 的要求

為 Pod 注入 Sidecar 容器後才能成為服務網格的一部分。Istio 要求 Pod 必須滿足以下條件：

- Pod 要關聯服務並且必須屬於單一的服務，不支持屬於多個服務的 Pod
- 端口必須要命名，格式為 `<協議>[-<後綴>]`，其中協議包括 `http`、`http2`、`grpc`、`mongo` 以及 `redis`。否則會被視為 TCP 流量
- 推薦所有 Deployment 中增加 `app` 標籤，用來在分佈式跟蹤中添加上下文信息

## 示例應用

> 以下步驟假設命令行終端在 [安裝部署](istio-deploy.md) 時下載的 `istio-${ISTIO_VERSION}` 目錄中。

### 手動注入 sidecar 容器

在部署應用時，可以通過 `istioctl kube-inject` 給 Pod 手動插入 Envoy sidecar 容器，即

```sh
$  kubectl apply -f <(istioctl kube-inject --debug -f samples/bookinfo/platform/kube/bookinfo.yaml)
service "details" configured
deployment.extensions "details-v1" configured
service "ratings" configured
deployment.extensions "ratings-v1" configured
service "reviews" configured
deployment.extensions "reviews-v1" configured
deployment.extensions "reviews-v2" configured
deployment.extensions "reviews-v3" configured
service "productpage" configured
deployment.extensions "productpage-v1" configured
ingress.extensions "gateway" configured

$ kubectl apply -f samples/bookinfo/networking/bookinfo-gateway.yaml
```

原始應用如下圖所示

![](images/bookinfo.png)

`istioctl kube-inject` 在原始應用的每個 Pod 中插入了一個 Envoy 容器

![](images/bookinfo2.png)

服務啟動後，可以通過 Gateway 地址 `http://<gateway-address>/productpage` 來訪問 BookInfo 應用：

```sh
$ kubectl get svc istio-ingressgateway -n istio-system
kubectl get svc istio-ingressgateway -n istio-system
NAME                   TYPE           CLUSTER-IP    EXTERNAL-IP    PORT(S)                                                                                                     AGE
istio-ingressgateway   LoadBalancer   10.0.203.82   x.x.x.x        80:31380/TCP,443:31390/TCP,31400:31400/TCP,15011:31720/TCP,8060:31948/TCP,15030:32340/TCP,15031:31958/TCP   2h
```

![](images/productpage.png)

默認情況下，三個版本的 reviews 服務以負載均衡的方式輪詢。

### 自動注入 sidecar 容器

首先確認 `admissionregistration` API 已經開啟：

```sh
$ kubectl api-versions | grep admissionregistration
admissionregistration.k8s.io/v1beta1
```

然後確認 istio-sidecar-injector 正常運行

```sh
# Conform istio-sidecar-injector is working
$ kubectl -n istio-system get deploy istio-sidecar-injector
NAME                     DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
istio-sidecar-injector   1         1         1            1           4m
```

為需要自動注入 sidecar 的 namespace 加上標籤 `istio-injection=enabled`：

```sh
# default namespace 沒有 istio-injection 標籤
$ kubectl get namespace -L istio-injection
NAME           STATUS        AGE       ISTIO-INJECTION
default        Active        1h
istio-system   Active        1h
kube-public    Active        1h
kube-system    Active        1h

# 打上 istio-injection=enabled 標籤
$ kubectl label namespace default istio-injection=enabled
```

這樣，在 default namespace 中創建 Pod 後自動添加 istio sidecar 容器。

## 參考文檔

- <https://istio.io/>
- [Istio - A modern service mesh](https://istio.io/talks/istio_talk_gluecon_2017.pdf)
- <https://www.envoyproxy.io/>
- <https://github.com/nginmesh/nginmesh>
- [WHAT’S A SERVICE MESH? AND WHY DO I NEED ONE?](https://buoyant.io/2017/04/25/whats-a-service-mesh-and-why-do-i-need-one/)
- [A SERVICE MESH FOR KUBERNETES](https://buoyant.io/2016/10/04/a-service-mesh-for-kubernetes-part-i-top-line-service-metrics/)
- [Service Mesh Pattern](http://philcalcado.com/2017/08/03/pattern_service_mesh.html)
- [Request Routing and Policy Management with the Istio Service Mesh](http://blog.kubernetes.io/2017/10/request-routing-and-policy-management.html)
