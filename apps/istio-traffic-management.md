# Istio 流量管理

Istio 提供了強大的流量管理功能，如智能路由、服務發現與負載均衡、故障恢復、故障注入等。

![istio-traffic-management](images/istio-traffic.png)

流量管理的功能由 Pilot 配合 Envoy 負責，並接管進入和離開容器的所有流量：

- 流量管理的核心組件是 Pilot，負責管理和配置服務網格中的所有 Envoy 實例
- 而 Envoy 實例則負責維護負載均衡以及健康檢查信息，從而允許其在目標實例之間智能分配流量，同時遵循其指定的路由規則



![pilot](images/pilot-arch.png)

![request-flow](images/istio-request-flow.png)

## API 版本

Istio 0.7.X 及以前版本僅支持 `config.istio.io/v1alpha2`，0.8.0 將其升級為 `networking.istio.io/v1alpha3`，並且重命名了流量管理的幾個資源對象：

- RouteRule -> `VirtualService`：定義服務網格內對服務的請求如何進行路由控制 ，支持根據 host、sourceLabels 、http headers 等不同的路由方式，也支持百分比、超時、重試、錯誤注入等功能。
- DestinationPolicy -> `DestinationRule`：定義 `VirtualService` 之後的路由策略，包括斷路器、負載均衡以及 TLS 等。
- EgressRule -> `ServiceEntry`：定義了服務網格之外的服務，支持兩種類型：網格內部和網格外部。網格內的條目和其他的內部服務類似，用於顯式的將服務加入網格。可以用來把服務作為服務網格擴展的一部分加入不受管理的基礎設置（例如加入到基於 Kubernetes 的服務網格中的虛擬機）中。網格外的條目用於表達網格外的服務。對這種條目來說，雙向 TLS 認證是禁止的，策略實現需要在客戶端執行，而不像內部服務請求中的服務端執行。
- Ingress -> `Gateway`：定義邊緣網絡流量的負載均衡。

## 服務發現和負載均衡

為了接管流量，Istio 假設所有容器在啟動時自動將自己註冊到 Istio 中（通過自動或手動給 Pod 注入 Envoy sidecar 容器）。Envoy 收到外部請求後，會對請求作負載均衡，並支持輪詢、隨機和加權最少請求等負載均衡算法。除此之外，Envoy 還會以熔斷機制定期檢查服務後端容器的健康狀態，自動移除不健康的容器和加回恢復正常的容器。容器內也可以返回 HTTP 503 顯示將自己從負載均衡中移除。

![](images/istio-service-discovery.png)

### 流量接管

Istio 假定進入和離開服務網絡的所有流量都會通過 Envoy 代理進行傳輸。Envoy sidecar 使用 iptables 把進入 Pod 和從 Pod 發出的流量轉發到 Envoy 進程監聽的端口（即 15001 端口）上：

```sh
*nat
:PREROUTING ACCEPT [0:0]
:INPUT ACCEPT [1:60]
:OUTPUT ACCEPT [482:44962]
:POSTROUTING ACCEPT [482:44962]
:ISTIO_INBOUND - [0:0]
:ISTIO_IN_REDIRECT - [0:0]
:ISTIO_OUTPUT - [0:0]
:ISTIO_REDIRECT - [0:0]
-A PREROUTING -p tcp -j ISTIO_INBOUND
-A OUTPUT -p tcp -j ISTIO_OUTPUT
-A ISTIO_INBOUND -p tcp -m tcp --dport 9080 -j ISTIO_IN_REDIRECT
-A ISTIO_IN_REDIRECT -p tcp -j REDIRECT --to-ports 15001
-A ISTIO_OUTPUT ! -d 127.0.0.1/32 -o lo -j ISTIO_REDIRECT
-A ISTIO_OUTPUT -m owner --uid-owner 1337 -j RETURN
-A ISTIO_OUTPUT -m owner --gid-owner 1337 -j RETURN
-A ISTIO_OUTPUT -d 127.0.0.1/32 -j RETURN
-A ISTIO_OUTPUT -j ISTIO_REDIRECT
-A ISTIO_REDIRECT -p tcp -j REDIRECT --to-ports 15001
```

## 故障恢復

Istio 提供了一系列開箱即用的故障恢復功能，如

- 超時處理
- 重試處理，如限制最大重試時間以及可變重試間隔
- 健康檢查，如自動移除不健康的容器
- 請求限制，如併發請求數和併發連接數
- 熔斷

