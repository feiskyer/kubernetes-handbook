# CNI Plugin Chains

CNI还支持Plugin Chains，即指定一个插件列表，由Runtime依次执行每个插件。这对支持portmapping、vm等非常有帮助。

## Network Configuration Lists

[CNI SPEC](https://github.com/containernetworking/cni/blob/master/SPEC.md#network-configuration-lists)支持指定网络配置列表，包含多个网络插件，由Runtime依次执行。注意

* ADD操作，按顺序依次调用每个插件；而DEL操作调用顺序相反
* ADD操作，除最后一个插件，前面每个插件需要增加`prevResult`传递给其后的插件
* 第一个插件必须要包含ipam插件 

## 示例

```
# cat /root/mynet.conflist
{
  "name": "mynet",
  "cniVersion": "0.3.0",
  "plugins": [
    {
      "type": "bridge",
      "bridge": "mynet",
      "ipMasq": true,
      "isGateway": true,
      "ipam": {
      "type": "host-local",
      "subnet": "10.244.10.0/24",
      "routes": [
          { "dst": "0.0.0.0/0"  }
      ]
      }
    },
    {
       "type": "portmap",
       "capabilities": {"portMappings": true}
    }
  ]
}
```

```
# export CAP_ARGS='{
    "portMappings": [
        {
            "hostPort":      9090,
            "containerPort": 80,
            "protocol":      "tcp",
            "hostIP":        "127.0.0.1"
        }
    ]
}'

# ip netns add test
# CNI_PATH=/opt/cni/bin NETCONFPATH=/root ./cnitool add mynet /var/run/netns/test
{
    "interfaces": [
        {
            "name": "mynet",
            "mac": "0a:58:0a:f4:0a:01"
        },
        {
            "name": "veth2cfb1d64",
            "mac": "4a:dc:1f:b7:56:b1"
        },
        {
            "name": "eth0",
            "mac": "0a:58:0a:f4:0a:07",
            "sandbox": "/var/run/netns/test"
        }
    ],
    "ips": [
        {
            "version": "4",
            "interface": 2,
            "address": "10.244.10.7/24",
            "gateway": "10.244.10.1"
        }
    ],
    "routes": [
        {
            "dst": "0.0.0.0/0"
        }
    ],
    "dns": {}
}
```

```
# iptables-save | grep 10.244.10.7
-A CNI-DN-be1eedf7a76853f303ebd -d 127.0.0.1/32 -p tcp -m tcp --dport 9090 -j DNAT --to-destination 10.244.10.7:80
-A CNI-SN-be1eedf7a76853f303ebd -s 127.0.0.1/32 -d 10.244.10.7/32 -p tcp -m tcp --dport 80 -j MASQUERADE
```

```
# CNI_PATH=/opt/cni/bin NETCONFPATH=/root ./cnitool del mynet /var/run/netns/test
```

## 相关PR

* https://github.com/containernetworking/cni/pull/440
* https://github.com/containernetworking/plugins/pull/1
* https://github.com/kubernetes/kubernetes/pull/42202 (merged)
* https://github.com/containernetworking/cni/pull/420
* https://github.com/containernetworking/cni/pull/420
