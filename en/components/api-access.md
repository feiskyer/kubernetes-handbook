# 访问API

有多种方式可以访问 Kubernetes 提供的 REST API：

- [kubectl ](kubectl.md)命令行工具
- SDK，支持多种语言
  - [Go](https://github.com/kubernetes/client-go)
  - [Python](https://github.com/kubernetes-incubator/client-python)
  - [Javascript](https://github.com/kubernetes-client/javascript)
  - [Java](https://github.com/kubernetes-client/java)
  - [CSharp](https://github.com/kubernetes-client/csharp)
  - 其他[OpenAPI](https://www.openapis.org/)支持的语言，可以通过[gen](https://github.com/kubernetes-client/gen)工具生成相应的client

## kubectl

```sh
kubectl get --raw /api/v1/namespaces
kubectl get --raw /apis/metrics.k8s.io/v1beta1/nodes
kubectl get --raw /apis/metrics.k8s.io/v1beta1/pods
```

## kubectl proxy

```sh
$ kubectl proxy --port=8080 &

$ curl http://localhost:8080/api/
{
  "versions": [
    "v1"
  ]
}
```

## curl

```sh
$ APISERVER=$(kubectl config view | grep server | cut -f 2- -d ":" | tr -d " ")
$ TOKEN=$(kubectl describe secret $(kubectl get secrets | grep default | cut -f1 -d ' ') | grep -E '^token' | cut -f2 -d':' | tr -d '\t')
$ curl $APISERVER/api --header "Authorization: Bearer $TOKEN" --insecure
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



## 参考文档

- [v1.5 API Reference](https://kubernetes.io/docs/api-reference/v1.5/)
- [v1.6 API Reference](https://kubernetes.io/docs/api-reference/v1.6)
- [v1.7 API Reference](https://kubernetes.io/docs/api-reference/v1.7/)
- [v1.8 API Reference](https://kubernetes.io/docs/api-reference/v1.8/)
- [v1.9 API Reference](https://kubernetes.io/docs/api-reference/v1.9/)