這些功能均可以使用 VirtualService 動態配置。比如以下為用戶 jason 的請求返回 500 （而其他用戶均可正常訪問）：

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: ratings
spec:
  hosts:
  - ratings
  http:
  - match:
    - headers:
        cookie:
          regex: "^(.*?;)?(user=jason)(;.*)?$"
    fault:
      abort:
        percent: 100
        httpStatus: 500
    route:
    - destination:
        host: ratings
        subset: v1
  - route:
    - destination:
        host: ratings
        subset: v1
```

熔斷示例：

```sh
cat <<EOF | istioctl create -f -
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: httpbin
spec:
  host: httpbin
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 1
      http:
        http1MaxPendingRequests: 1
        maxRequestsPerConnection: 1
    outlierDetection:
      http:
        consecutiveErrors: 1
        interval: 1s
        baseEjectionTime: 3m
        maxEjectionPercent: 100
EOF
```

## 故障注入

Istio 支持為應用注入故障，以模擬實際生產中碰到的各種問題，包括

- 注入延遲（模擬網絡延遲和服務過載）
- 注入失敗（模擬應用失效）

這些故障均可以使用 VirtualService 動態配置。如以下配置 2 秒的延遲：

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: ratings
spec:
  hosts:
  - ratings
  http:
  - fault:
      delay:
        percent: 100
        fixedDelay: 2s
    route:
    - destination:
        host: ratings
        subset: v1
```

## 金絲雀部署

![service-versions](images/istio-service-versions.png)

首先部署 bookinfo，並配置默認路由為 v1 版本：

```sh
# 以下命令假設 bookinfo 示例程序已部署，如未部署，可以執行下面的命令
$ kubectl apply -f <(istioctl kube-inject -f samples/bookinfo/platform/kube/bookinfo.yaml)
# 此時，三個版本的 reviews 服務以負載均衡的方式輪詢。

# 創建默認路由，全部請求轉發到 v1
$ istioctl create -f samples/bookinfo/routing/route-rule-all-v1.yaml

$ kubectl get virtualservice reviews -o yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
  - reviews
  http:
  - route:
    - destination:
        host: reviews
        subset: v1
```

### 示例一：將 10% 請求發送到 v2 版本而其餘 90% 發送到 v1 版本

```sh
cat <<EOF | istioctl create -f -
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
    - reviews
  http:
  - route:
    - destination:
        host: reviews
        subset: v1
      weight: 75
    - destination:
        host: reviews
        subset: v2
      weight: 25
EOF
```

### 示例二：將 jason 用戶的請求全部發到 v2 版本

```sh
cat <<EOF | istioctl replace -f -
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: ratings
spec:
  hosts:
  - ratings
  http:
  - match:
    - sourceLabels:
        app: reviews
        version: v2
      headers:
        end-user:
          exact: jason
EOF
```

### 示例三：全部切換到 v2 版本

```sh
cat <<EOF | istioctl replace -f -
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
  - reviews
  http:
  - route:
    - destination:
        host: reviews
        subset: v2
EOF
```

### 示例四：限制併發訪問

```sh
cat <<EOF | istioctl create -f -
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: reviews
spec:
  host: reviews
  subsets:
  - name: v1
    labels:
      version: v1
    trafficPolicy:
      connectionPool:
        tcp:
          maxConnections: 100
EOF
```

