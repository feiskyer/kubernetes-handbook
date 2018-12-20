# Kubernetes 配置最佳实践

本文档旨在汇总和强调用户指南、快速开始文档和示例中的最佳实践。该文档会很很活跃并持续更新中。如果你觉得很有用的最佳实践但是本文档中没有包含，欢迎给我们提 Pull Request。

## 通用配置建议

- 定义配置文件的时候，指定最新的稳定 API 版本。
- 在部署配置文件到集群之前应该保存在版本控制系统中。这样当需要的时候能够快速回滚，必要的时候也可以快速的创建集群。
- 使用 YAML 格式而不是 JSON 格式的配置文件。在大多数场景下它们都可以互换，但是 YAML 格式比 JSON 更友好。
- 尽量将相关的对象放在同一个配置文件里，这样比分成多个文件更容易管理。参考 [guestbook-all-in-one.yaml](https://github.com/kubernetes/examples/blob/master/guestbook/all-in-one/guestbook-all-in-one.yaml) 文件中的配置。
- 使用 `kubectl` 命令时指定配置文件目录。
- 不要指定不必要的默认配置，这样更容易保持配置文件简单并减少配置错误。
- 将资源对象的描述放在一个 annotation 中可以更好的内省。


## 裸奔的 Pods vs Replication Controllers 和 Jobs

- 如果有其他方式替代 “裸奔的 pod”（如没有绑定到 [replication controller ](https://kubernetes.io/docs/user-guide/replication-controller) 上的 pod），那么就使用其他选择。
- 在 node 节点出现故障时，裸奔的 pod 不会被重新调度。
- Replication Controller 总是会重新创建 pod，除了明确指定了 [`restartPolicy: Never`](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#restart-policy) 的场景。[Job](https://kubernetes.io/docs/concepts/jobs/run-to-completion-finite-workloads/) 对象也适用。


## Services

- 通常最好在创建相关的 [replication controllers](https://kubernetes.io/docs/concepts/workloads/controllers/replicationcontroller/) 之前先创建 [service](https://kubernetes.io/docs/concepts/services-networking/service/)。这样可以保证容器在启动时就配置了该服务的环境变量。对于新的应用，推荐通过服务的 DNS 名字来访问（而不是通过环境变量）。
- 除非有必要（如运行一个 node daemon），不要使用配置 `hostPort` 的 Pod（用来指定暴露在主机上的端口号）。当你给 Pod 绑定了一个 `hostPort`，该 Pod 会因为端口冲突很难调度。如果是为了调试目的来通过端口访问的话，你可以使用 [kubectl proxy and apiserver proxy](https://kubernetes.io/docs/tasks/access-kubernetes-api/http-proxy-access-api/) 或者 [kubectl port-forward](https://kubernetes.io/docs/tasks/access-application-cluster/port-forward-access-application-cluster/)。你可使用 [Service](https://kubernetes.io/docs/concepts/services-networking/service/) 来对外暴露服务。如果你确实需要将 pod 的端口暴露到主机上，考虑使用 [NodePort](https://kubernetes.io/docs/user-guide/services/#type-nodeport) service。
- 跟 `hostPort` 一样的原因，避免使用 `hostNetwork`。
- 如果你不需要 kube-proxy 的负载均衡的话，可以考虑使用使用 [headless services](https://kubernetes.io/docs/user-guide/services/#headless-services)（ClusterIP 为 None）。

## 使用 Label

- 使用 [labels](https://kubernetes.io/docs/user-guide/labels/) 来指定应用或 Deployment 的语义属性。这样可以让你能够选择合适于场景的对象组，比如 `app: myapp, tire: frontend, phase: test, deployment: v3`。
- 一个 service 可以被配置成跨越多个 deployment，只需要在它的 label selector 中简单的省略发布相关的 label。
- 注意 [Deployment](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) 对象不需要再管理 replication controller 的版本名。Deployment 中描述了对象的期望状态，如果对 spec 的更改被应用了话，Deployment controller 会以控制的速率来更改实际状态到期望状态。
- 利用 label 做调试。因为 Kubernetes replication controller 和 service 使用 label 来匹配 pods，这允许你通过移除 pod 的相关label的方式将其从一个 controller 或者 service 中移除，而 controller 会创建一个新的 pod 来取代移除的 pod。这是一个很有用的方式，帮你在一个隔离的环境中调试之前的 “活着的” pod。

## 容器镜像

- 默认容器镜像拉取策略是 `IfNotPresent`, 当本地已存在该镜像的时候 Kubelet 不会再从镜像仓库拉取。如果你希望总是从镜像仓库中拉取镜像的话，在 yaml 文件中指定镜像拉取策略为 `Always`（ `imagePullPolicy: Always`）或者指定镜像的 tag 为 `:latest` 。
- 如果你没有将镜像标签指定为 `:latest`，例如指定为 `myimage:v1`，当该标签的镜像进行了更新，kubelet 也不会拉取该镜像。你可以在每次镜像更新后都生成一个新的 tag（例如 `myimage:v2`），在配置文件中明确指定该版本。
- 可以使用镜像的摘要（Digest）来保证容器总是使用同一版本的镜像。
- ** 注意：** 在生产环境下部署容器应该尽量避免使用 `:latest` 标签，因为这样很难追溯到底运行的是哪个版本以及发生故障时该如何回滚。

## 使用 kubectl

- 尽量使用 `kubectl create -f <directory>` 或 `kubectl apply -f <directory` 。kubeclt 会自动查找该目录下的所有后缀名为 `.yaml`、`.yml` 和 `.json` 文件并将它们传递给 `create` 或 `apply` 命令。

- `kubectl get` 或 `kubectl delete` 时使用标签选择器可以批量操作一组对象。

- 使用 `kubectl run` 和 `expose` 命令快速创建只有单个容器的 Deployment 和 Service，如

  ```sh
  kubectl run hello-world --replicas=2 --labels="run=load-balancer-example" --image=gcr.io/google-samples/node-hello:1.0  --port=8080
  kubectl expose deployment hello-world --type=NodePort --name=example-service
  kubectl get pods --selector="run=load-balancer-example" --output=wide
  ```

## 参考文档

- [Configuration Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
