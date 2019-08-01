# ip-masq-agent

[ip-masq-agent](https://github.com/kubernetes-incubator/ip-masq-agent) 是一個用來管理 IP 偽裝的擴展，即管理節點中 IP 網段的 SNAT 規則。

ip-masq-agent 配置 iptables 規則，以便將流量發送到集群節點之外的目標時處理 IP 偽裝。默認情況下，RFC 1918 定一個的三個私有 IP 範圍是非偽裝網段，即 10.0.0.0/8、172.16.0.0/12 和 192.168.0.0/16。另外，鏈接本地地址（169.254.0.0/16）也被視為非偽裝網段。

![image-20181014212528267](assets/image-20181014212528267.png)

## 部署方法

首先，標記要運行 ip-masq-agent 的 Node

```sh
kubectl label nodes my-node beta.kubernetes.io/masq-agent-ds-ready=true
```

然後部署 ip-masq-agent：

```sh
kubectl create -f https://raw.githubusercontent.com/kubernetes-incubator/ip-masq-agent/master/ip-masq-agent.yaml
```

部署好，查看 iptables 規則，可以發現

```sh
iptables -t nat -L IP-MASQ-AGENT
RETURN     all  --  anywhere             169.254.0.0/16       /* ip-masq-agent: cluster-local traffic should not be subject to MASQUERADE */ ADDRTYPE match dst-type !LOCAL
RETURN     all  --  anywhere             10.0.0.0/8           /* ip-masq-agent: cluster-local traffic should not be subject to MASQUERADE */ ADDRTYPE match dst-type !LOCAL
RETURN     all  --  anywhere             172.16.0.0/12        /* ip-masq-agent: cluster-local traffic should not be subject to MASQUERADE */ ADDRTYPE match dst-type !LOCAL
RETURN     all  --  anywhere             192.168.0.0/16       /* ip-masq-agent: cluster-local traffic should not be subject to MASQUERADE */ ADDRTYPE match dst-type !LOCAL
MASQUERADE  all  --  anywhere             anywhere             /* ip-masq-agent: outbound traffic should be subject to MASQUERADE (this match must come after cluster-local CIDR matches) */ ADDRTYPE match dst-type !LOCAL
```

## 使用方法

自定義 SNAT 網段的方法：

```sh
cat >config <<EOF
nonMasqueradeCIDRs:
  - 10.0.0.0/8
resyncInterval: 60s
EOF

kubectl create configmap ip-masq-agent --from-file=config --namespace=kube-system
```

這樣，查看 iptables 規則可以發現

```sh
$ iptables -t nat -L IP-MASQ-AGENT
Chain IP-MASQ-AGENT (1 references)
target     prot opt source               destination         
RETURN     all  --  anywhere             169.254.0.0/16       /* ip-masq-agent: cluster-local traffic should not be subject to MASQUERADE */ ADDRTYPE match dst-type !LOCAL
RETURN     all  --  anywhere             10.0.0.0/8           /* ip-masq-agent: cluster-local
MASQUERADE  all  --  anywhere             anywhere             /* ip-masq-agent: outbound traffic should be subject to MASQUERADE (this match must come after cluster-local CIDR matches) */ ADDRTYPE match dst-type !LOCAL
```