為了查看訪問次數限制的效果，可以使用 [wrk](https://github.com/wg/wrk) 給應用加一些壓力：

```sh
export BOOKINFO_URL=$(kubectl get po -n istio-system -l istio=ingress -o jsonpath={.items[0].status.hostIP}):$(kubectl get svc -n istio-system istio-ingress -o jsonpath={.spec.ports[0].nodePort})
wrk -t1 -c1 -d20s http://$BOOKINFO_URL/productpage
```

## Gateway

Istio 在部署時會自動創建一個 [Istio Gateway](https://istio.io/docs/reference/config/istio.networking.v1alpha3/#Gateway)，用來控制 Ingress 訪問。

```sh
# prepare
kubectl apply -f <(istioctl kube-inject -f samples/httpbin/httpbin.yaml)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /tmp/tls.key -out /tmp/tls.crt -subj "/CN=httpbin.example.com"

# get ingress external IP (suppose load balancer service)
kubectl get svc istio-ingressgateway -n istio-system
export INGRESS_HOST=$(kubectl -n istio-system get service istio-ingressgateway -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
export INGRESS_PORT=$(kubectl -n istio-system get service istio-ingressgateway -o jsonpath='{.spec.ports[?(@.name=="http")].port}')
export SECURE_INGRESS_PORT=$(kubectl -n istio-system get service istio-ingressgateway -o jsonpath='{.spec.ports[?(@.name=="https")].port}')

# create gateway
cat <<EOF | istioctl create -f -
apiVersion: networking.istio.io/v1alpha3
kind: Gateway
metadata:
  name: httpbin-gateway
spec:
  selector:
    istio: ingressgateway # use Istio default gateway implementation
  servers:
  - port:
      number: 80
      name: http
      protocol: HTTP
    hosts:
    - "httpbin.example.com"
EOF

# configure routes for the gateway
cat <<EOF | istioctl create -f -
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: httpbin
spec:
  hosts:
  - "httpbin.example.com"
  gateways:
  - httpbin-gateway
  http:
  - match:
    - uri:
        prefix: /status
    - uri:
        prefix: /delay
    route:
    - destination:
        port:
          number: 8000
        host: httpbin
EOF

# validate 200
curl --resolve httpbin.example.com:$INGRESS_PORT:$INGRESS_HOST -HHost:httpbin.example.com -I http://httpbin.example.com:$INGRESS_PORT/status/200

# invalidate 404
curl --resolve httpbin.example.com:$INGRESS_PORT:$INGRESS_HOST -HHost:httpbin.example.com -I http://httpbin.example.com:$INGRESS_PORT/headers
```

使用 TLS：

```sh
kubectl create -n istio-system secret tls istio-ingressgateway-certs --key /tmp/tls.key --cert /tmp/tls.crt

cat <<EOF | istioctl replace -f -
apiVersion: networking.istio.io/v1alpha3
kind: Gateway
metadata:
  name: httpbin-gateway
spec:
  selector:
    istio: ingressgateway # use istio default ingress gateway
  servers:
  - port:
      number: 80
      name: http
      protocol: HTTP
    hosts:
    - "httpbin.example.com"
  - port:
      number: 443
      name: https
      protocol: HTTPS
    tls:
      mode: SIMPLE
      serverCertificate: /etc/istio/ingressgateway-certs/tls.crt
      privateKey: /etc/istio/ingressgateway-certs/tls.key
    hosts:
    - "httpbin.example.com"
EOF


# validate 200
curl --resolve httpbin.example.com:$SECURE_INGRESS_PORT:$INGRESS_HOST -HHost:httpbin.example.com -I -k https://httpbin.example.com:$SECURE_INGRESS_PORT/status/200
```

## Egress 流量

默認情況下，Istio 接管了容器的內外網流量，從容器內部無法訪問 Kubernetes 集群外的服務。可以通過 ServiceEntry 為需要的容器開放 Egress 訪問，如

```yaml
$ cat <<EOF | istioctl create -f -
apiVersion: networking.istio.io/v1alpha3
kind: ServiceEntry
metadata:
  name: httpbin-ext
spec:
  hosts:
  - httpbin.org
  ports:
  - number: 80
    name: http
    protocol: HTTP
EOF

$ cat <<EOF | istioctl create -f -
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: httpbin-ext
spec:
  hosts:
    - httpbin.org
  http:
  - timeout: 3s
    route:
      - destination:
          host: httpbin.org
        weight: 100
EOF
```

需要注意的是 ServiceEntry 僅支持 HTTP、TCP 和 HTTPS，對於其他協議需要通過 `--includeIPRanges` 的方式設置 IP 地址範圍，如

```sh
helm template @install/kubernetes/helm/istio@ --name istio --namespace istio-system --set global.proxy.includeIPRanges="10.0.0.1/24" -x @templates/sidecar-injector-configmap.yaml@ | kubectl apply -f -
```

## 流量鏡像

```sh
cat <<EOF | istioctl replace -f -
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: httpbin
spec:
  hosts:
    - httpbin
  http:
  - route:
    - destination:
        host: httpbin
        subset: v1
      weight: 100
    mirror:
      host: httpbin
      subset: v2
EOF
```

## 參考文檔

- [Istio traffic management overview](https://istio.io/docs/concepts/traffic-management/)
