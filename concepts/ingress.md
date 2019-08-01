# Ingress

在本篇文章中你將會看到一些在其他地方被交叉使用的術語，為了防止產生歧義，我們首先來澄清下。

- 節點：Kubernetes 集群中的服務器；
- 集群：Kubernetes 管理的一組服務器集合；
- 邊界路由器：為局域網和 Internet 路由數據包的路由器，執行防火牆保護局域網絡；
- 集群網絡：遵循 Kubernetes[網絡模型](https://kubernetes.io/docs/admin/networking/) 實現集群內的通信的具體實現，比如 [flannel](https://github.com/coreos/flannel#flannel) 和 [OVS](https://github.com/openvswitch/ovn-kubernetes)。
- 服務：Kubernetes 的服務 (Service) 是使用標籤選擇器標識的一組 pod [Service](https://kubernetes.io/docs/user-guide/services/)。 除非另有說明，否則服務的虛擬 IP 僅可在集群內部訪問。

## 什麼是 Ingress？

通常情況下，service 和 pod 的 IP 僅可在集群內部訪問。集群外部的請求需要通過負載均衡轉發到 service 在 Node 上暴露的 NodePort 上，然後再由 kube-proxy 通過邊緣路由器 (edge router) 將其轉發給相關的 Pod 或者丟棄。如下圖所示
```
   internet
        |
  ------------
  [Services]
```

而 Ingress 就是為進入集群的請求提供路由規則的集合，如下圖所示

![image-20190316184154726](assets/image-20190316184154726.png)

Ingress 可以給 service 提供集群外部訪問的 URL、負載均衡、SSL 終止、HTTP 路由等。為了配置這些 Ingress 規則，集群管理員需要部署一個 [Ingress controller](../plugins/ingress.md)，它監聽 Ingress 和 service 的變化，並根據規則配置負載均衡並提供訪問入口。

## Ingress 格式

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: test-ingress
spec:
  rules:
  - http:
      paths:
      - path: /testpath
        backend:
          serviceName: test
          servicePort: 80
```

每個 Ingress 都需要配置 `rules`，目前 Kubernetes 僅支持 http 規則。上面的示例表示請求 `/testpath` 時轉發到服務 `test` 的 80 端口。

## API 版本對照表

| Kubernetes 版本 | Extension 版本     |
| --------------- | ------------------ |
| v1.5+           | extensions/v1beta1 |

## Ingress 類型

根據 Ingress Spec 配置的不同，Ingress 可以分為以下幾種類型：

### 單服務 Ingress

單服務 Ingress 即該 Ingress 僅指定一個沒有任何規則的後端服務。

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: test-ingress
spec:
  backend:
    serviceName: testsvc
    servicePort: 80
```

> 注：單個服務還可以通過設置 `Service.Type=NodePort` 或者 `Service.Type=LoadBalancer` 來對外暴露。

### 多服務的 Ingress

路由到多服務的 Ingress 即根據請求路徑的不同轉發到不同的後端服務上，比如

```
foo.bar.com -> 178.91.123.132 -> / foo    s1:80
                                 / bar    s2:80
```

可以通過下面的 Ingress 來定義：

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: test
spec:
  rules:
  - host: foo.bar.com
    http:
      paths:
      - path: /foo
        backend:
          serviceName: s1
          servicePort: 80
      - path: /bar
        backend:
          serviceName: s2
          servicePort: 80
```

使用 `kubectl create -f` 創建完 ingress 後：

```bash
$ kubectl get ing
NAME      RULE          BACKEND   ADDRESS
test      -
          foo.bar.com
          /foo          s1:80
          /bar          s2:80
```

### 虛擬主機 Ingress

虛擬主機 Ingress 即根據名字的不同轉發到不同的後端服務上，而他們共用同一個的 IP 地址，如下所示

```
foo.bar.com --|                 |-> foo.bar.com s1:80
              | 178.91.123.132  |
bar.foo.com --|                 |-> bar.foo.com s2:80
```

下面是一個基於 [Host header](https://tools.ietf.org/html/rfc7230#section-5.4) 路由請求的 Ingress：

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: test
spec:
  rules:
  - host: foo.bar.com
    http:
      paths:
      - backend:
          serviceName: s1
          servicePort: 80
  - host: bar.foo.com
    http:
      paths:
      - backend:
          serviceName: s2
          servicePort: 80
```

> 注：沒有定義規則的後端服務稱為默認後端服務，可以用來方便的處理 404 頁面。

### TLS Ingress

TLS Ingress 通過 Secret 獲取 TLS 私鑰和證書 (名為 `tls.crt` 和 `tls.key`)，來執行 TLS 終止。如果 Ingress 中的 TLS 配置部分指定了不同的主機，則它們將根據通過 SNI TLS 擴展指定的主機名（假如 Ingress controller 支持 SNI）在多個相同端口上進行復用。

定義一個包含 `tls.crt` 和 `tls.key` 的 secret：

```yaml
apiVersion: v1
data:
  tls.crt: base64 encoded cert
  tls.key: base64 encoded key
kind: Secret
metadata:
  name: testsecret
  namespace: default
type: Opaque
```

Ingress 中引用 secret：

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: no-rules-map
spec:
  tls:
    - secretName: testsecret
  backend:
    serviceName: s1
    servicePort: 80
```

注意，不同 Ingress controller 支持的 TLS 功能不盡相同。 請參閱有關 [nginx](https://kubernetes.github.io/ingress-nginx/)，[GCE](https://github.com/kubernetes/ingress-gce) 或任何其他 Ingress controller 的文檔，以瞭解 TLS 的支持情況。

## 更新 Ingress

可以通過 `kubectl edit ing name` 的方法來更新 ingress：

```Bash
$ kubectl get ing
NAME      RULE          BACKEND   ADDRESS
test      -                       178.91.123.132
          foo.bar.com
          /foo          s1:80
$ kubectl edit ing test
```

這會彈出一個包含已有 IngressSpec yaml 文件的編輯器，修改並保存就會將其更新到 kubernetes API server，進而觸發 Ingress Controller 重新配置負載均衡：

```yaml
spec:
  rules:
  - host: foo.bar.com
    http:
      paths:
      - backend:
          serviceName: s1
          servicePort: 80
        path: /foo
  - host: bar.baz.com
    http:
      paths:
      - backend:
          serviceName: s2
          servicePort: 80
        path: /foo
..
```

更新後：

```bash
$ kubectl get ing
NAME      RULE          BACKEND   ADDRESS
test      -                       178.91.123.132
          foo.bar.com
          /foo          s1:80
          bar.baz.com
          /foo          s2:80
```

當然，也可以通過 `kubectl replace -f new-ingress.yaml` 命令來更新，其中 new-ingress.yaml 是修改過的 Ingress yaml。

## Ingress Controller

Ingress 正常工作需要集群中運行 Ingress Controller。Ingress Controller 與其他作為 kube-controller-manager 中的在集群創建時自動啟動的 controller 成員不同，需要用戶選擇最適合自己集群的 Ingress Controller，或者自己實現一個。

Ingress Controller 以 Kubernetes Pod 的方式部署，以 daemon 方式運行，保持 watch Apiserver 的 /ingress 接口以更新 Ingress 資源，以滿足 Ingress 的請求。比如可以使用 [Nginx Ingress Controller](https://github.com/kubernetes/ingress-nginx)：

```sh
helm install stable/nginx-ingress --name nginx-ingress --set rbac.create=true
```

其他 Ingress Controller 還有：

- [traefik ingress](../practice/service-discovery-lb/service-discovery-and-load-balancing.md) 提供了一個 Traefik Ingress Controller 的實踐案例
- [kubernetes/ingress-nginx](https://github.com/kubernetes/ingress-nginx) 提供了一個詳細的 Nginx Ingress Controller 示例
- [kubernetes/ingress-gce](https://github.com/kubernetes/ingress-gce) 提供了一個用於 GCE 的 Ingress Controller 示例

## 參考文檔

- [Kubernetes Ingress Resource](https://kubernetes.io/docs/concepts/services-networking/ingress/)
- [Kubernetes Ingress Controller](https://github.com/kubernetes/ingress/tree/master)
- [使用 NGINX Plus 負載均衡 Kubernetes 服務](http://dockone.io/article/957)
- [使用 NGINX 和 NGINX Plus 的 Ingress Controller 進行 Kubernetes 的負載均衡](http://www.cnblogs.com/276815076/p/6407101.html)
- [Kubernetes : Ingress Controller with Træfɪk and Let's Encrypt](https://blog.osones.com/en/kubernetes-ingress-controller-with-traefik-and-lets-encrypt.html)
- [Kubernetes : Træfɪk and Let's Encrypt at scale](https://blog.osones.com/en/kubernetes-traefik-and-lets-encrypt-at-scale.html)
- [Kubernetes Ingress Controller-Træfɪk](https://docs.traefik.io/user-guide/kubernetes/)
- [Kubernetes 1.2 and simplifying advanced networking with Ingress](http://blog.kubernetes.io/2016/03/Kubernetes-1.2-and-simplifying-advanced-networking-with-Ingress.html)
