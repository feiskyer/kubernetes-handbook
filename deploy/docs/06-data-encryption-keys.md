
# 建立资料加密设定档与密钥

Kubernetes 储存许多的资料, 像是群集状态, 应用设定, 以及secrets。而Kubernetes 支援群集资料加密的相关功能。

在这次实验你将会建立加密密钥以及[加密设定档](https://kubernetes.io/docs/tasks/administer-cluster/encrypt-data/#understanding-the-encryption-at-rest-configuration) 来帮助加密Kubernetes Secests。

## 加密密钥

建立加密密钥:

```
ENCRYPTION_KEY=$(head -c 32 /dev/urandom | base64)
```

## 加密设定档
建立 `encryption-config.yaml` 加密的设定档:

```
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

复制 `encryption-config.yaml` 加密设定档到每个控制节点:
```
for instance in controller-0 controller-1 controller-2; do
  gcloud compute scp encryption-config.yaml ${instance}:~/
done
```


Next: [启动etcd 群集](07-bootstrapping-etcd.md)
