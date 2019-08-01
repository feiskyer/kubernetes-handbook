# 配置和生成密鑰

Kubernetes 存儲了集群狀態、應用配置和密鑰等很多不同的數據。而 Kubernetes 也支持集群數據的加密存儲。

本部分將會創建加密密鑰以及一個用於加密 Kubernetes Secrets 的 [加密配置文件](https://kubernetes.io/docs/tasks/administer-cluster/encrypt-data/#understanding-the-encryption-at-rest-configuration)。

## 加密密鑰

建立加密密鑰:

```sh
ENCRYPTION_KEY=$(head -c 32 /dev/urandom | base64)
```

## 加密配置文件

生成名為 `encryption-config.yaml` 的加密配置文件：

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

將 `encryption-config.yaml` 複製到每個控制節點上：

```sh
for instance in controller-0 controller-1 controller-2; do
  gcloud compute scp encryption-config.yaml ${instance}:~/
done
```

下一步：[部署 etcd 群集](07-bootstrapping-etcd.md)。
