# Addon-manager

The Addon-manager is a service running on the Kubernetes cluster's Master nodes designed to manage various Add-ons. It maintains all the extensions present in the `$ADDON_PATH` (which defaults to `/etc/kubernetes/addons/`) to ensure they always operate in the desired state.

Addon-manager supports two types of labels:

* For extensions tagged with `addonmanager.kubernetes.io/mode=Reconcile`, modifications through the API are not allowed. This means that:
  * Any changes made through the API will automatically revert to the configuration in `/etc/kubernetes/addons/`.
  * If an extension is deleted via the API, it will be automatically recreated from the configuration in `/etc/kubernetes/addons/`.
  * Removing configuration from `/etc/kubernetes/addons/` will also delete the corresponding Kubernetes resources.
  * Essentially, modifications can only be made by adjusting the configuration in `/etc/kubernetes/addons/`.
* For extensions with the `addonmanager.kubernetes.io/mode=EnsureExists` label, there's only a check to ensure the existence of the extension without checking for configuration changes. In effect:
  * The configuration can be modified via the API without it being automatically reverted.
  * If an extension is deleted via the API, it will be automatically recreated from the configuration in `/etc/kubernetes/addons/`.
  * However, if the configuration is removed from `/etc/kubernetes/addons/`, the Kubernetes resources will not be deleted.

## Deployment Method

Save the following YAML into the `/etc/kubernetes/manifests/kube-addon-manager.yaml` file on all Master nodes:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: kube-addon-manager
  namespace: kube-system
  annotations:
    scheduler.alpha.kubernetes.io/critical-pod: ''
    seccomp.security.alpha.kubernetes.io/pod: 'docker/default'
  labels:
    component: kube-addon-manager
spec:
  hostNetwork: true
  containers:
  - name: kube-addon-manager
    # When updating version also bump it in:
    # - test/kubemark/resources/manifests/kube-addon-manager.yaml
    image: k8s.gcr.io/kube-addon-manager:v8.7
    command:
    - /bin/bash
    - -c
    - exec /opt/kube-addons.sh 1>>/var/log/kube-addon-manager.log 2>&1
    resources:
      requests:
        cpu: 3m
        memory: 50Mi
    volumeMounts:
    - mountPath: /etc/kubernetes/
      name: addons
      readOnly: true
    - mountPath: /var/log
      name: varlog
      readOnly: false
    env:
    - name: KUBECTL_EXTRA_PRUNE_WHITELIST
      value: {{kubectl_extra_prune_whitelist}}
  volumes:
  - hostPath:
      path: /etc/kubernetes/
    name: addons
  - hostPath:
      path: /var/log
    name: varlog
```

## Source Code

The source code for Addon-manager is hosted at [https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/addon-manager](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/addon-manager).

---

# Addon-manager: A Kubernetes Cluster Maestro

Meet the Addon-manager, the essential service that diligently works in the background of Kubernetes Master nodes keeping add-ons in check. It's like a digital conductor for the `$ADDON_PATH` – typically `/etc/kubernetes/addons/` – maintaining a seamless operation of all extensions according to the script written for them.

The Addon-manager is adept at handling two kinds of labels that dictate extension behavior:

* Extensions marked with `addonmanager.kubernetes.io/mode=Reconcile` play by strict rules:
  * Try tweaking them through the API, and like a boomerang, they'll revert to their `/etc/kubernetes/addons/` settings.
  * Delete them, and they magically reappear, thanks to the `/etc/kubernetes/addons/` backup band.
  * However, pull their files from `/etc/kubernetes/addons/`, and it's curtains down for those Kubernetes resources.
  * The gist is, backstage configuration edits in `/etc/kubernetes/addons/` are the only way to shuffle their act.
* Extensions donning the `addonmanager.kubernetes.io/mode=EnsureExists` label are the free spirits:
  * API modifications? Go ahead; no strings attached for a rollback.
  * Vanish through the API, and voilà, they make an encore using the `/etc/kubernetes/addons/` script.
  * But should their part get axed from `/etc/kubernetes/addons/`, the show goes on without the Kubernetes resources curtain call.

## Setting the Stage

To roll out the Addon-manager across the Master nodes' ensemble, simply script the following YAML into the `/etc/kubernetes/manifests/kube-addon-manager.yaml` of each maestro's station:

```yaml
... [YAML content remains unchanged] ...
```

## Ensemble's Composition

For those wanting to peek at the Addon-manager's score, the source code resides at [https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/addon-manager](https://github.com/kubernetes/kubernetes/tree/master/cluster/addons/addon-manager). Consider it an open invitation to see the magic behind the Kubernetes curtain!