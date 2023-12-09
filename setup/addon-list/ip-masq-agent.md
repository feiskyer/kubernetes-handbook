# ip-masq-agent

The [ip-masq-agent](https://github.com/kubernetes-incubator/ip-masq-agent) is an extension for managing IP masquerading, that is, for managing SNAT (Source Network Address Translation) rules for IP ranges on nodes.

ip-masq-agent configures iptables rules to handle IP masquerading when traffic is sent to destinations outside the Kubernetes cluster nodes. By default, the three private IP ranges defined by RFC 1918 are not masqueraded, which are 10.0.0.0/8, 172.16.0.0/12, and 192.168.0.0/16. Additionally, the link-local address range (169.254.0.0/16) is also considered as a non-masquerade range.

![image-20181014212528267](../../.gitbook/assets/image-20181014212528267%20%282%29.png)

## How to Deploy

Firstly, label the nodes where you want to run ip-masq-agent:

```bash
kubectl label nodes my-node beta.kubernetes.io/masq-agent-ds-ready=true
```

Then deploy the ip-masq-agent:

```bash
kubectl create -f https://raw.githubusercontent.com/kubernetes-incubator/ip-masq-agent/master/ip-masq-agent.yaml
```

After deployment, check the iptables rules, you will find:

```bash
iptables -t nat -L IP-MASQ-AGENT
RETURN     all  --  anywhere             169.254.0.0/16       /* ip-masq-agent: cluster-local traffic should not be subject to MASQUERADE */ ADDRTYPE match dst-type !LOCAL
RETURN     all  --  anywhere             10.0.0.0/8           /* ip-masq-agent: cluster-local traffic should not be subject to MASQUERADE */ ADDRTYPE match dst-type !LOCAL
RETURN     all  --  anywhere             172.16.0.0/12        /* ip-masq-agent: cluster-local traffic should not be subject to MASQUERADE */ ADDRTYPE match dst-type !LOCAL
RETURN     all  --  anywhere             192.168.0.0/16       /* ip-masq-agent: cluster-local traffic should not be subject to MASQUERADE */ ADDRTYPE match dst-type !LOCAL
MASQUERADE  all  --  anywhere             anywhere             /* ip-masq-agent: outbound traffic should be subject to MASQUERADE (this match must come after cluster-local CIDR matches) */ ADDRTYPE match dst-type !LOCAL
```

## How to Use

To customize SNAT ranges:

```bash
cat >config <<EOF
nonMasqueradeCIDRs:
  - 10.0.0.0/8
resyncInterval: 60s
EOF

kubectl create configmap ip-masq-agent --from-file=config --namespace=kube-system
```

By doing so, if you check the iptables rules again, you will see:

```bash
$ iptables -t nat -L IP-MASQ-AGENT
Chain IP-MASQ-AGENT (1 references)
target     prot opt source               destination         
RETURN     all  --  anywhere             169.254.0.0/16       /* ip-masq-agent: cluster-local traffic should not be subject to MASQUERADE */ ADDRTYPE match dst-type !LOCAL
RETURN     all  --  anywhere             10.0.0.0/8           /* ip-masq-agent: cluster-local
MASQUERADE  all  --  anywhere             anywhere             /* ip-masq-agent: outbound traffic should be subject to MASQUERADE (this match must come after cluster-local CIDR matches) */ ADDRTYPE match dst-type !LOCAL
```

## Windows IP Masquerading

While ip-masq-agent is only compatible with Linux, on Windows nodes a similar functionality can be achieved through [CNI configuration](https://github.com/containernetworking/plugins/blob/master/plugins/main/windows/win-bridge/sample-v1.conf) by adding the ranges that should not be SNAT'ed to the `ExceptionList` of the OutBoundNAT policy:

```json
{
  "name": "cbr0",
  "type": "win-bridge",
  "dns": {
    "nameservers": [
      "11.0.0.10"
    ],
    "search": [
      "svc.cluster.local"
    ]
  },
  "policies": [
    {
      "name": "EndpointPolicy",
      "value": {
        "Type": "OutBoundNAT",
        "ExceptionList": [
          "192.168.0.0/16",
          "11.0.0.0/8",
          "10.137.196.0/23"
        ]
      }
    },
    {
      "name": "EndpointPolicy",
      "value": {
        "Type": "ROUTE",
        "DestinationPrefix": "11.0.0.0/8",
        "NeedEncap": true
      }
    },
    {
      "name": "EndpointPolicy",
      "value": {
        "Type": "ROUTE",
        "DestinationPrefix": "10.137.198.27/32",
        "NeedEncap": true
      }
    }
  ],
  "loopbackDSR": true
}
```

--- 

# Unleashing the ip-masq-agent for Kubernetes Networking

**Manage your clusters' IP masquerading like a boss with ip-masq-agent!**

Are you trying to tame the networking beast within your Kubernetes cluster? Look no further than the [ip-masq-agent](https://github.com/kubernetes-incubator/ip-masq-agent), the handy extension designed to manage those sneaky SNAT rules on your nodes!

When you're sending traffic out of the cluster kingdom to foreign lands (read: external destinations), ip-masq-agent steps in like a digital Gandalf and manages IP masquerading for you. It's smart enough to know that some IP ranges—like our good old private IP neighborhoods 10.0.0.0/8, 172.16.0.0/12, and 192.168.0.0/16, and the local alleyway 169.254.0.0/16—don't need masquerading, thanks to the wisdom of RFC 1918.

![The Digital Enchanter](../../.gitbook/assets/image-20181014212528267%20%282%29.png)

## How to Wave Your Magic Wand (Deploy)

First up, mark your loyal nodes to prepare them for the ip-masq-agent's enchantment:

```bash
kubectl label nodes my-node beta.kubernetes.io/masq-agent-ds-ready=true
```

Next, summon the agent into existence with a flick of your command line:

```bash
kubectl create -f https://raw.githubusercontent.com/kubernetes-incubator/ip-masq-agent/master/ip-masq-agent.yaml
```

Once the incantations are complete, double-check your iptables spells with a quick inspection:

```bash
iptables -t nat -L IP-MASQ-AGENT
```

## Tailoring Your Magical Shield (Customization)

Craft your own protective shield by tailoring SNAT sanctuaries:

```bash
cat >config <<EOF
nonMasqueradeCIDRs:
  - 10.0.0.0/8
resyncInterval: 60s
EOF

kubectl create configmap ip-masq-agent --from-file=config --namespace=kube-system
```

After you do this, a peek into the iptables book will show you a streamlined list of protected ranges.

## Windows Wizards Unite!

Linux wizards aren't the only ones with tricks up their sleeves. On Windows nodes, you can pull off similar feats using [CNI configuration](https://github.com/containernetworking/plugins/blob/master/plugins/main/windows/win-bridge/sample-v1.conf). Just add any IP ranges that are to be excused from SNAT into the `ExceptionList` for a flawless masquerade dodge. Check out this neat enchantment:

```json
"policies": [
  {
    "name": "EndpointPolicy",
    "value": {
      "Type": "OutBoundNAT",
      "ExceptionList": [
        "192.168.0.0/16",
        "11.0.0.0/8",
        "10.137.196.0/23"
      ]
    },
  ...
]
```

And there you have it, modern warlocks and witches! With ip-masq-agent at your side, you can navigate the complicated web of Kubernetes networking with the grace and ease of a dragon in flight. Happy masquerading!