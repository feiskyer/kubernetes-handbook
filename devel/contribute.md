# Kubernetes 社区贡献

Kubernetes 支持以许多种方式来贡献社区，包括汇报代码缺陷、提交问题修复和功能实现、添加或修复文档、协助用户解决问题等等。

## 社区结构

Kubernetes 社区由三部分组成

- [Steering committee](http://blog.kubernetes.io/2017/10/kubernetes-community-steering-committee-election-results.html)
- [Special Interest Groups (SIG)](https://github.com/kubernetes/community/blob/master/sig-list.md)
- [Working Groups (WG)](https://github.com/kubernetes/community/blob/master/sig-list.md#master-working-group-list)

![SIG-diagram.png](assets/SIG-diagram.png)

## 提交 Pull Request 到主分支

当需要修改 Kubernetes 代码时，可以给 Kubernetes 主分支提 Pull Request。这其实是一个标准的 Github 工作流：

![](images/git_workflow.png)

一些加快 PR 合并的方法：

- 使用小的提交，将不同功能的代码分拆到不同的提交甚至是不同的 Pull Request 中
- 必要的逻辑添加注释说明变更的理由
- 遵循代码约定，如 [Coding Conventions](https://github.com/kubernetes/community/blob/master/contributors/guide/coding-conventions.md)、[API Conventions](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md) 和 [kubectl Conventions](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-cli/kubectl-conventions.md)
- 确保修改部分可以本地跑过单元测试和功能测试
- 使用 [Bot 命令](https://prow.k8s.io/command-help) 设置正确的标签或重试失败的测试

## 提交 Pull Request 到发布分支

发布分支的问题一般是首先在主分支里面修复（发送 Pull Request 到主分支并通过代码审核之后合并），然后通过 cherry-pick 的方式发送 Pull Request 到老的分支（如 `release-1.7` 等）。

对于主分支的 PR，待 Reviewer 添加 `cherrypick-candidate` 标签后就可以开始 cherry-pick 到老的分支了。但首先需要安装一个 Github 发布的 [hub](https://github.com/github/hub) 工具，如

```sh
# on macOS
brew install hub

# on others
go get github.com/github/hub
```

然后执行下面的脚本自动 cherry-pick 并发送 PR 到需要的分支，其中 `upstream/release-1.7` 是要发布的分支，而 `51870` 则是发送到主分支的 PR 号：

```sh
hack/cherry_pick_pull.sh upstream/release-1.7 51870
```

然后安装输出中的提示操作即可。如果合并过程中发生错误，需要另开一个终端手动合并冲突，并执行 `git add . && git am --continue`，最后再回去继续，直到 PR 发送成功。

注意：提交到发布分支的每个 PR 除了需要正常的代码审核之外，还需要对应版本的 release manager 批准。当前所有版本的 release manager 可以在 [这里](https://github.com/kubernetes/sig-release/blob/master/release-managers.md) 找到。

## 参考文档

如果在社区贡献中碰到问题，可以参考以下指南

- **[Kubernetes Contributor Community](https://kubernetes.io/community/)**
- **[Kubernetes Contributor Guide](https://github.com/kubernetes/community/tree/master/contributors/guide)**
- **[Kubernetes Developer Guide](https://github.com/kubernetes/community/tree/master/contributors/devel)**
- [Special Interest Groups](https://github.com/kubernetes/community)
- [Feature Tracking and Backlog](https://github.com/kubernetes/features)
- [Community Expectations](https://github.com/kubernetes/community/blob/master/contributors/guide/community-expectations.md)
- [Kubernetes release managers](https://github.com/kubernetes/sig-release/blob/master/release-managers.md)
