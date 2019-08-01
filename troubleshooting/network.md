# 網絡異常排錯

本章主要介紹各種常見的網絡問題以及排錯方法，包括 Pod 訪問異常、Service 訪問異常以及網絡安全策略異常等。

說到 Kubernetes 的網絡，其實無非就是以下三種情況之一

- Pod 訪問容器外部網絡
- 從容器外部訪問 Pod 網絡
- Pod 之間相互訪問

當然，以上每種情況還都分別包括本地訪問和跨主機訪問兩種場景，並且一般情況下都是通過 Service 間接訪問 Pod。

排查網絡問題基本上也是從這幾種情況出發，定位出具體的網絡異常點，再進而尋找解決方法。網絡異常可能的原因比較多，常見的有

- CNI 網絡插件配置錯誤，導致多主機網絡不通，比如
  - IP 網段與現有網絡衝突
  - 插件使用了底層網絡不支持的協議
  - 忘記開啟 IP 轉發等
    - `sysctl net.ipv4.ip_forward`
    - `sysctl net.bridge.bridge-nf-call-iptables`
- Pod 網絡路由丟失，比如
  - kubenet 要求網絡中有 podCIDR 到主機 IP 地址的路由，這些路由如果沒有正確配置會導致 Pod 網絡通信等問題
  - 在公有云平臺上，kube-controller-manager 會自動為所有 Node 配置路由，但如果配置不當（如認證授權失敗、超出配額等），也有可能導致無法配置路由
- 主機內或者雲平臺的安全組、防火牆或者安全策略等阻止了 Pod 網絡，比如
  - 非 Kubernetes 管理的 iptables 規則禁止了 Pod 網絡
  - 公有云平臺的安全組禁止了 Pod 網絡（注意 Pod 網絡有可能與 Node 網絡不在同一個網段）
  - 交換機或者路由器的 ACL 禁止了 Pod 網絡

## Flannel Pods 一直處於 Init:CrashLoopBackOff 狀態

Flannel 網絡插件非常容易部署，只要一條命令即可

```sh
kubectl apply -f https://raw.githubusercontent.com/coreos/flannel/master/Documentation/kube-flannel.yml
```

然而，部署完成後，Flannel Pod 有可能會碰到初始化失敗的錯誤

```sh
$ kubectl -n kube-system get pod
NAME                            READY     STATUS                  RESTARTS   AGE
kube-flannel-ds-ckfdc           0/1       Init:CrashLoopBackOff   4          2m
kube-flannel-ds-jpp96           0/1       Init:CrashLoopBackOff   4          2m
```

查看日誌會發現

```sh
$ kubectl -n kube-system logs kube-flannel-ds-jpp96 -c install-cni
cp: can't create '/etc/cni/net.d/10-flannel.conflist': Permission denied
```

這一般是由於 SELinux 開啟導致的，關閉 SELinux 既可解決。有兩種方法：

- 修改 `/etc/selinux/config` 文件方法：`SELINUX=disabled`
- 通過命令臨時修改（重啟會丟失）：`setenforce 0`

## Pod 無法分配 IP

Pod 一直處於 ContainerCreating 狀態，查看事件發現網絡插件無法為其分配 IP：

```sh
  Normal   SandboxChanged          5m (x74 over 8m)    kubelet, k8s-agentpool-66825246-0  Pod sandbox changed, it will be killed and re-created.
  Warning  FailedCreatePodSandBox  21s (x204 over 8m)  kubelet, k8s-agentpool-66825246-0  Failed create pod sandbox: rpc error: code = Unknown desc = NetworkPlugin cni failed to set up pod "deployment-azuredisk6-56d8dcb746-487td_default" network: Failed to allocate address: Failed to delegate: Failed to allocate address: No available addresses
```

查看網絡插件的 IP 分配情況，進一步發現 IP 地址確實已經全部分配完，但真正處於 Running 狀態的 Pod 數卻很少：

```sh
# 詳細路徑取決於具體的網絡插件，當使用 host-local IPAM 插件時，路徑位於 /var/lib/cni/networks 下面
$ cd /var/lib/cni/networks/kubenet
$ ls -al|wc -l
258

$ docker ps | grep POD | wc -l
7
```

這有兩種可能的原因

- 網絡插件本身的問題，Pod 停止後其 IP 未釋放
- Pod 重新創建的速度比 Kubelet 調用 CNI 插件回收網絡（垃圾回收時刪除已停止 Pod 前會先調用 CNI 清理網絡）的速度快

