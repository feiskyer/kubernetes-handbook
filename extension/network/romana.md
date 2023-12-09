# Romana

Romana is an open-source project introduced by Panic Networks in 2016, designed to tackle the overhead introduced by Overlay networking solutions.

## Kubernetes Deployment

For Kubernetes clusters deployed with kubeadm:

```bash
kubectl apply -f https://raw.githubusercontent.com/romana/romana/master/docs/kubernetes/romana-kubeadm.yml
```

For Kubernetes clusters deployed with kops:

```bash
kubectl apply -f https://raw.githubusercontent.com/romana/romana/master/docs/kubernetes/romana-kops.yml
```

When using kops, note:

* Set network plugin to CNI with `--networking cni`
* For aws, additional `romana-aws` and `romana-vpcrouter` are available to automatically configure routing between Nodes and Zones

## How It Works

![](../../.gitbook/assets/romana%20%282%29.png)

![](../../.gitbook/assets/routeagg%20%282%29.png)

* Layer 3 networking reduces the overhead from overlays
* Network isolation based on iptables ACLs
* Hierarchy CIDR management for Host/Tenant/Segment ID

![](../../.gitbook/assets/cidr%20%282%29.png)

## Advantages

* Pure layer 3 networking, better performance

## Disadvantages

* Tenant management based on IP has scalability limitations
* Modifications to physical devices or address planning are cumbersome

**Reference Documents**

* [http://romana.io/](http://romana.io/)
* [Romana basics](http://romana.io/how/romana_basics/)
* [Romana Github](https://github.com/romana/romana)
* [Romana 2.0](http://romana.readthedocs.io/en/latest/index.html)

---

# Unleashing Romana: A Network Efficiency Game-Changer

Welcome to Romana, Panic Networks' brainchild and open-source marvel born in 2016, with a singular mission: slashing the hefty overhead that comes with Overlay networking solutions.

## Elevating Kubernetes Deployment

Are you navigating the Kubernetes seas with kubeadm? Cast this digital net:

```bash
kubectl apply -f https://raw.githubusercontent.com/romana/romana/master/docs/kubernetes/romana-kubeadm.yml
```

Or are you charting your course with kops? Here's your map:

```bash
kubectl apply -f https://raw.githubusercontent.com/romana/romana/master/docs/kubernetes/romana-kops.yml
```

Charting with kops? Take heed:

* Choose CNI as your trusted companion with `--networking cni`
* For aws explorers, `romana-aws` and `romana-vpcrouter` are your guides to seamless Node and Zone route configurations

## The Magic Under the Hood

![](../../.gitbook/assets/romana%20%282%29.png)

![](../../.gitbook/assets/routeagg%20%282%29.png)

* Layer 3 networking is the secret sauce, cutting down those pesky overlay costs
* iptables ACLs stand guard, ensuring your network's isolation
* The CIDR hierarchy reigns over Hosts, Tenants, and Segments with ease

![](../../.gitbook/assets/cidr%20%282%29.png)

## The Perks

* Immerse yourself in the efficiency of pure layer 3 networking

## The Quirks

* An IP-based tenant ledger can fill up; beware the scale ceiling
* Gear shifts in the physical realm or rerouting your address plan? A bit of a tangle

**Decoding the References**

* Discover Romana's realm: [http://romana.io/](http://romana.io/)
* The ABCs of Romana: [Romana basics](http://romana.io/how/romana_basics/)
* Romana's Github sanctuary: [Romana Github](https://github.com/romana/romana)
* Meet Romana 2.0: [Romana 2.0](http://romana.readthedocs.io/en/latest/index.html)