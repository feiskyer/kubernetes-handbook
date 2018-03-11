# OVN Kubernetes

[ovn-kubernetes](https://github.com/openvswitch/ovn-kubernetes)提供了一个ovs OVN网络插件，支持underlay和overlay两种模式。

- underlay：容器运行在虚拟机中，而ovs则运行在虚拟机所在的物理机上，OVN将容器网络和虚拟机网络连接在一起
- overlay：OVN通过logical overlay network连接所有节点的容器，此时ovs可以直接运行在物理机或虚拟机上

## Overlay模式

![](images/ovn-kubernetes.png)

(图片来自<https://imgur.com/i7sci9O>)

### 配置master

```
ovs-vsctl set Open_vSwitch . external_ids:k8s-api-server="127.0.0.1:8080"
ovn-k8s-overlay master-init \
  --cluster-ip-subnet="192.168.0.0/16" \
  --master-switch-subnet="192.168.1.0/24" \
  --node-name="kube-master"
```

### 配置Node

```
ovs-vsctl set Open_vSwitch . \
  external_ids:k8s-api-server="$K8S_API_SERVER_IP:8080"

ovs-vsctl set Open_vSwitch . \
  external_ids:k8s-api-server="https://$K8S_API_SERVER_IP" \
  external_ids:k8s-ca-certificate="$CA_CRT" \
  external_ids:k8s-api-token="$API_TOKEN"

ovn-k8s-overlay minion-init \
  --cluster-ip-subnet="192.168.0.0/16" \
  --minion-switch-subnet="192.168.2.0/24" \
  --node-name="kube-minion1"
```

### 配置网关Node (可以用已有的Node或者单独的节点)

选项一：外网使用单独的网卡`eth1`

```sh
ovs-vsctl set Open_vSwitch . \
  external_ids:k8s-api-server="$K8S_API_SERVER_IP:8080"
ovn-k8s-overlay gateway-init \
  --cluster-ip-subnet="192.168.0.0/16" \
  --physical-interface eth1 \
  --physical-ip 10.33.74.138/24 \
  --node-name="kube-minion2" \
  --default-gw 10.33.74.253
```

选项二：外网网络和管理网络共享同一个网卡，此时需要将该网卡添加到网桥中，并迁移IP和路由

```sh
# attach eth0 to bridge breth0 and move IP/routes
ovn-k8s-util nics-to-bridge eth0

# initialize gateway
ovs-vsctl set Open_vSwitch . \
  external_ids:k8s-api-server="$K8S_API_SERVER_IP:8080"
ovn-k8s-overlay gateway-init \
  --cluster-ip-subnet="$CLUSTER_IP_SUBNET" \
  --bridge-interface breth0 \
  --physical-ip "$PHYSICAL_IP" \
  --node-name="$NODE_NAME" \
  --default-gw "$EXTERNAL_GATEWAY"

# Since you share a NIC for both mgmt and North-South connectivity, you will 
# have to start a separate daemon to de-multiplex the traffic.
ovn-k8s-gateway-helper --physical-bridge=breth0 --physical-interface=eth0 \
    --pidfile --detach
```

### 启动ovn-k8s-watcher

ovn-k8s-watcher监听Kubernetes事件，并创建逻辑端口和负载均衡。

```
ovn-k8s-watcher \
  --overlay \
  --pidfile \
  --log-file \
  -vfile:info \
  -vconsole:emer \
  --detach
```

### CNI插件原理

#### ADD操作

- 从`ovn` annotation获取ip/mac/gateway
- 在容器netns中配置接口和路由
- 添加ovs端口

```sh
ovs-vsctl add-port br-int veth_outside \
  --set interface veth_outside \
    external_ids:attached_mac=mac_address \
    external_ids:iface-id=namespace_pod \
    external_ids:ip_address=ip_address
```

#### DEL操作

```sh
ovs-vsctl del-port br-int port
```

## Underlay模式

暂未实现。

## 参考文档

- <https://github.com/openvswitch/ovn-kubernetes>