對第一個問題，最好聯繫插件開發者詢問修復方法或者臨時性的解決方法。當然，如果對網絡插件的工作原理很熟悉的話，也可以考慮手動釋放未使用的 IP 地址，比如：

* 停止 Kubelet
* 找到 IPAM 插件保存已分配 IP 地址的文件，比如 `/var/lib/cni/networks/cbr0`（flannel）或者 `/var/run/azure-vnet-ipam.json`（Azure CNI）等
* 查詢容器已用的 IP 地址，比如 `kubectl get pod -o wide --all-namespaces | grep <node-name>`
* 對比兩個列表，從 IPAM 文件中刪除未使用的 IP 地址，並手動刪除相關的虛擬網卡和網絡命名空間（如果有的話）
* 重啟啟動 Kubelet

```sh
# Take kubenet for example to delete the unused IPs
$ for hash in $(tail -n +1 * | grep '^[A-Za-z0-9]*$' | cut -c 1-8); do if [ -z $(docker ps -a | grep $hash | awk '{print $1}') ]; then grep -ilr $hash ./; fi; done | xargs rm
```

而第二個問題則可以給 Kubelet 配置更快的垃圾回收，如

```sh
--minimum-container-ttl-duration=15s
--maximum-dead-containers-per-container=1
--maximum-dead-containers=100
```

## Pod 無法解析 DNS

如果 Node 上安裝的 Docker 版本大於 1.12，那麼 Docker 會把默認的 iptables FORWARD 策略改為 DROP。這會引發 Pod 網絡訪問的問題。解決方法則在每個 Node 上面運行 `iptables -P FORWARD ACCEPT`，比如

```sh
echo "ExecStartPost=/sbin/iptables -P FORWARD ACCEPT" >> /etc/systemd/system/docker.service.d/exec_start.conf
systemctl daemon-reload
systemctl restart docker
```

如果使用了 flannel/weave 網絡插件，更新為最新版本也可以解決這個問題。

除此之外，還有很多其他原因導致 DNS 無法解析：

（1）DNS 無法解析也有可能是 kube-dns 服務異常導致的，可以通過下面的命令來檢查 kube-dns 是否處於正常運行狀態

```sh
$ kubectl get pods --namespace=kube-system -l k8s-app=kube-dns
NAME                    READY     STATUS    RESTARTS   AGE
...
kube-dns-v19-ezo1y      3/3       Running   0           1h
...
```

如果 kube-dns 處於 CrashLoopBackOff 狀態，那麼可以參考 [Kube-dns/Dashboard CrashLoopBackOff 排錯](cluster.md) 來查看具體排錯方法。

（2）如果 kube-dns Pod 處於正常 Running 狀態，則需要進一步檢查是否正確配置了 kube-dns 服務：

```sh
$ kubectl get svc kube-dns --namespace=kube-system
NAME          CLUSTER-IP     EXTERNAL-IP   PORT(S)             AGE
kube-dns      10.0.0.10      <none>        53/UDP,53/TCP        1h

$ kubectl get ep kube-dns --namespace=kube-system
NAME       ENDPOINTS                       AGE
kube-dns   10.180.3.17:53,10.180.3.17:53    1h
```

如果 kube-dns service 不存在，或者 endpoints 列表為空，則說明 kube-dns service 配置錯誤，可以重新創建 [kube-dns service](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/dns)，比如

```yaml
apiVersion: v1
kind: Service
metadata:
  name: kube-dns
  namespace: kube-system
  labels:
    k8s-app: kube-dns
    kubernetes.io/cluster-service: "true"
    kubernetes.io/name: "KubeDNS"
spec:
  selector:
    k8s-app: kube-dns
  clusterIP: 10.0.0.10
  ports:
  - name: dns
    port: 53
    protocol: UDP
  - name: dns-tcp
    port: 53
    protocol: TCP
```

（3）如果 kube-dns Pod 和 Service 都正常，那麼就需要檢查 kube-proxy 是否正確為 kube-dns 配置了負載均衡的 iptables 規則。具體排查方法可以參考下面的 Service 無法訪問部分。

## DNS解析緩慢

