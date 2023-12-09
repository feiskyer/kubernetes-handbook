# Edge Node Configuration

## Introduction

To establish a high-availability setup for traefik ingress in Kubernetes and expose only a single access point outside of the Kubernetes cluster, it is necessary to use keepalived to eliminate any single point of failure. This article references [kube-keepalived-vip](https://github.com/kubernetes/contrib/tree/master/keepalived-vip) but deviates from the containerized installation method, opting instead for direct installation on node hosts.

## Definition

First, let’s clarify what an Edge Node is. An Edge Node is a node within the cluster that exposes services to the outside of the cluster. Services outside of the cluster communicate with services inside via this node. The Edge Node is an Endpoint for interactions between the internal and external aspects of the cluster.

**There are two main considerations for Edge Nodes:**

- High availability of Edge Nodes to avoid a single point of failure, which could render the entire Kubernetes cluster unusable.
- A consistent external service exposure, meaning there can only be one external IP address and port for accessing services.

## Architecture

To meet the above needs of an Edge Node, we utilize [keepalived](http://www.keepalived.org/).

An Nginx server is set up outside of the Kubernetes cluster to access the VIP of the Edge Node.

Three Kubernetes node hosts are chosen as Edge Nodes, with keepalived installed on them.

![Edge Node Architecture](images/node-edge-arch.jpg)

## Preparation

Reuse three existing hosts from the Kubernetes test cluster:

172.20.0.113

172.20.0.114

172.20.0.115

## Installation

VIP management is handled by keepalived, which is created using IPVS. [IPVS](http://www.linux-vs.org) is already a module in the Linux kernel and does not require installation.

For details on how LVS works, refer to: http://www.cnblogs.com/codebean/archive/2011/07/25/2116043.html

Keepalived and ipvsadmin are manually installed rather than using a containerized approach, designating three nodes as Edge Nodes.

As our test cluster only has three nodes in total, keepalived and ipvsadmin need to be installed on all three nodes.

```Shell
yum install keepalived ipvsadm
```

## Configuration Details

The pre-existing traefik ingress needs modification, changing from being started as a Deployment to being run as a DaemonSet. An IP address within the same subnet as the node needs to be designated as the VIP. We have chosen 172.20.0.119. Before configuring keepalived, it is important to ensure this IP is not already in use.

- Traefik starts as a DaemonSet
- Edge Nodes are selected using nodeSelector
- Ports are exposed using hostPort
- The current VIP has moved to 172.20.0.115
- Traefik forwards traffic to the corresponding service based on the accessed host and path configuration

## Configuring keepalived

Follow the guide [VIP transfer, LVS, and high availability for nginx based on keepalived](http://limian.blog.51cto.com/7542175/1301776) to set up keepalived.

For the official documentation of keepalived configuration, see: http://keepalived.org/pdf/UserGuide.pdf

The content of the configuration file `/etc/keepalived/keepalived.conf` is as follows:

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

The IP and port marked as `Realserver` are the ones through which traefik is accessible from the outside.

Copy the configurations to the `/etc/keepalived` directory of the other two nodes.

The `lb_kind DR` method, which stands for Direct Routing, offers the highest forwarding efficiency; health checks on the `real_server` are performed using TCP_CHECK.

**Starting keepalived**

```
systemctl start keepalived
```

After keepalived has been started on all three nodes, you can observe that a VIP, 172.20.0.119, will appear on the `eth0` interface of one of the nodes.

```bash
$ ip addr show eth0
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP qlen 1000
    link/ether f4:e9:d4:9f:6b:a0 brd ff:ff:ff:ff:ff:ff
    inet 172.20.0.115/17 brd 172.20.127.255 scope global eth0
       valid_lft forever preferred_lft forever
    inet 172.20.0.119/32 scope global eth0
       valid_lft forever preferred_lft forever
```

Disable keepalived on the host that has this VIP and observe whether the VIP moves to one of the other two hosts.

## Traefik Makeover

Previously, our traefik was initiated using deployment, starting only one pod, which does not ensure high availability (the pod had to be fixed on a particular host to provide a unique external access address). Now, with keepalived, we can access traefik via VIP, and starting multiple traefik pods will ensure high availability.

The content of the configuration file `traefik.yaml` is as follows:

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

Note that `nodeSelector` is used to schedule the traefik-ingress-lb to run on the Edge Nodes, so you need to label the three nodes by executing:

```
kubectl label nodes 172.20.0.113 edgenode=true
kubectl label nodes 172.20.0.114 edgenode=true
kubectl label nodes 172.20.0.115 edgenode=true
```

to tag the three nodes.

To see the DaemonSet's startup status:

```Bash
$ kubectl -n kube-system get ds
NAME                 DESIRED   CURRENT   READY     UP-TO-DATE   AVAILABLE   NODE-SELECTOR                              AGE
traefik-ingress-lb   3         3         3         3            3           edgenode=true                              2h
```

Now, Traefik ingress can be accessed via 172.20.0.119:80 from the internet.

## References

[kube-keepalived-vip](https://github.com/kubernetes/contrib/tree/master/keepalived-vip)

http://www.keepalived.org/

[Keepalived Theory of Operation and Configuration Guide](http://outofmemory.cn/wiki/keepalived-configuration)

[An Introduction to LVS and its Usage](http://www.cnblogs.com/codebean/archive/2011/07/25/2116043.html)

[High Availability VIP Transfer, LVS, Nginx Based on Keepalived](http://limian.blog.51cto.com/7542175/1301776)