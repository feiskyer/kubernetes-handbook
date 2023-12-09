# Certificate Rotation

## Checking Certificate Expiration

```bash
# For kubeadm provisioned clusters
kubeadm alpha certs check-expiration

# For all clusters
openssl x509 -noout -dates -in /etc/kubernetes/pki/apiserver.crt
```

## Updating Expiration Dates

Depending on the type of cluster, there are several methods to update the expiration dates of certificates (choose any one):

### Method 1: Automatically rotate certificates with kubeadm when upgrading the cluster

```bash
kubeadm upgrade apply --certificate-renewal v1.15.0
```

### Method 2: Manually generate and replace certificates using kubeadm

```bash
# Step 1): Backup old certs and kubeconfigs
mkdir /etc/kubernetes.bak
cp -r /etc/kubernetes/pki/ /etc/kubernetes.bak
cp /etc/kubernetes/*.conf /etc/kubernetes.bak

# Step 2): Renew all certs
kubeadm alpha certs renew all --config kubeadm.yaml

# Step 3): Renew all kubeconfigs
kubeadm alpha kubeconfig user --client-name=admin
kubeadm alpha kubeconfig user --org system:masters --client-name kubernetes-admin  > /etc/kubernetes/admin.conf
kubeadm alpha kubeconfig user --client-name system:kube-controller-manager > /etc/kubernetes/controller-manager.conf
kubeadm alpha kubeconfig user --org system:nodes --client-name system:node:$(hostname) > /etc/kubernetes/kubelet.conf
kubeadm alpha kubeconfig user --client-name system:kube-scheduler > /etc/kubernetes/scheduler.conf

# Another way to renew kubeconfigs
# kubeadm init phase kubeconfig all --config kubeadm.yaml

# Step 4): Copy certs/kubeconfigs and restart Kubernetes services
```

### Method 3: For non-kubeadm clusters

For non-kubeadm clusters, please refer to [Configuring CA and Creating TLS Certificates](../setup/k8s-hard-way/04-certificate-authority.md) for regenerating certificates and then restart all Kubernetes services.

## kubelet Automatic Certificate Rotation

Starting from v1.8.0, kubelet supports [certificate rotation](https://kubernetes.io/docs/tasks/tls/certificate-rotation/). When a certificate expires, it can automatically generate a new key and apply for a new certificate from the Kubernetes API.

To enable certificate rotation, use the following:

```bash
# Step 1): Config kube-controller-manager
kube-controller-manager --experimental-cluster-signing-duration=87600h \
                --feature-gates=RotateKubeletClientCertificate=true \
                ...

# Step 2): Config RBAC
# Refer https://kubernetes.io/docs/reference/command-line-tools-reference/kubelet-tls-bootstrapping/#approval

# Step 3): Config Kubelet
kubelet --feature-gates=RotateKubeletClientCertificate=true \
                --cert-dir=/var/lib/kubelet/pki \
                --rotate-certificates \
                --rotate-server-certificates \
                ...
```

## Revoking Certificates

Kubernetes currently does not support [Certificate Revocation List (CRL)](https://en.wikipedia.org/wiki/Certificate_revocation_list) for [revoking certificates](https://github.com/kubernetes/kubernetes/issues/18982). Therefore, the only way to revoke a certificate currently is to regenerate all certificates with a new CA and then restart all services.

To avoid this issue, it is recommended to configure client authentication using [OIDC](https://kubernetes.io/docs/reference/access-authn-authz/authentication/#openid-connect-tokens), such as implementing it with the [dex](https://github.com/dexidp/dex) project.

> Note: Etcd supports certificate revocation with CRL, the implementation reference can be found [here](https://github.com/etcd-io/etcd/blob/main/client/pkg/transport/listener_tls.go).

## Appendix: Glossary

* CA (Certificate Authority): The root certificate issuing agency that issues certificates (i.e., verifies certificates are legitimate).
  * A CA holds a private key (ca.key) and a certificate (ca.crt, which includes the public key). For a self-signed CA, ca.crt needs to be distributed to all clients.
  * ca.crt is automatically mounted into Pods at `/var/run/secrets/kubernetes.io/serviceaccount/ca.crt`
* key (Public key or Private key): The public or private cryptographic key.
* csr (Certificate Signing Request): A request sent to a certificate authority to obtain a signed certificate, which usually includes the public key (while keeping the private key secure).
* crt/cer (Certificate): The issued certificate, usually in PEM format (also supports DER format).

## References

* [Certificate Management with kubeadm](https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-certs/)
* [Manage TLS Certificates in a Cluster](https://kubernetes.io/docs/tasks/tls/managing-tls-in-a-cluster/)
* [Kubelet Certificate Rotation](https://kubernetes.io/docs/tasks/tls/certificate-rotation/)