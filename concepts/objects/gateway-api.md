# Gateway API

Gateway API 是 Kubernetes 社区推出的用于配置和管理网关的新一代 API，它是 Ingress 资源的演进版本，提供了更强大、更灵活和更具表达力的流量管理能力。

## 什么是 Gateway API？

Gateway API 是一个由 Kubernetes 网络特殊兴趣小组 (SIG-NETWORK) 维护的开源项目，旨在通过提供表达性强、可扩展和面向角色的接口来改进服务网络。

Gateway API 解决了传统 Ingress 的以下限制：

- **表达能力有限**：Ingress 只能处理简单的 HTTP 路由
- **可扩展性差**：依赖于特定控制器的注解来扩展功能
- **角色混乱**：缺乏清晰的角色分离和权限边界

## 核心概念

Gateway API 引入了以下核心资源：

### Gateway

Gateway 描述了如何将流量转换为集群内的服务。它定义了监听器，每个监听器定义一个端口、协议和主机名。

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: example-gateway
  namespace: default
spec:
  gatewayClassName: example-class
  listeners:
  - name: http
    port: 80
    protocol: HTTP
    hostname: "*.example.com"
```

### GatewayClass

GatewayClass 定义了一组网关，这些网关共享公共配置和行为。它类似于 StorageClass，但用于网关。

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: example-class
spec:
  controllerName: example.com/gateway-controller
```

### HTTPRoute

HTTPRoute 定义了 HTTP 请求如何路由到后端服务。

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: example-route
  namespace: default
spec:
  parentRefs:
  - name: example-gateway
  hostnames:
  - "api.example.com"
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /api/v1
    backendRefs:
    - name: api-service
      port: 8080
```

## Gateway API v1.3.0 新特性

### 标准通道特性

#### 基于百分比的请求镜像

v1.3.0 引入了基于百分比的请求镜像功能，允许将指定百分比的请求镜像到另一个后端：

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: example-route
spec:
  parentRefs:
  - name: example-gateway
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /api
    backendRefs:
    - name: production-service
      port: 8080
    filters:
    - type: RequestMirror
      requestMirror:
        backendRef:
          name: test-service
          port: 8080
        percent: 10  # 镜像 10% 的请求
```

### 实验性通道特性

#### CORS 过滤

新增的 CORS 过滤器支持跨域资源共享配置：

```yaml
apiVersion: gateway.networking.x-k8s.io/v1alpha1
kind: HTTPRoute
metadata:
  name: cors-example
spec:
  parentRefs:
  - name: example-gateway
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /api
    filters:
    - type: ExtensionRef
      extensionRef:
        group: gateway.networking.x-k8s.io
        kind: CORSPolicy
        name: cors-policy
    backendRefs:
    - name: api-service
      port: 8080
---
apiVersion: gateway.networking.x-k8s.io/v1alpha1
kind: CORSPolicy
metadata:
  name: cors-policy
spec:
  allowOrigins:
  - "https://example.com"
  - "https://*.example.com"
  allowMethods:
  - GET
  - POST
  - PUT
  allowHeaders:
  - "Content-Type"
  - "Authorization"
  allowCredentials: true
  maxAge: "24h"
```

#### 重试预算 (XBackendTrafficPolicy)

重试预算功能限制客户端在服务端点间的重试行为：

```yaml
apiVersion: gateway.networking.x-k8s.io/v1alpha1
kind: XBackendTrafficPolicy
metadata:
  name: retry-budget
spec:
  targetRefs:
  - group: ""
    kind: Service
    name: api-service
  retry:
    attempts: 3
    backoff: "1s"
    budget:
      percentage: 20  # 最多 20% 的请求可以重试
      interval: "10s"
```

#### XListenerSets

XListenerSets 提供了标准化的 Gateway 监听器合并机制：

```yaml
apiVersion: gateway.networking.x-k8s.io/v1alpha1
kind: XListenerSet
metadata:
  name: shared-listeners
  namespace: gateway-system
spec:
  listeners:
  - name: http
    port: 80
    protocol: HTTP
  - name: https
    port: 443
    protocol: HTTPS
    tls:
      mode: Terminate
      certificateRefs:
      - name: wildcard-cert
```

#### Inference Extension（AI/ML 推理扩展）

Gateway API Inference Extension 是专为生成式 AI 和大语言模型 (LLM) 推理工作负载设计的扩展，提供了智能路由和负载平衡能力。

