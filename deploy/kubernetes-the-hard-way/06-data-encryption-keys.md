# 配置和生成密钥

Kubernetes 存储了集群状态、应用配置和密钥等很多不同的数据。而 Kubernetes 也支持集群数据的加密存储。

本部分将会创建加密密钥以及一个用于加密 Kubernetes Secrets 的 [加密配置文件](https://kubernetes.io/docs/tasks/administer-cluster/encrypt-data/#understanding-the-encryption-at-rest-configuration)。

## 加密密钥

建立加密密钥:

```sh
ENCRYPTION_KEY=$(head -c 32 /dev/urandom | base64)
```

## 加密配置文件

生成名为 `encryption-config.yaml` 的加密配置文件：

```sh
cat > encryption-config.yaml <<EOF
kind: EncryptionConfig
apiVersion: v1
resources:
  - resources:
      - secrets
    providers:
      - aescbc:
          keys:
            - name: key1
              secret: ${ENCRYPTION_KEY}
      - identity: {}
EOF
```

将 `encryption-config.yaml` 复制到每个控制节点上：

```sh
for instance in controller-0 controller-1 controller-2; do
  gcloud compute scp encryption-config.yaml ${instance}:~/
done
```

下一步：[部署 etcd 群集](07-bootstrapping-etcd.md)。
