# Dashboard

Deploying the Kubernetes Dashboard is incredibly straightforward. To get started, simply run:

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/dashboard/v2.0.0-beta8/aio/deploy/recommended.yaml
```

After a short wait, the dashboard will be ready:

```bash
$ kubectl -n kubernetes-dashboard get pod
NAME                                         READY   STATUS    RESTARTS   AGE
dashboard-metrics-scraper-76585494d8-xhhzx   1/1     Running   0          20m
kubernetes-dashboard-5996555fd8-snzh9        1/1     Running   0          20m
$ kubectl -n kubernetes-dashboard get service
NAME                        TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)    AGE
dashboard-metrics-scraper   ClusterIP   10.0.58.210    <none>        8000/TCP   20m
kubernetes-dashboard        ClusterIP   10.0.182.172   <none>        443/TCP    20m
```

Then, after running `kubectl proxy`, you can access it through the following link:

```bash
http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/
```

## Login Authentication

### Login by importing the API Server's certificate

In versions prior to v1.7, the Dashboard did not offer a login feature and was run over http, so you could access it directly through `kubectl port-forard` or `kubectl proxy`.

You could also access it directly through the API Server's proxy address – the kubernetes-dashboard address outputted by `kubectl cluster-info`. Since the kubernetes API Server runs over https, you'll need to import the certificate into your system to access it:

```bash
# generate p12 cert
kubectl config view --flatten -o jsonpath='{.users[?(.name == "username")].user.client-key-data}' | base64 -d > client.key
kubectl config view --flatten -o jsonpath='{.users[?(.name == "username")].user.client-certificate-data}' | base64 -d > client.crt
openssl pkcs12 -export -in client.crt -inkey client.key -out client.p12
```

By importing `client.p12` into your system, you could directly access `https://<apiserver-url>/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/#/overview` through your browser.

### Login using the kubeconfig configuration file

Starting with version v1.7.0, the Dashboard supports login via kubeconfig configuration files. When you open the Dashboard page, it will automatically redirect to the login interface. Select the Kubeconfig method and choose the local kubeconfig configuration file to proceed.

![](https://user-images.githubusercontent.com/2285385/30416718-8ee657d8-992d-11e7-84c8-9ba5f4c78bb2.png)

### Login using a restricted Token

Also starting with version v1.7.0, the Dashboard supports login via Token. Be aware that the Token retrieved from Kubernetes needs to be Base64-decoded before it can be used for login.

The following is an example of creating a service account token that can only access the `demo` namespace when RBAC is enabled:

```bash
# Create demo namespace
kubectl create namespace demo

# Create and restrict access to the demo namespace
cat <<EOF | kubectl apply -f -
kind: Role
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  namespace: demo
  name: default-role
rules:
  - apiGroups:
    - '*'
    resources:
    - '*'
    verbs:
    - '*'
EOF
kubectl create rolebinding default-rolebinding --serviceaccount=demo:default --namespace=demo --role=default-role

# Get token
secret=$(kubectl -n demo get sa default -o jsonpath='{.secrets[0].name}')
kubectl -n demo get secret $secret -o jsonpath='{.data.token}' | base64 -d
```

Note that since this token can only access the `demo` namespace, after logging in you would need to change the `default` in the access URL to `demo`.

## Logging in Using an Admin Token

Similar to the previous step, you can also create a token for an admin user to log in to the dashboard:

```bash
kubectl create serviceaccount admin
kubectl create clusterrolebinding dash-admin --clusterrole=cluster-admin --serviceaccount=default:admin
secret=$(kubectl get sa admin -o jsonpath='{.secrets[0].name}')
kubectl get secret $secret -o go-template='{{ .data.token | base64decode }}'
```

## Other User Interfaces

In addition to the Dashboard provided by the Kubernetes community, you can also use the following user interfaces to manage Kubernetes clusters

* [Cabin](https://github.com/bitnami-labs/cabin): An Android/iOS app for managing Kubernetes on-the-go
* [Kubernetic](http://kubernetic.com/): A desktop client for Kubernetes
* [Kubernator](https://github.com/smpio/kubernator): A low-level web interface used for directly managing Kubernetes resources (i.e., YAML configurations)

![kubernator](../../.gitbook/assets/kubernator%20%284%29.png)
