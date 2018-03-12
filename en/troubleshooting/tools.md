# Tools for Troubleshooting

This chapter is about tools for troubleshooting kubernetes.

## Essential tools

- kubectl: for interacting with kubernetes cluster
- journalctl：for viewing logs
- iptables：for debugging service problems
- tcpdump：for debugging network problems

## sysdig

[sysdig](https://www.sysdig.org/) is a container troubleshooting tools, which provides both opensource and commercial products. For regular troubleshooting, I believe opensourced version is enough.

On top of sysdig, you can also use csysdig and [sysdig-inspect](https://github.com/draios/sysdig-inspect) as command line interface and GUI.

### Setup

```sh
# on Linux
curl -s https://s3.amazonaws.com/download.draios.com/stable/install-sysdig | sudo bash

# on MacOS
brew install sysdig
```

### Examples

```sh
# Refer https://www.sysdig.org/wiki/sysdig-examples/.
# View the top network connections for a single container
sysdig -pc -c topconns

# Show the network data exchanged with the host 192.168.0.1
sysdig -s2000 -A -c echo_fds fd.cip=192.168.0.1

# List all the incoming connections that are not served by apache.
sysdig -p"%proc.name %fd.name" "evt.type=accept and proc.name!=httpd"

# View the CPU/Network/IO usage of the processes running inside the container.
sysdig -pc -c topprocs_cpu container.id=2e854c4525b8
sysdig -pc -c topprocs_net container.id=2e854c4525b8
sysdig -pc -c topfiles_bytes container.id=2e854c4525b8

# See the files where apache spends the most time doing I/O
sysdig -c topfiles_time proc.name=httpd

# Show all the interactive commands executed inside a given container.
sysdig -pc -c spy_users

# Show every time a file is opened under /etc.
sysdig evt.type=open and fd.name
```

## Weave Scope

Weave Scope is another container monitoring and troubleshooting tool. Compared to sysdig, it provides a simple GUI which describes the entire topology of the cluster.

Weave Scope consists of two components: the app and the probe. The components are deployed as a single Docker container using the scope script. The probe is responsible for gathering information about the host on which it is running. This information is sent to the app in the form of a report. The app processes reports from the probe into usable topologies, serving the UI, as well as pushing these topologies to the UI.

```sh
                    +--Docker host----------+      +--Docker host----------+
.---------------.   |  +--Container------+  |      |  +--Container------+  |
| Browser       |   |  |                 |  |      |  |                 |  |
|---------------|   |  |  +-----------+  |  |      |  |  +-----------+  |  |
|               |----->|  | scope-app |<-----.    .----->| scope-app |  |  |
|               |   |  |  +-----------+  |  | \  / |  |  +-----------+  |  |
|               |   |  |        ^        |  |  \/  |  |        ^        |  |
'---------------'   |  |        |        |  |  /\  |  |        |        |  |
                    |  | +-------------+ |  | /  \ |  | +-------------+ |  |
                    |  | | scope-probe |-----'    '-----| scope-probe | |  |
                    |  | +-------------+ |  |      |  | +-------------+ |  |
                    |  |                 |  |      |  |                 |  |
                    |  +-----------------+  |      |  +-----------------+  |
                    +-----------------------+      +-----------------------+
```

### Setup

```sh
kubectl apply -f "https://cloud.weave.works/k8s/scope.yaml?k8s-version=$(kubectl version | base64 | tr -d '\n')&k8s-service-type=LoadBalancer"
```

### Access GUI

```sh
kubectl -n weave get service weave-scope-app
```

![](images/weave-scope.png)

Pod details

![](images/scope-pod.png)

## References

- [Overview of kubectl](https://kubernetes.io/docs/reference/kubectl/overview/)
- [Monitoring Kuberietes with sysdig](https://sysdig.com/blog/kubernetes-service-discovery-docker/)
