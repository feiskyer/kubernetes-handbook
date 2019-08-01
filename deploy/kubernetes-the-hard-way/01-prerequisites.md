# 準備環境

## Google Cloud Platform

該指南使用 [Google Cloud Platform](https://cloud.google.com/) 作為 kubernetes 集群的環境平臺。[註冊](https://cloud.google.com/free/) 即可獲得 300 美元的試用金。

[估計](https://cloud.google.com/products/calculator/#id=78df6ced-9c50-48f8-a670-bc5003f2ddaa) 完成教學的花費金額: 每小時 0.22 美元 (每天 5.39 美元).

> 注意：該教程所需要的計算資源會超出 GCP 免費額度。

## Google Cloud Platform SDK

### 安裝 Google Cloud SDK

按照 Google Cloud SDK [文檔](https://cloud.google.com/sdk/) 的步驟去安裝並設置 gcloud` 命令。驗證 Google Cloud SDK 版本為 218.0.0 或更高:


```sh
gcloud version
```

### 設置默認 Region 和 Zone

本指南假設你的默認 Region 和 Zone 已經設置好了。如果你第一次使用 `gcloud` 指令工具, `init` 是一個最簡單的設定方式:

```sh
gcloud init
```

或者，執行下面的命令手動設定 default compute region:

```sh
gcloud config set compute/region us-west1
```

手動設定 compute zone

```sh
gcloud config set compute/zone us-west1-c
```

> 使用 `gcloud compute zones list` 指令來查詢其他的 region 和 zone。

## 使用 tmux 並行執行命令

[tmux](https://github.com/tmux/tmux/wiki) 可以用來在多個虛擬機中並行執行命令。該教程中的某些步驟需要在多臺虛擬機中操作，此時可以考慮使用 tmux 來加速執行過程。

> tmux 是可選的，不是該教程的必要工具。

![](images/tmux-screenshot.png)

> 開啟 tmux 同步的方法：按下 `ctrb+b` 和 `shift`，接著輸入 `set synchronize-panes on`。關閉同步可以輸入 `set synchronize-panes off`。

下一步: [安裝命令行工具](02-client-tools.md)
