# Let's Install kubectl

Ready to get kubectl onto your machine? You've come to the right place.

## How to Install

### For OSX Users

Option one: You can get kubectl on to your OSX machine with one command using Homebrew:

```bash
brew install kubectl
```

Option two: Feel like using `curl` instead? No problem:

```bash
curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/darwin/amd64/kubectl
```

### For Linux Users

Just input the following command:

```bash
curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/amd64/kubectl
```

### For Windows Users

Command one, for good measure:

```bash
curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/windows/amd64/kubectl.exe
```

Or, if you prefer, you can use Chocolatey to install:

```bash
choco install kubernetes-cli
```

## How to Use 

For a deep dive into using kubectl, check out our [kubectl guide](../concepts/components/kubectl.md).

## kubectl Plugins

Ever heard of krew? It's something you can use to manage kubectl plugins.

[krew](https://github.com/kubernetes-sigs/krew) is a handy tool that lets you manage kubectl plugins, sort of like apt or yum. It allows you to search for, install, and manage kubectl plugins.

### Installing krew

Use the following command:

```bash
(
  set -x; cd "$(mktemp -d)" &&
  curl -fsSLO "https://storage.googleapis.com/krew/v0.2.1/krew.{tar.gz,yaml}" &&
  tar zxvf krew.tar.gz &&
  ./krew-"$(uname | tr '[:upper:]' '[:lower:]')_amd64" install \
    --manifest=krew.yaml --archive=krew.tar.gz
)
```

Once you've got it installed, add the krew binary to your PATH:

```bash
export PATH="${KREW_ROOT:-$HOME/.krew}/bin:$PATH"
```

Then, you should be able to verify your install with a kubectl command:

```bash
$ kubectl plugin list
The following kubectl-compatible plugins are available:

/home/<user>/.krew/bin/kubectl-krew
```

### How to Use krew

Before your first use, update the plugin index using the following command:

```bash
kubectl krew update
```

Here's how you can use krew:

```bash
kubectl krew search               # show all plugins
kubectl krew install ssh-jump  # install a plugin named "ssh-jump"
kubectl ssh-jump               # use the plugin
kubectl krew upgrade              # upgrade installed plugins
kubectl krew remove ssh-jump   # uninstall a plugin
```

After you install your plugins, you'll see a list of external tools that the plugin depends on. You'll need to install these manually.

```bash
Installing plugin: ssh-jump
CAVEATS:
\
 |  This plugin needs the following programs:
 |  * ssh(1)
 |  * ssh-agent(1)
 |
 |  Please follow the documentation: https://github.com/yokawasa/kubectl-plugin-ssh-jump
/
Installed plugin: ssh-jump
```

Finally, you can use the plugin by typing `kubectl <plugin-name>`:

```bash
kubectl ssh-jump <node-name> -u <username> -i ~/.ssh/id_rsa -p ~/.ssh/id_rsa.pub
```

### How to Upgrade krew

Here's your command:

```bash
kubectl krew upgrade
```

## Further Reading

* [Here's krew's GitHub page](https://github.com/kubernetes-sigs/krew)