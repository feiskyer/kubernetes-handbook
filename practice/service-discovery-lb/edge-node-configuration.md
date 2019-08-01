# 邊緣節點配置

## 前言

為了配置kubernetes中的traefik ingress的高可用，對於kubernetes集群以外只暴露一個訪問入口，需要使用keepalived排除單點問題。本文參考了[kube-keepalived-vip](https://github.com/kubernetes/contrib/tree/master/keepalived-vip)，但並沒有使用容器方式安裝，而是直接在node節點上安裝。

## 定義

首先解釋下什麼叫邊緣節點（Edge Node），所謂的邊緣節點即集群內部用來向集群外暴露服務能力的節點，集群外部的服務通過該節點來調用集群內部的服務，邊緣節點是集群內外交流的一個Endpoint。

**邊緣節點要考慮兩個問題**

- 邊緣節點的高可用，不能有單點故障，否則整個kubernetes集群將不可用
- 對外的一致暴露端口，即只能有一個外網訪問IP和端口

## 架構

為了滿足邊緣節點的以上需求，我們使用[keepalived](http://www.keepalived.org/)來實現。

在Kubernetes集群外部配置nginx來訪問邊緣節點的VIP。

選擇Kubernetes的三個node作為邊緣節點，並安裝keepalived。

![邊緣節點架構](images/node-edge-arch.jpg)

## 準備

複用kubernetes測試集群的三臺主機。

172.20.0.113

172.20.0.114

172.20.0.115

## 安裝

使用keepalived管理VIP，VIP是使用IPVS創建的，[IPVS](http://www.linux-vs.org)已經成為linux內核的模塊，不需要安裝

LVS的工作原理請參考：http://www.cnblogs.com/codebean/archive/2011/07/25/2116043.html

不使用鏡像方式安裝了，直接手動安裝，指定三個節點為邊緣節點（Edge node）。

因為我們的測試集群一共只有三個node，所有在在三個node上都要安裝keepalived和ipvsadmin。

```Shell
yum install keepalived ipvsadm
```

## 配置說明

需要對原先的traefik ingress進行改造，從以Deployment方式啟動改成DeamonSet。還需要指定一個與node在同一網段的IP地址作為VIP，我們指定成172.20.0.119，配置keepalived前需要先保證這個IP沒有被分配。。

- Traefik以DaemonSet的方式啟動
- 通過nodeSelector選擇邊緣節點
- 通過hostPort暴露端口
- 當前VIP漂移到了172.20.0.115上
- Traefik根據訪問的host和path配置，將流量轉發到相應的service上

## 配置keepalived

參考[基於keepalived 實現VIP轉移，lvs，nginx的高可用](http://limian.blog.51cto.com/7542175/1301776)，配置keepalived。

keepalived的官方配置文檔見：http://keepalived.org/pdf/UserGuide.pdf

配置文件`/etc/keepalived/keepalived.conf`文件內容如下：

```
! Configuration File for keepalived

global_defs {
   notification_email {
     root@localhost
   }
   notification_email_from kaadmin@localhost
   smtp_server 127.0.0.1
   smtp_connect_timeout 30
   router_id LVS_DEVEL
}

vrrp_instance VI_1 {
    state MASTER
    interface eth0
    virtual_router_id 51
    priority 100
    advert_int 1
    authentication {
        auth_type PASS
        auth_pass 1111
    }
    virtual_ipaddress {
        172.20.0.119
    }
}

virtual_server 172.20.0.119 80{
    delay_loop 6
    lb_algo loadbalance
    lb_kind DR
    nat_mask 255.255.255.0
    persistence_timeout 0
    protocol TCP

    real_server 172.20.0.113 80{
        weight 1
        TCP_CHECK {
        connect_timeout 3
        }
    }
    real_server 172.20.0.114 80{
        weight 1
        TCP_CHECK {
        connect_timeout 3
        }
    }
    real_server 172.20.0.115 80{
        weight 1
        TCP_CHECK {
        connect_timeout 3
        }
    }
}
```

`Realserver`的IP和端口即traefik供外網訪問的IP和端口。

將以上配置分別拷貝到另外兩臺node的`/etc/keepalived`目錄下。

我們使用轉發效率最高的`lb_kind DR`直接路由方式轉發，使用TCP_CHECK來檢測real_server的health。

**啟動keepalived**

```
systemctl start keepalived
```

三臺node都啟動了keepalived後，觀察eth0的IP，會在三臺node的某一臺上發現一個VIP是172.20.0.119。

```bash
$ ip addr show eth0
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP qlen 1000
    link/ether f4:e9:d4:9f:6b:a0 brd ff:ff:ff:ff:ff:ff
    inet 172.20.0.115/17 brd 172.20.127.255 scope global eth0
       valid_lft forever preferred_lft forever
    inet 172.20.0.119/32 scope global eth0
       valid_lft forever preferred_lft forever
```

關掉擁有這個VIP主機上的keepalived，觀察VIP是否漂移到了另外兩臺主機的其中之一上。

## 改造Traefik

在這之前我們啟動的traefik使用的是deployment，只啟動了一個pod，無法保證高可用（即需要將pod固定在某一臺主機上，這樣才能對外提供一個唯一的訪問地址），現在使用了keepalived就可以通過VIP來訪問traefik，同時啟動多個traefik的pod保證高可用。

配置文件`traefik.yaml`內容如下：

```Yaml
apiVersion: extensions/v1beta1
kind: DaemonSet
metadata:
  name: traefik-ingress-lb
  namespace: kube-system
  labels:
    k8s-app: traefik-ingress-lb
spec:
  template:
    metadata:
      labels:
        k8s-app: traefik-ingress-lb
        name: traefik-ingress-lb
    spec:
      terminationGracePeriodSeconds: 60
      hostNetwork: true
      restartPolicy: Always
      serviceAccountName: ingress
      containers:
      - image: traefik
        name: traefik-ingress-lb
        resources:
          limits:
            cpu: 200m
            memory: 30Mi
          requests:
            cpu: 100m
            memory: 20Mi
        ports:
        - name: http
          containerPort: 80
          hostPort: 80
        - name: admin
          containerPort: 8580
          hostPort: 8580
        args:
        - --web
        - --web.address=:8580
        - --kubernetes
      nodeSelector:
        edgenode: "true"
```

注意，我們使用了`nodeSelector`選擇邊緣節點來調度traefik-ingress-lb運行在它上面，所有你需要使用：

```
kubectl label nodes 172.20.0.113 edgenode=true
kubectl label nodes 172.20.0.114 edgenode=true
kubectl label nodes 172.20.0.115 edgenode=true
```

給三個node打標籤。

查看DaemonSet的啟動情況：

```Bash
$ kubectl -n kube-system get ds
NAME                 DESIRED   CURRENT   READY     UP-TO-DATE   AVAILABLE   NODE-SELECTOR                              AGE
traefik-ingress-lb   3         3         3         3            3           edgenode=true                              2h
```

現在就可以在外網通過172.20.0.119:80來訪問到traefik ingress了。

## 參考

[kube-keepalived-vip](https://github.com/kubernetes/contrib/tree/master/keepalived-vip)

http://www.keepalived.org/

[keepalived工作原理與配置說明](http://outofmemory.cn/wiki/keepalived-configuration)

[LVS簡介及使用](http://www.cnblogs.com/codebean/archive/2011/07/25/2116043.html)

[基於keepalived 實現VIP轉移，lvs，nginx的高可用](http://limian.blog.51cto.com/7542175/1301776)