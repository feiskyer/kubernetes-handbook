# Kubernetes社区贡献

Kubernetes支持以许多种方式来贡献社区，包括汇报代码缺陷、提交问题修复和功能实现、添加或修复文档、协助用户解决问题等等。

## 提交Pull Request到主分支

当需要修改Kubernetes代码时，可以给Kubernetes主分支提Pull Request。其git工作流：

![](images/git_workflow.png)

一些加快PR合并的方法：

- 使用小的commit，将不同功能的代码分拆到不同的commit甚至是不同的PR中
- 必要的逻辑添加注释说明变更的理由
- 遵循代码约定，如[Coding Conventions](https://github.com/kubernetes/community/blob/master/contributors/devel/coding-conventions.md)、[API Conventions](https://github.com/kubernetes/community/blob/master/contributors/devel/api-conventions.md)和[kubectl Conventions](https://github.com/kubernetes/community/blob/master/contributors/devel/kubectl-conventions.md)
- 确保修改部分可以本地跑过单元测试和功能测试
- 使用[Bot命令](https://github.com/kubernetes/test-infra/blob/master/commands.md)设置正确的标签或重试失败的测试

## 提交Pull Request到发布分支

发布分支的问题一般是首先在主分支里面修复（发送Pull Request到master并merge），然后通过cherry-pick的方式发送Pull Request到老的分支（如release-1.7等）。

对于主分支的PR，待Reviewer添加`cherrypick-candidate`标签后就可以开始cherry-pick到老的分支了。但首先需要安装一个Github发布的[hub](https://github.com/github/hub)工具，如

```sh
# on macOS
brew install hub

# on others
go get github.com/github/hub
```

然后执行下面的脚本自动cherry-pick并发送PR到需要的分支，其中`upstream/release-1.7`是要发布的分支，而`51870`则是发送到主分支的PR号：

```sh
hack/cherry_pick_pull.sh upstream/release-1.7 51870
```

然后安装输出中的提示操作即可。如果合并过程中发生错误，需要另开一个终端手动合并冲突，并执行`git add . && git am --continue`，最后再回去继续，直到PR发送成功。

## 参考文档

如果在社区贡献中碰到问题，可以参考以下指南

- [Contributing guidelines](https://github.com/kubernetes/kubernetes/blob/master/CONTRIBUTING.md)
- [Kubernetes Developer Guide](https://github.com/kubernetes/community/tree/master/contributors/devel)
- [Special Interest Groups](https://github.com/kubernetes/community)
- [Feature Tracking and Backlog](https://github.com/kubernetes/features)
- [Community Expectations](https://github.com/kubernetes/community/blob/master/contributors/devel/community-expectations.md)