**核心组件：**

**InferencePool** - 定义运行模型服务器的 Pod 池：
```yaml
apiVersion: gateway.networking.x-k8s.io/v1alpha1
kind: InferencePool
metadata:
  name: llama2-pool
spec:
  deployment:
    replicas: 3
    template:
      spec:
        containers:
        - name: model-server
          image: vllm/vllm-openai:latest
          resources:
            limits:
              nvidia.com/gpu: 1
```

**InferenceModel** - 用户面向的模型端点：
```yaml
apiVersion: gateway.networking.x-k8s.io/v1alpha1
kind: InferenceModel
metadata:
  name: llama2-7b
spec:
  poolRef:
    name: llama2-pool
  routing:
    priority: high
    trafficSplit:
    - weight: 90
      version: stable
    - weight: 10
      version: canary
```

**主要特性：**
- **模型感知路由**：基于模型类型和状态进行智能路由
- **请求优先级**：支持每请求的重要性级别设置
- **安全模型发布**：支持金丝雀发布和 A/B 测试
- **优化负载平衡**：基于实时指标进行 GPU 资源优化

**性能优势：**
- 降低 AI/ML 工作负载延迟
- 提高 GPU 利用率
- 标准化 AI 服务路由方式
- 支持前缀缓存感知的负载平衡

## 角色分离

Gateway API 设计了清晰的角色分离：

- **基础设施提供者**：管理 GatewayClass 和基础设施
- **集群操作员**：管理 Gateway 资源和网络策略
- **应用开发者**：管理 Route 资源和应用流量

## 支持的协议

Gateway API 支持多种协议：

- **HTTP/HTTPS**：通过 HTTPRoute 资源
- **TLS**：通过 TLSRoute 资源
- **TCP**：通过 TCPRoute 资源
- **UDP**：通过 UDPRoute 资源
- **gRPC**：通过 GRPCRoute 资源

## 与 Ingress 的对比

| 特性 | Ingress | Gateway API |
|------|---------|-------------|
| 协议支持 | 仅 HTTP/HTTPS | HTTP/HTTPS/TCP/UDP/TLS/gRPC |
| 角色分离 | 无 | 清晰的角色分离 |
| 可扩展性 | 通过注解 | 原生 API 扩展 |
| 表达能力 | 有限 | 丰富的流量管理能力 |
| 类型安全 | 部分 | 完全类型安全 |

## 兼容性

- **Kubernetes 版本**：要求 Kubernetes 1.26 或更高版本
- **API 稳定性**：标准通道功能已达到 v1 稳定版本
- **实现**：Envoy Gateway、Istio、Cilium、Airlock 等多个实现

## 迁移指南

### 从 Ingress 迁移

1. **安装 Gateway API CRDs**：
```bash
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.3.0/standard-install.yaml
```

2. **创建 GatewayClass**：
```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: nginx
spec:
  controllerName: nginx.org/nginx-gateway-controller
```

3. **创建 Gateway**：
```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: nginx-gateway
spec:
  gatewayClassName: nginx
  listeners:
  - name: http
    port: 80
    protocol: HTTP
```

4. **将 Ingress 转换为 HTTPRoute**：
```yaml
# 原 Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: example-ingress
spec:
  rules:
  - host: example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: example-service
            port:
              number: 80

# 转换为 HTTPRoute
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: example-route
spec:
  parentRefs:
  - name: nginx-gateway
  hostnames:
  - "example.com"
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /
    backendRefs:
    - name: example-service
      port: 80
```

## 最佳实践

1. **渐进式迁移**：先在测试环境验证，再逐步迁移生产环境
2. **角色分离**：明确定义不同角色的职责和权限
3. **监控观察**：部署适当的监控和日志记录
4. **安全配置**：使用 TLS 终止和适当的安全策略
5. **性能测试**：验证新配置的性能表现

## 参考文档

* [Gateway API 官方文档](https://gateway-api.sigs.k8s.io/)
* [Gateway API v1.3.0 发布说明](https://kubernetes.io/blog/2025/06/02/gateway-api-v1-3/)
* [Gateway API Inference Extension 介绍](https://kubernetes.io/blog/2025/06/05/introducing-gateway-api-inference-extension/)
* [Gateway API GitHub 仓库](https://github.com/kubernetes-sigs/gateway-api)
* [Gateway API 实现列表](https://gateway-api.sigs.k8s.io/implementations/)