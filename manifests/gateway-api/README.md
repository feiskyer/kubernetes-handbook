# Gateway API 示例

本目录包含 Gateway API v1.3.0 的各种示例配置，展示了新特性的使用方法。

## 目录结构

- `basic/` - 基础 Gateway API 配置示例
- `v1.3-features/` - v1.3.0 新特性示例
- `migration/` - 从 Ingress 迁移的示例

## 前置条件

1. 安装 Gateway API CRDs：
```bash
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.3.0/standard-install.yaml
```

2. 安装 Gateway API 实验性特性：
```bash
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.3.0/experimental-install.yaml
```

3. 安装支持 Gateway API 的控制器（如 Envoy Gateway、Istio、Cilium 等）

## 使用方法

按照以下顺序部署示例：

1. 首先部署基础配置：
```bash
kubectl apply -f basic/
```

2. 然后部署新特性示例：
```bash
kubectl apply -f v1.3-features/
```

## 支持的控制器

- [Envoy Gateway](https://gateway.envoyproxy.io/)
- [Istio](https://istio.io/latest/docs/tasks/traffic-management/ingress/gateway-api/)
- [Cilium](https://docs.cilium.io/en/latest/network/servicemesh/gateway-api/)
- [Airlock Gateway](https://docs.airlock.com/gateway/)