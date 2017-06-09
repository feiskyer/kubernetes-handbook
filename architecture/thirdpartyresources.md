# ThirdPartyResources

ThirdPartyResources是一种无需改变代码就可以扩展Kubernetes API的机制，可以用来管理自定义对象。每个ThirdPartyResource都包含以下属性

- metadata：跟kubernetes metadata一样
- kind：自定义的资源类型，采用`<kind mame>.<domain>`的格式
- description：资源描述
- versions：版本列表
- 其他：还可以保护任何其他自定义的属性

> **[warning] ThirdPartyResources将在v1.7弃用**
>
> ThirdPartyResources将在v1.7弃用，并在未来版本中删除。建议从v1.7开始，迁移到[CustomResourceDefinition](https://github.com/kubernetes/kubernetes.github.io/blob/release-1.7/docs/tasks/access-kubernetes-api/extend-api-custom-resource-definitions.md)。

下面的例子会创建一个`/apis/stable.example.com/v1/namespaces/<namespace>/crontabs/...`的API

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

API创建好后，就可以创建具体的CronTab对象了

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

## ThirdPartyResources与RBAC

注意ThirdPartyResources不是namespace-scoped的资源，在普通用户使用之前需要绑定ClusterRole权限。

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
