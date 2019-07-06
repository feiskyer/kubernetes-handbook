# Istio 安全管理

Istio 提供了 RBAC 访问控制、双向 TLS 认证以及密钥管理等安全管理功能。

## RBAC

Istio Role-Based Access Control (RBAC) 提供了 namespace、service 以及 method 级别的访问控制。其特性包括

- 简单易用：提供基于角色的语意
- 支持认证：提供服务 - 服务和用户 - 服务的认证
- 灵活：提供角色和角色绑定的自定义属性

![image-20180423202459184](images/istio-auth.png)

### 开启 RBAC

通过 `RbacConfig` 来启用 RBAC，其中 mode 支持如下选项：

- **OFF**: 停用 RBAC。
- **ON**: 为网格中的所有服务启用 RBAC。
- **ON_WITH_INCLUSION**: 只对 `inclusion` 字段中包含的命名空间和服务启用 RBAC。
- **ON_WITH_EXCLUSION**: 对网格内的所有服务启用 RBAC，除 `exclusion` 字段中包含的命名空间和服务之外。

下面的例子为 `default` 命名空间开启 RBAC：

```yaml
apiVersion: "config.istio.io/v1alpha2"
kind: RbacConfig
metadata:
  name: default
  namespace: istio-system
spec:
  mode: ON_WITH_INCLUSION
  inclusion:
    namespaces: ["default"]
```

### 访问控制

Istio RBAC 提供了 ServiceRole 和 ServiceRoleBinding 两种资源对象，并以 CustomResourceDefinition (CRD) 的方式管理。

- ServiceRole 定义了一个可访问特定资源（namespace 之内）的服务角色，并支持以前缀通配符和后缀通配符的形式匹配一组服务
- ServiceRoleBinding 定义了赋予指定角色的绑定，即可以指定的角色和动作访问服务

```yaml
apiVersion: "rbac.istio.io/v1alpha1"
kind: ServiceRole
metadata:
  name: products-viewer
  namespace: default
spec:
  rules:
  - services: ["products.default.svc.cluster.local"]
    methods: ["GET", "HEAD"]

---
apiVersion: "rbac.istio.io/v1alpha1"
kind: ServiceRoleBinding
metadata:
  name: test-binding-products
  namespace: default
spec:
  subjects:
  - user: "service-account-a"
  - user: "istio-ingress-service-account"
    properties:
    - request.auth.claims[email]: "a@foo.com"
    roleRef:
    kind: ServiceRole
    name: "products-viewer"
```

## 双向 TLS

双向 TLS 为服务间通信提供了 TLS 认证，并提供管理系统自动管理密钥和证书的生成、分发、替换以及撤销。

![](images/istio-tls.png)

### 实现原理

Istio Auth 由三部分组成：

- 身份（Identity）：Istio 使用 Kubernetes service account 来识别服务的身份，格式为 `spiffe://<*domain*>/ns/<*namespace*>/sa/<*serviceaccount*>`
- 通信安全：端到端 TLS 通信通过服务器端和客户端的 Envoy 容器完成
- 证书管理：Istio CA (Certificate Authority) 负责为每个 service account 生成 SPIFEE 密钥和证书、分发到 Pod（通过 Secret Volume Mount 的形式）、定期轮转（Rotate）以及必要时撤销。对于 Kuberentes 之外的服务，CA 配合 Istio node agent 共同完成整个过程。

这样，一个容器使用证书的流程为

- 首先，Istio CA 监听 Kubernetes API，并为 service account 生成 SPIFFE 密钥及证书，再以 secret 形式存储到 Kubernetes 中
- 然后，Pod 创建时，Kubernetes API Server 将 secret 挂载到容器中
- 最后，Pilot 生成一个访问控制的配置，定义哪些 service account 可以访问服务，并分发给 Envoy
- 而当容器间通信时，Pod 双方的 Envoy 就会基于访问控制配置来作认证

### 最佳实践

- 为不同团队创建不同 namespace 分别管理
- 将 Istio CA 运行在单独的 namespace 中，并且仅授予管理员权限

## 参考文档

- [Istio Security 文档](https://istio.io/docs/concepts/security/)
- [Istio Role-Based Access Control (RBAC)](https://istio.io/docs/concepts/security/)
- [Istio 双向 TLS 文档](https://istio.io/docs/concepts/security/#mutual-tls-authentication)