由於內核的一個 [BUG](https://www.weave.works/blog/racy-conntrack-and-dns-lookup-timeouts)，連接跟蹤模塊會發生競爭，導致　DNS　解析緩慢。

臨時[解決方法](https://github.com/kubernetes/kubernetes/issues/56903)：為容器配置 `options single-request-reopen`

```yaml
        lifecycle:
          postStart:
            exec:
              command:
              - /bin/sh
              - -c 
              - "/bin/echo 'options single-request-reopen' >> /etc/resolv.conf"
```

修復方法：升級內核並保證包含以下兩個補丁

1. ["netfilter: nf_conntrack: resolve clash for matching conntracks"](http://patchwork.ozlabs.org/patch/937963/) fixes the 1st race (accepted).
2. ["netfilter: nf_nat: return the same reply tuple for matching CTs"](http://patchwork.ozlabs.org/patch/952939/) fixes the 2nd race (waiting for a review).

其他可能的原因和修復方法還有：

* Kube-dns 和 CoreDNS 同時存在時也會有問題，只保留一個即可。
* kube-dns 或者 CoreDNS 的資源限制太小時會導致 DNS 解析緩慢，這時候需要增大資源限制。

更多 DNS 配置的方法可以參考 [Customizing DNS Service](https://kubernetes.io/docs/tasks/administer-cluster/dns-custom-nameservers/)。

## Service 無法訪問

訪問 Service ClusterIP 失敗時，可以首先確認是否有對應的 Endpoints

```sh
kubectl get endpoints <service-name>
```

如果該列表為空，則有可能是該 Service 的 LabelSelector 配置錯誤，可以用下面的方法確認一下

```sh
# 查詢 Service 的 LabelSelector
kubectl get svc <service-name> -o jsonpath='{.spec.selector}'

# 查詢匹配 LabelSelector 的 Pod
kubectl get pods -l key1=value1,key2=value2
```

如果 Endpoints 正常，可以進一步檢查

* Pod 的 containerPort 與 Service 的 containerPort 是否對應
* 直接訪問 `podIP:containerPort` 是否正常

再進一步，即使上述配置都正確無誤，還有其他的原因會導致 Service 無法訪問，比如

* Pod 內的容器有可能未正常運行或者沒有監聽在指定的 containerPort 上
* CNI 網絡或主機路由異常也會導致類似的問題
* kube-proxy 服務有可能未啟動或者未正確配置相應的 iptables 規則，比如正常情況下名為 `hostnames` 的服務會配置以下 iptables 規則

```sh
$ iptables-save | grep hostnames
-A KUBE-SEP-57KPRZ3JQVENLNBR -s 10.244.3.6/32 -m comment --comment "default/hostnames:" -j MARK --set-xmark 0x00004000/0x00004000
-A KUBE-SEP-57KPRZ3JQVENLNBR -p tcp -m comment --comment "default/hostnames:" -m tcp -j DNAT --to-destination 10.244.3.6:9376
-A KUBE-SEP-WNBA2IHDGP2BOBGZ -s 10.244.1.7/32 -m comment --comment "default/hostnames:" -j MARK --set-xmark 0x00004000/0x00004000
-A KUBE-SEP-WNBA2IHDGP2BOBGZ -p tcp -m comment --comment "default/hostnames:" -m tcp -j DNAT --to-destination 10.244.1.7:9376
-A KUBE-SEP-X3P2623AGDH6CDF3 -s 10.244.2.3/32 -m comment --comment "default/hostnames:" -j MARK --set-xmark 0x00004000/0x00004000
-A KUBE-SEP-X3P2623AGDH6CDF3 -p tcp -m comment --comment "default/hostnames:" -m tcp -j DNAT --to-destination 10.244.2.3:9376
-A KUBE-SERVICES -d 10.0.1.175/32 -p tcp -m comment --comment "default/hostnames: cluster IP" -m tcp --dport 80 -j KUBE-SVC-NWV5X2332I4OT4T3
-A KUBE-SVC-NWV5X2332I4OT4T3 -m comment --comment "default/hostnames:" -m statistic --mode random --probability 0.33332999982 -j KUBE-SEP-WNBA2IHDGP2BOBGZ
-A KUBE-SVC-NWV5X2332I4OT4T3 -m comment --comment "default/hostnames:" -m statistic --mode random --probability 0.50000000000 -j KUBE-SEP-X3P2623AGDH6CDF3
-A KUBE-SVC-NWV5X2332I4OT4T3 -m comment --comment "default/hostnames:" -j KUBE-SEP-57KPRZ3JQVENLNBR
```

## Pod 無法通過 Service 訪問自己

這通常是 hairpin 配置錯誤導致的，可以通過 Kubelet 的 `--hairpin-mode` 選項配置，可選參數包括 "promiscuous-bridge"、"hairpin-veth" 和 "none"（默認為"promiscuous-bridge"）。

對於 hairpin-veth 模式，可以通過以下命令來確認是否生效

```sh
$ for intf in /sys/devices/virtual/net/cbr0/brif/*; do cat $intf/hairpin_mode; done
1
1
1
1
```

而對於 promiscuous-bridge 模式，可以通過以下命令來確認是否生效

```sh
$ ifconfig cbr0 |grep PROMISC
UP BROADCAST RUNNING PROMISC MULTICAST  MTU:1460  Metric:1
```

## 無法訪問 Kubernetes API

很多擴展服務需要訪問 Kubernetes API 查詢需要的數據（比如 kube-dns、Operator 等）。通常在 Kubernetes API 無法訪問時，可以首先通過下面的命令驗證 Kubernetes API 是正常的：

```sh
$ kubectl run curl  --image=appropriate/curl -i -t  --restart=Never --command -- sh
If you don't see a command prompt, try pressing enter.
/ #
/ # KUBE_TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
/ # curl -sSk -H "Authorization: Bearer $KUBE_TOKEN" https://$KUBERNETES_SERVICE_HOST:$KUBERNETES_SERVICE_PORT/api/v1/namespaces/default/pods
{
  "kind": "PodList",
  "apiVersion": "v1",
  "metadata": {
    "selfLink": "/api/v1/namespaces/default/pods",
    "resourceVersion": "2285"
  },
  "items": [
   ...
  ]
 }
```

如果出現超時錯誤，則需要進一步確認名為 `kubernetes` 的服務以及 endpoints 列表是正常的：

```sh
$ kubectl get service kubernetes
NAME         TYPE        CLUSTER-IP   EXTERNAL-IP   PORT(S)   AGE
kubernetes   ClusterIP   10.96.0.1    <none>        443/TCP   25m
$ kubectl get endpoints kubernetes
NAME         ENDPOINTS          AGE
kubernetes   172.17.0.62:6443   25m
```

然後可以直接訪問 endpoints 查看 kube-apiserver 是否可以正常訪問。無法訪問時通常說明 kube-apiserver 未正常啟動，或者有防火牆規則阻止了訪問。

但如果出現了 `403 - Forbidden` 錯誤，則說明 Kubernetes 集群開啟了訪問授權控制（如 RBAC），此時就需要給 Pod 所用的 ServiceAccount 創建角色和角色綁定授權訪問所需要的資源。比如 CoreDNS 就需要創建以下 ServiceAccount 以及角色綁定：

```yaml
# 1. service account
apiVersion: v1
kind: ServiceAccount
metadata:
  name: coredns
  namespace: kube-system
  labels:
      kubernetes.io/cluster-service: "true"
      addonmanager.kubernetes.io/mode: Reconcile
---
# 2. cluster role
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  labels:
    kubernetes.io/bootstrapping: rbac-defaults
    addonmanager.kubernetes.io/mode: Reconcile
  name: system:coredns
rules:
- apiGroups:
  - ""
  resources:
  - endpoints
  - services
  - pods
  - namespaces
  verbs:
  - list
  - watch
---
# 3. cluster role binding
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  annotations:
    rbac.authorization.kubernetes.io/autoupdate: "true"
  labels:
    kubernetes.io/bootstrapping: rbac-defaults
    addonmanager.kubernetes.io/mode: EnsureExists
  name: system:coredns
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: system:coredns
subjects:
- kind: ServiceAccount
  name: coredns
  namespace: kube-system
---
# 4. use created service account
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: coredns
  namespace: kube-system
  labels:
    k8s-app: coredns
    kubernetes.io/cluster-service: "true"
    addonmanager.kubernetes.io/mode: Reconcile
    kubernetes.io/name: "CoreDNS"
spec:
  replicas: 2
  selector:
    matchLabels:
      k8s-app: coredns
  template:
    metadata:
      labels:
        k8s-app: coredns
    spec:
      serviceAccountName: coredns
      ...
```

## 內核導致的問題

除了以上問題，還有可能碰到因內核問題導致的服務無法訪問或者服務訪問超時的錯誤，比如

- [未設置 `--random-fully` 導致無法為 SNAT 分配端口，進而會導致服務訪問超時](https://tech.xing.com/a-reason-for-unexplained-connection-timeouts-on-kubernetes-docker-abd041cf7e02)。注意， Kubernetes 暫時沒有為 SNAT 設置 `--random-fully` 選項，如果碰到這個問題可以參考[這裡](https://gist.github.com/maxlaverse/1fb3bfdd2509e317194280f530158c98) 配置。

## 參考文檔

- [Troubleshoot Applications](https://kubernetes.io/docs/tasks/debug-application-cluster/debug-application/)
- [Debug Services](https://kubernetes.io/docs/tasks/debug-application-cluster/debug-service/)
