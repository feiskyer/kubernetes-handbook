# ThirdPartyResources

ThirdPartyResources（TPR）是一种无需改变代码就可以扩展 Kubernetes API 的机制，可以用来管理自定义对象。每个 ThirdPartyResource 都包含以下属性

- metadata：跟 kubernetes metadata 一样
- kind：自定义的资源类型，采用 `<kind mame>.<domain>` 的格式
- description：资源描述
- versions：版本列表
- 其他：还可以保护任何其他自定义的属性

## API 版本对照表

| Kubernetes 版本 | Extension 版本     |
| --------------- | ------------------ |
| v1.5-v1.7       | extensions/v1beta1 |
| v1.8+           | 不再支持           |

>  **ThirdPartyResources 已在 v1.8 删除**
>
>  ThirdPartyResources 已在 v1.8 版本中删除。建议从 v1.7 开始，迁移到 [CustomResourceDefinition（CRD）](customresourcedefinition.md)。

## TPR 示例

下面的例子会创建一个 `/apis/stable.example.com/v1/namespaces/<namespace>/crontabs/...` 的 API

```sh
$ cat resource.yaml
apiVersion: extensions/v1beta1
kind: ThirdPartyResource
metadata:
  name: cron-tab.stable.example.com
description: "A specification of a Pod to run on a cron style schedule"
versions:
- name: v1

$ kubectl create -f resource.yaml
thirdpartyresource "cron-tab.stable.example.com" created
```

API 创建好后，就可以创建具体的 CronTab 对象了

```sh
$ cat my-cronjob.yaml
apiVersion: "stable.example.com/v1"
kind: CronTab
metadata:
  name: my-new-cron-object
cronSpec: "* * * * /5"
image: my-awesome-cron-image

$ kubectl create -f my-crontab.yaml
crontab "my-new-cron-object" created

$ kubectl get crontab
NAME                 KIND
my-new-cron-object   CronTab.v1.stable.example.com
```

## ThirdPartyResources 与 RBAC

注意 ThirdPartyResources 不是 namespace-scoped 的资源，在普通用户使用之前需要绑定 ClusterRole 权限。

```sh
$ cat cron-rbac.yaml
apiVersion: rbac.authorization.k8s.io/v1alpha1
kind: ClusterRole
metadata:
  name: cron-cluster-role
rules:
- apiGroups:
  - extensions
  resources:
  - thirdpartyresources
  verbs:
  - '*'
- apiGroups:
  - stable.example.com
  resources:
  - crontabs
  verbs:
  - "*"

$ kubectl create -f cron-rbac.yaml
$ kubectl create clusterrolebinding user1 --clusterrole=cron-cluster-role --user=user1 --user=user2 --group=group1
```

## 迁移到 CustomResourceDefinition

1. 首先将 TPR 资源重定义为 CRD 资源，比如下面这个 ThirdPartyResource 资源

```yaml
apiVersion: extensions/v1beta1
kind: ThirdPartyResource
metadata:
  name: cron-tab.stable.example.com
description: "A specification of a Pod to run on a cron style schedule"
versions:
- name: v1
```

需要重新定义为

```yaml
apiVersion: apiextensions.k8s.io/v1beta1
kind: CustomResourceDefinition
metadata:
  name: crontabs.stable.example.com
spec:
  scope: Namespaced
  group: stable.example.com
  version: v1
  names:
    kind: CronTab
    plural: crontabs
    singular: crontab
```

2. 创建 CustomResourceDefinition 定义后，等待 CRD 的 Established 条件：

```sh
$ kubectl get crd -o 'custom-columns=NAME:{.metadata.name},ESTABLISHED:{.status.conditions[?(@.type=="Established")].status}'
NAME                          ESTABLISHED
crontabs.stable.example.com   True
```

3. 然后，停止使用 TPR 的客户端和 TPR Controller，启动新的 CRD Controller。

4. 备份数据

```sh
$ kubectl get crontabs --all-namespaces -o yaml > crontabs.yaml
$ kubectl get thirdpartyresource cron-tab.stable.example.com -o yaml --export > tpr.yaml
```

5. 删除 TPR 定义，TPR 资源会自动复制为 CRD 资源

```sh
$ kubectl delete thirdpartyresource cron-tab.stable.example.com
```

6. 验证 CRD 数据是否迁移成功，如果有失败发生，可以从备份的 TPR 数据恢复

```sh
$ kubectl create -f tpr.yaml
```

7. 重启客户端和相关的控制器或监听程序，它们的数据源会自动切换到 CRD（即访问 TPR 的 API 会自动转换为对 CRD 的访问）
