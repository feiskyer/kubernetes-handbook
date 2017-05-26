# Traefik ingress

[Traefik](https://traefik.io/)是一个开源的反向代理和负载均衡工具，它监听后端的变化并自动更新服务配置。

![](https://docs.traefik.io/img/architecture.png)

主要功能包括

- Golang编写，部署容易
- 快（nginx的85%)
- 支持众多的后端（Docker, Swarm, Kubernetes, Marathon, Mesos, Consul, Etcd等）
- 内置Web UI、Metrics和Let’s Encrypt支持，管理方便
- 自动动态配置
- 集群模式高可用

本章内容包括

- [安装Traefik ingress](traefik-ingress-installation.md)
- [分布式负载测试](distributed-load-test.md)
- [网络和集群性能测试](network-and-cluster-perfermance-test.md)
- [边缘节点配置](edge-node-configuration.md)