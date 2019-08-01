# DNS

DNS 是 Kubernetes 的核心功能之一，通過 kube-dns 或 CoreDNS 作為集群的必備擴展來提供命名服務。

## CoreDNS

從 v1.11 開始可以使用 [CoreDNS](https://coredns.io/) 來提供命名服務，並從 v1.13 開始成為默認 DNS 服務。CoreDNS 的特點是效率更高，資源佔用率更小，推薦使用 CoreDNS 替代 kube-dns 為集群提供 DNS 服務。

從 kube-dns 升級為 CoreDNS 的步驟為：

```sh
$ git clone https://github.com/coredns/deployment
$ cd deployment/kubernetes
$ ./deploy.sh | kubectl apply -f -
$ kubectl delete --namespace=kube-system deployment kube-dns
```

全新部署的話，可以點擊[這裡](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/dns) 查看 CoreDNS 擴展的配置方法。

## 支持的 DNS 格式

- Service
  - A record：生成 `my-svc.my-namespace.svc.cluster.local`，解析 IP 分為兩種情況
    - 普通 Service 解析為 Cluster IP
    - Headless Service 解析為指定的 Pod IP 列表
  - SRV record：生成 `_my-port-name._my-port-protocol.my-svc.my-namespace.svc.cluster.local`
- Pod
  - A record：`pod-ip-address.my-namespace.pod.cluster.local`
  - 指定 hostname 和 subdomain：`hostname.custom-subdomain.default.svc.cluster.local`，如下所示

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: busybox2
  labels:
    name: busybox
spec:
  hostname: busybox-2
  subdomain: default-subdomain
  containers:
  - image: busybox
    command:
      - sleep
      - "3600"
    name: busybox
```

![](images/dns-demo.png)

## 支持配置私有 DNS 服務器和上游 DNS 服務器

從 Kubernetes 1.6 開始，可以通過為 kube-dns 提供 ConfigMap 來實現對存根域以及上游名稱服務器的自定義指定。例如，下面的配置插入了一個單獨的私有根 DNS 服務器和兩個上游 DNS 服務器。

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: kube-dns
  namespace: kube-system
data:
  stubDomains: |
    {“acme.local”: [“1.2.3.4”]}
  upstreamNameservers: |
    [“8.8.8.8”, “8.8.4.4”]
```
使用上述特定配置，查詢請求首先會被髮送到 kube-dns 的 DNS 緩存層 (Dnsmasq 服務器)。Dnsmasq 服務器會先檢查請求的後綴，帶有集群后綴（例如：”.cluster.local”）的請求會被髮往 kube-dns，擁有存根域後綴的名稱（例如：”.acme.local”）將會被髮送到配置的私有 DNS 服務器 [“1.2.3.4”]。最後，不滿足任何這些後綴的請求將會被髮送到上游 DNS [“8.8.8.8”, “8.8.4.4”] 裡。

![](images/kube-dns-upstream.png)

## kube-dns

### 啟動 kube-dns 示例

一般通過擴展的方式部署 DNS 服務，如把 [kube-dns.yaml](https://github.com/feiskyer/kubernetes-handbook/raw/master/manifests/kubedns/kube-dns.yaml) 放到 Master 節點的 `/etc/kubernetes/addons` 目錄中。當然也可以手動部署：

```sh
kubectl apply -f https://github.com/feiskyer/kubernetes-handbook/raw/master/manifests/kubedns/kube-dns.yaml
```

這會在 Kubernetes 中啟動一個包含三個容器的 Pod，運行著 DNS 相關的三個服務：

```sh
# kube-dns container
kube-dns --domain=cluster.local. --dns-port=10053 --config-dir=/kube-dns-config --v=2

# dnsmasq container
dnsmasq-nanny -v=2 -logtostderr -configDir=/etc/k8s/dns/dnsmasq-nanny -restartDnsmasq=true -- -k --cache-size=1000 --log-facility=- --server=127.0.0.1#10053

# sidecar container
sidecar --v=2 --logtostderr --probe=kubedns,127.0.0.1:10053,kubernetes.default.svc.cluster.local.,5,A --probe=dnsmasq,127.0.0.1:53,kubernetes.default.svc.cluster.local.,5,A
```

Kubernetes v1.10 也支持 Beta 版的 CoreDNS，其性能較 kube-dns 更好。可以以擴展方式部署，如把 [coredns.yaml](https://github.com/feiskyer/kubernetes-handbook/blob/master/manifests/kubedns/coredns.yaml) 放到 Master 節點的 `/etc/kubernetes/addons` 目錄中。當然也可以手動部署：

```sh
kubectl apply -f https://github.com/feiskyer/kubernetes-handbook/raw/master/manifests/kubedns/coredns.yaml
```

### kube-dns 工作原理

如下圖所示，kube-dns 由三個容器構成：

- kube-dns：DNS 服務的核心組件，主要由 KubeDNS 和 SkyDNS 組成
  - KubeDNS 負責監聽 Service 和 Endpoint 的變化情況，並將相關的信息更新到 SkyDNS 中
  - SkyDNS 負責 DNS 解析，監聽在 10053 端口 (tcp/udp)，同時也監聽在 10055 端口提供 metrics
  - kube-dns 還監聽了 8081 端口，以供健康檢查使用
- dnsmasq-nanny：負責啟動 dnsmasq，並在配置發生變化時重啟 dnsmasq
  - dnsmasq 的 upstream 為 SkyDNS，即集群內部的 DNS 解析由 SkyDNS 負責
- sidecar：負責健康檢查和提供 DNS metrics（監聽在 10054 端口）

![](images/kube-dns.png)

### 源碼簡介

kube-dns 的代碼已經從 kubernetes 裡面分離出來，放到了 <https://github.com/kubernetes/dns>。

kube-dns、dnsmasq-nanny 和 sidecar 的代碼均是從 `cmd/<cmd-name>/main.go` 開始，並分別調用 `pkg/dns`、`pkg/dnsmasq` 和 `pkg/sidecar` 完成相應的功能。而最核心的 DNS 解析則是直接引用了 `github.com/skynetservices/skydns/server` 的代碼，具體實現見 [skynetservices/skydns](https://github.com/skynetservices/skydns/tree/master/server)。



## 常見問題

**Ubuntu 18.04 中 DNS 無法解析的問題 **

Ubuntu 18.04 中默認開啟了 systemd-resolved，它會在系統的 /etc/resolv.conf 中寫入 `nameserver 127.0.0.53`。由於這是一個本地地址，從而會導致 CoreDNS 或者 kube-dns 無法解析外網地址。

解決方法是替換掉 systemd-resolved 生成的 resolv.conf 文件：

```sh
sudo rm /etc/resolv.conf
sudo ln -s /run/systemd/resolve/resolv.conf /etc/resolv.conf
```

或者為 DNS 服務手動指定 resolv.conf 的路徑：

```sh
--resolv-conf=/run/systemd/resolve/resolv.conf
```

## 參考文檔

- [dns-pod-service 介紹](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/)
- [coredns/coredns](https://github.com/coredns/coredns)
