# 用户管理

根据[Kubernetes 认证](../extension/auth/authentication.md)文档，Kubernetes 本身并不直接提供用户管理的特性，不支持 User 对象，更不会存储 User 对象。但是它支持一系列的插件，比如 X509 证书、OpenID、Webhook等，用户可以基于这些插件跟外部的用户管理系统进行对接，再配合 RBAC 实现权限管理的机制。

实际上，你也可以使用 Certificate Signing Request \(CSR\) 或者 ServiceAccount 来创建和管理受限的用户。

## Certificate Signing Request \(CSR\)

Kubernetes 提供了 `certificates.k8s.io` API，可让您配置由您控制的证书颁发机构（CA）签名的TLS证书，工作负载可以使用这些CA和证书来建立信任。

> Kubernetes controller manager 提供了一个签名者的默认实现。 要启用它，请将`--cluster-signing-cert-file` 和 `--cluster-signing-key-file` 参数传递给 controller manager，并配置具有证书颁发机构的密钥对的路径。

假设已经为 kubectl 配置好了管理员 kubeconfig，以下是通过 openssl 和 CSR 创建一个新用户配置的步骤。

```bash
NAMESPACE=${NAMESPACE:-"default"}
USER_NAME=${USER_NAME:-"user1"}
GROUP_NAME=${GROUP_NAME:-"group1"}
SERVER_URL=$(kubectl cluster-info | awk '/Kubernetes master/{print $NF}' | sed $'s,\x1b\\[[0-9;]*[a-zA-Z],,g')

# create client key and cert 
openssl genrsa -out $USER_NAME.key 2048
openssl req -new -key $USER_NAME.key -out $USER_NAME.csr -subj "/CN=$USER_NAME/O=$GROUP_NAME"

# Sign the client certificates
CERTIFICATE_NAME=$USER_NAME-$NAMESPACE
cat <<EOF | kubectl create -f -
apiVersion: certificates.k8s.io/v1beta1
kind: CertificateSigningRequest
metadata:
  name: $CERTIFICATE_NAME
spec:
  groups:
  - system:authenticated
  request: $(cat $USER_NAME.csr | base64 | tr -d '\n')
  usages:
  - digital signature
  - key encipherment
  - client auth
EOF
kubectl certificate approve $CERTIFICATE_NAME
kubectl get csr $CERTIFICATE_NAME -o jsonpath='{.status.certificate}'  | base64 --decode > $USER_NAME.crt

# setup RBAC Roles
cat <<EOF | kubectl create -f -
kind: Role
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  namespace: $NAMESPACE
  name: $USER_NAME-role
rules:
  - apiGroups:
    - ''
    - extensions
    - apps
    - batch
    resources:
    - '*'
    verbs:
    - '*'
EOF

# bind role to the user
kubectl create rolebinding $USER_NAME-rolebinding --user=$USER_NAME --namespace=$NAMESPACE --role=$USER_NAME-role

# setup kubectl
kubectl config set-cluster $USER_NAME --server="$SERVER_URL" --insecure-skip-tls-verify
kubectl config set-credentials $USER_NAME --client-certificate=$USER_NAME.crt --client-key=$USER_NAME.key
kubectl config set-context $USER_NAME --cluster=$USER_NAME --user=$USER_NAME --namespace=$NAMESPACE
kubectl config use-context $USER_NAME
```

## ServiceAccount

ServiceAccount 是 Kubernetes 自动生成的，并会自动挂载到容器的 `/var/run/secrets/kubernetes.io/serviceaccount` 目录中。

在认证时，ServiceAccount 的用户名格式为 `system:serviceaccount:(NAMESPACE):(SERVICEACCOUNT)`，并从属于两个 group：`system:serviceaccounts` 和 `system:serviceaccounts:(NAMESPACE)`。

### Pod 内部访问 API

在 Pod 内部，你可以通过下面的方式来访问 API：

```bash
$ TOKEN=$(cat /run/secrets/kubernetes.io/serviceaccount/token)
$ CACERT=/run/secrets/kubernetes.io/serviceaccount/ca.crt
$ curl --cacert $CACERT --header "Authorization: Bearer $TOKEN"  https://$KUBERNETES_SERVICE_HOST:$KUBERNETES_SERVICE_PORT/api
{
  "kind": "APIVersions",
  "versions": [
    "v1"
  ],
  "serverAddressByClientCIDRs": [
    {
      "clientCIDR": "0.0.0.0/0",
      "serverAddress": "10.0.1.149:443"
    }
  ]
}
```

### kubectl 访问 API

假设已经为 kubectl 配置好了管理员 kubeconfig，以下是通过 ServiceAccount 创建一个新用户配置的步骤。

```bash
NAMESPACE=${NAMESPACE:-"default"}
SERVICE_ACCOUNT_NAME=${SERVICE_ACCOUNT_NAME:-"demo"}
SERVER_URL=$(kubectl cluster-info | awk '/Kubernetes master/{print $NF}' | sed $'s,\x1b\\[[0-9;]*[a-zA-Z],,g')

# create sa
kubectl -n $NAMESPACE create sa $SERVICE_ACCOUNT_NAME

# get secret and token
secret=$(kubectl -n $NAMESPACE get sa $SERVICE_ACCOUNT_NAME -o jsonpath='{.secrets[0].name}')
token=$(kubectl -n $NAMESPACE get secret $secret -o jsonpath='{.data.token}' | base64 -d)
kubectl -n $NAMESPACE get secret $secret -o jsonpath='{.data.ca\.crt}' | base64 --decode > ca.crt

# setup RBAC Roles
cat <<EOF | kubectl create -f -
kind: Role
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  namespace: $NAMESPACE
  name: $SERVICE_ACCOUNT_NAME-role
rules:
  - apiGroups:
    - ''
    - extensions
    - apps
    - batch
    resources:
    - '*'
    verbs:
    - '*'
EOF

# bind sa to the role
kubectl create rolebinding $SERVICE_ACCOUNT_NAME-rolebinding --serviceaccount=$NAMESPACE:$SERVICE_ACCOUNT_NAME --namespace=$NAMESPACE --role=$SERVICE_ACCOUNT_NAME-role

# setup kubectl
kubectl config set-cluster $SERVICE_ACCOUNT_NAME --embed-certs=true --server=${SERVER_URL} --certificate-authority=./ca.crt
kubectl config set-credentials $SERVICE_ACCOUNT_NAME --token=$token
kubectl config set-context $SERVICE_ACCOUNT_NAME --cluster=$SERVICE_ACCOUNT_NAME --user=$SERVICE_ACCOUNT_NAME --namespace=$NAMESPACE
kubectl config use-context $SERVICE_ACCOUNT_NAME
```

