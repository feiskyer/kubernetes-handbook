# Unlocking the Kubernetes Dashboard with Basic Authentication

## Crafting Your Secret Key for Auth

```sh
$ htpasswd -c auth foo
New password: <bar>
New password:
Re-type new password:
Adding password for user foo

$ kubectl -n kube-system create secret generic basic-auth --from-file=auth
secret "basic-auth" created
```

Let's embark on a digital locksmith's journey! To secure your Kubernetes Dashboard, we begin by creating a secret key that safeguards your portal with basic authentication. Picture yourself like a spy setting up an access code for your high-tech control panel.

First, you'll conjure a secret passcode using the `htpasswd` tool, casting a spell with a magic word `<bar>` (that's your chosen password, shhh... keep it under wraps!). Type it once, twice for the incantation to stick, and voila! User `foo` now has a password.

Then, with a wave of your wand (or in muggle terms, the command line), deploy this newly crafted secret into the Kubernetes magical realm (the `kube-system` namespace, to be precise) using `kubectl`.

## Unfurling the Dashboard's Gateway

```sh
kubectl apply -f https://raw.githubusercontent.com/feiskyer/kubernetes-handbook/master/manifests/ingress-nginx/dashboard/dashboard-ingress.yaml
```

As we move to the second act of wizardry, it's time to bridge the gap between the digital fortress and the mortal world. With the aforementioned incantation, you'll conjure up the ingress that serves as a portal, allowing you to access the Kubernetes Dashboard with the security of your freshly minted password.

Invoke the command above, and the ingress configuration will cascade from the ethers of the internet, specifically from the tome of knowledge authored by the sage `feiskyer` in their GitHub repository. This spell links the virtual components with an ethereal bridge, ensuring that only those in possession of the secret key can cross into the sanctum of your Dashboard.

And with that, your Kubernetes Dashboard is clothed in an armor of basic authentication, ready to serve you in your quest to manage containers with the ease and poise of a grand sorcerer.