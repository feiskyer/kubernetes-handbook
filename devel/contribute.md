# Kubernetes 社區貢獻

Kubernetes 支持以許多種方式來貢獻社區，包括彙報代碼缺陷、提交問題修復和功能實現、添加或修復文檔、協助用戶解決問題等等。

## 社區結構

Kubernetes 社區由三部分組成

- [Steering committee](http://blog.kubernetes.io/2017/10/kubernetes-community-steering-committee-election-results.html)
- [Special Interest Groups (SIG)](https://github.com/kubernetes/community/blob/master/sig-list.md)
- [Working Groups (WG)](https://github.com/kubernetes/community/blob/master/sig-list.md#master-working-group-list)

![](images/community.png)

## 提交 Pull Request 到主分支

當需要修改 Kubernetes 代碼時，可以給 Kubernetes 主分支提 Pull Request。這其實是一個標準的 Github 工作流：

![](images/git_workflow.png)

一些加快 PR 合併的方法：

- 使用小的提交，將不同功能的代碼分拆到不同的提交甚至是不同的 Pull Request 中
- 必要的邏輯添加註釋說明變更的理由
- 遵循代碼約定，如 [Coding Conventions](https://github.com/kubernetes/community/blob/master/contributors/guide/coding-conventions.md)、[API Conventions](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md) 和 [kubectl Conventions](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-cli/kubectl-conventions.md)
- 確保修改部分可以本地跑過單元測試和功能測試
- 使用 [Bot 命令](https://prow.k8s.io/command-help) 設置正確的標籤或重試失敗的測試

## 提交 Pull Request 到發佈分支

發佈分支的問題一般是首先在主分支裡面修復（發送 Pull Request 到主分支並通過代碼審核之後合併），然後通過 cherry-pick 的方式發送 Pull Request 到老的分支（如 `release-1.7` 等）。

對於主分支的 PR，待 Reviewer 添加 `cherrypick-candidate` 標籤後就可以開始 cherry-pick 到老的分支了。但首先需要安裝一個 Github 發佈的 [hub](https://github.com/github/hub) 工具，如

```sh
# on macOS
brew install hub

# on others
go get github.com/github/hub
```

然後執行下面的腳本自動 cherry-pick 併發送 PR 到需要的分支，其中 `upstream/release-1.7` 是要發佈的分支，而 `51870` 則是發送到主分支的 PR 號：

```sh
hack/cherry_pick_pull.sh upstream/release-1.7 51870
```

然後安裝輸出中的提示操作即可。如果合併過程中發生錯誤，需要另開一個終端手動合併衝突，並執行 `git add . && git am --continue`，最後再回去繼續，直到 PR 發送成功。

注意：提交到發佈分支的每個 PR 除了需要正常的代碼審核之外，還需要對應版本的 release manager 批准。當前所有版本的 release manager 可以在 [這裡](https://github.com/kubernetes/sig-release/blob/master/release-managers.md) 找到。

## 參考文檔

如果在社區貢獻中碰到問題，可以參考以下指南

- **[Kubernetes Contributor Community](https://kubernetes.io/community/)**
- **[Kubernetes Contributor Guide](https://github.com/kubernetes/community/tree/master/contributors/guide)**
- **[Kubernetes Developer Guide](https://github.com/kubernetes/community/tree/master/contributors/devel)**
- [Special Interest Groups](https://github.com/kubernetes/community)
- [Feature Tracking and Backlog](https://github.com/kubernetes/features)
- [Community Expectations](https://github.com/kubernetes/community/blob/master/contributors/guide/community-expectations.md)
- [Kubernetes release managers](https://github.com/kubernetes/sig-release/blob/master/release-managers.md)
