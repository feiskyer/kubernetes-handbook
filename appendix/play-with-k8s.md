# Play with Kubernetes

Looking for a free hands-on experience with Kubernetes? [Play with Kubernetes](http://play-with-k8s.com) offers exactly that, a free Kubernetes sandbox environment where each cluster that you create is yours to use and explore for up to four hours.

## Setting up Your Cluster

Tube into [play-with-k8s.com](http://play-with-k8s.com), click on "ADD NEW INSTANCE," and in the TERMINAL of new INSTANCE (let's call it node1), initialize the kubernetes master like so:

```sh
kubeadm init --apiserver-advertise-address $(hostname -i)
```

The subsequent lines are just the machine waking up, dusting off its shoes, and setting up a Kubernetes authoritative server on your behalf. It's doing a bunch of nerdy stuff like generating certificates, tokens, setting up configurations, and then does a little victory dance once the hypothetical red ribbon has been cut.

> Take note: You're going to need this line of code `kubeadm join --token 35e301.77277e7cafee013c 10.0.1.3:6443` later on. It's like your open sesame when you want to add new nodes.

## Configuring kubectl

Before telling kubectl what to do, you'll need to tell it where stuff is. That's what the following script does:

```sh
mkdir -p $HOME/.kube
cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
chown $(id -u):$(id -g) $HOME/.kube/config
```

## Initiating Network

Time to get the ball rolling with this command:

```sh
kubectl apply -n kube-system -f "https://cloud.weave.works/k8s/net?k8s-version=$(kubectl version | base64 | tr -d '\n')"
```

## Building Dashboard

Next, you will create your dashboard. Kind of like your mission control for the Kubernetes universe you're building.

```sh
curl -L -s https://raw.githubusercontent.com/kubernetes/dashboard/v1.10.1/src/deploy/recommended/kubernetes-dashboard.yaml  | sed 's/targetPort: 9090/targetPort: 9090\n  type: LoadBalancer/' | kubectl apply -f -
```

Give it a little time to actualize. You will then see the Dashboard service's port number at the top of the page. Click it, and you are now in the Dashboard's page.

## Adding New Nodes

Ready to expand your universe? Click "ADD NEW INSTANCE" again, and in the TERMINAL of the new INSTANCE, enter the magical `kubeadm join` command we set aside from the first step.

```sh
kubeadm join --token 35e301.77277e7cafee013c 10.0.1.3:6443
```

Once done, head back to the TERMINAL of node1 and enter `kubectl get node`. This displays the status of all your nodes. Give them some time to get all their ducks in a row (or rather, for their status to turn to Ready). Once they're all ready to roll, congrats! You now have a full-blown Kubernetes cluster up and flying. Enjoy experimenting!
