# Network Strategies

Network Policy offers policy-based network control designed to isolate applications and reduce the potential attack surface. It emulates traditional segmented networking using label selectors and controls the flow of traffic between them and from external sources. Network plugins are required to monitor these policies and Pod changes, as well as to configure traffic control for Pods.

## How to Develop Network Policy Extensions

To implement a network extension that supports Network Policy, you need at least two components:

- CNI network plugin: Responsible for configuring network interfaces for Pods.
- Policy controller: Monitors changes in Network Policy and applies the policy to the corresponding network interfaces.

![Network Policy Controller](../.gitbook/assets/policy-controller%20%281%29.jpg)

## Network Plugins that Support Network Policy

- [Calico](https://www.projectcalico.org/)
- [Cilium](https://cilium.io/)
- [Romana](https://github.com/romana/romana)
- [Weave Net](https://www.weave.works/)

## How to Use Network Policy

For specific methods of using Network Policy, you can refer [here](../concepts/objects/network-policy.md).

---

# Network Strategies

Imagine creating virtual barriers within a digital ecosystem to keep your applications secure – this is what Network Policy does. It acts as a digital traffic cop, guiding data packets, ensuring only the right information flows between different segments of your network and that unwanted traffic stays out. It’s like putting up invisible walls within the cyberworld, with doors that only open for the right keyholders. Network plugins play a vital role here; they keep an eye on policy shifts and make sure pods toe the line of these virtual road rules.

## Crafting Extensions for Network Policy

So you want to build an add-on that makes Network Policy even smarter? Gear up! You’ll need a duo of essential tools:

- **CNI network plugin:** Think of it as the architect, setting up the network structure for each pod.
- **Policy controller:** This one’s the guard, staying alert to any policy changes and making sure they're enforced where they matter.

![Network Policy Controller](../.gitbook/assets/policy-controller%20%281%29.jpg)

## The Techie Dream Team Supporting Network Policy

Ready to computerize your network’s immune system? Here are the guardians of the digital galaxy:

- [Calico](https://www.projectcalico.org/) - the network whisperer
- [Cilium](https://cilium.io/) - the Kubernetes knight
- [Romana](https://github.com/romana/romana) - the command-line conqueror
- [Weave Net](https://www.weave.works/) - the weave wizard

## Network Policy: The How-To Magic Book

Wanna know how to wield these powers for your network? The secrets are within reach [right here](../concepts/objects/network-policy.md).