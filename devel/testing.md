# Kubernetes 測試

* [Current Test Status](https://prow.k8s.io/)
* [Aggregated Failures](https://storage.googleapis.com/k8s-gubernator/triage/index.html)
* [Test Grid](https://k8s-testgrid.appspot.com/)

## 單元測試

單元測試僅依賴於源代碼，是測試代碼邏輯是否符合預期的最簡單方法。

### 運行所有的單元測試

```sh
make test
```

### 僅測試指定的 package

```sh
# 單個 package
make test WHAT=./pkg/api
# 多個 packages
make test WHAT=./pkg/{api,kubelet}
```

或者，也可以直接用 `go test`

```sh
go test -v k8s.io/kubernetes/pkg/kubelet
```

### 僅測試指定 package 的某個測試 case

```sh
# Runs TestValidatePod in pkg/api/validation with the verbose flag set
make test WHAT=./pkg/api/validation KUBE_GOFLAGS="-v" KUBE_TEST_ARGS='-run ^TestValidatePod$'

# Runs tests that match the regex ValidatePod|ValidateConfigMap in pkg/api/validation
make test WHAT=./pkg/api/validation KUBE_GOFLAGS="-v" KUBE_TEST_ARGS="-run ValidatePod\|ValidateConfigMap$"
```

或者直接用 `go test`

```sh
go test -v k8s.io/kubernetes/pkg/api/validation -run ^TestValidatePod$
```

### 並行測試

並行測試是 root out flakes 的一種有效方法：

```sh
# Have 2 workers run all tests 5 times each (10 total iterations).
make test PARALLEL=2 ITERATION=5
```

### 生成測試報告

```sh
make test KUBE_COVER=y
```

## Benchmark 測試

```sh
go test ./pkg/apiserver -benchmem -run=XXX -bench=BenchmarkWatch
```

## 集成測試

Kubernetes 集成測試需要安裝 etcd（只要按照即可，不需要啟動），比如

```sh
hack/install-etcd.sh  # Installs in ./third_party/etcd
echo export PATH="\$PATH:$(pwd)/third_party/etcd" >> ~/.profile  # Add to PATH
```

集成測試會在需要的時候自動啟動 etcd 和 kubernetes 服務，並運行 [test/integration](https://github.com/kubernetes/kubernetes/tree/master/test/integration) 裡面的測試。

### 運行所有集成測試

```sh
make test-integration  # Run all integration tests.
```

### 指定集成測試用例

```sh
# Run integration test TestPodUpdateActiveDeadlineSeconds with the verbose flag set.
make test-integration KUBE_GOFLAGS="-v" KUBE_TEST_ARGS="-run ^TestPodUpdateActiveDeadlineSeconds$"
```

## End to end (e2e) 測試

End to end (e2e) 測試模擬用戶行為操作 Kubernetes，用來保證 Kubernetes 服務或集群的行為完全符合設計預期。

在開啟 e2e 測試之前，需要先編譯測試文件，並設置 KUBERNETES_PROVIDER（默認為 gce）：

```
make WHAT='test/e2e/e2e.test'
make ginkgo
export KUBERNETES_PROVIDER=local
```

### 啟動 cluster，測試，最後停止 cluster

```sh
# build Kubernetes, up a cluster, run tests, and tear everything down
go run hack/e2e.go -- -v --build --up --test --down
```

### 僅測試指定的用例

```sh
go run hack/e2e.go -v -test --test_args='--ginkgo.focus=Kubectl\sclient\s\[k8s\.io\]\sKubectl\srolling\-update\sshould\ssupport\srolling\-update\sto\ssame\simage\s\[Conformance\]$'
```

### 跳過測試用例

```sh
go run hack/e2e.go -- -v --test --test_args="--ginkgo.skip=Pods.*env
```

### 並行測試

```sh
# Run tests in parallel, skip any that must be run serially
GINKGO_PARALLEL=y go run hack/e2e.go --v --test --test_args="--ginkgo.skip=\[Serial\]"

# Run tests in parallel, skip any that must be run serially and keep the test namespace if test failed
GINKGO_PARALLEL=y go run hack/e2e.go --v --test --test_args="--ginkgo.skip=\[Serial\] --delete-namespace-on-failure=false"
```

### 清理測試資源

```sh
go run hack/e2e.go -- -v --down
```

### 有用的 `-ctl`

```sh
# -ctl can be used to quickly call kubectl against your e2e cluster. Useful for
# cleaning up after a failed test or viewing logs. Use -v to avoid suppressing
# kubectl output.
go run hack/e2e.go -- -v -ctl='get events'
go run hack/e2e.go -- -v -ctl='delete pod foobar'
```

## Fedaration e2e 測試

```sh
export FEDERATION=true
export E2E_ZONES="us-central1-a us-central1-b us-central1-f"
# or export FEDERATION_PUSH_REPO_BASE="quay.io/colin_hom"
export FEDERATION_PUSH_REPO_BASE="gcr.io/${GCE_PROJECT_NAME}"

# build container images
KUBE_RELEASE_RUN_TESTS=n KUBE_FASTBUILD=true go run hack/e2e.go -- -v -build

# push the federation container images
build/push-federation-images.sh

# Deploy federation control plane
go run hack/e2e.go -- -v --up

# Finally, run the tests
go run hack/e2e.go -- -v --test --test_args="--ginkgo.focus=\[Feature:Federation\]"

# Don't forget to teardown everything down
go run hack/e2e.go -- -v --down
```

可以用 `cluster/log-dump.sh <directory>` 方便的下載相關日誌，幫助排查測試中碰到的問題。

## Node e2e 測試

Node e2e 僅測試 Kubelet 的相關功能，可以在本地或者集群中測試

```sh
export KUBERNETES_PROVIDER=local
make test-e2e-node FOCUS="InitContainer"
make test_e2e_node TEST_ARGS="--experimental-cgroups-per-qos=true"
```

## 補充說明

藉助 kubectl 的模版可以方便獲取想要的數據，比如查詢某個 container 的鏡像的方法為

```sh
kubectl get pods nginx-4263166205-ggst4 -o template '--template={{if (exists ."status""containerStatuses")}}{{range .status.containerStatuses}}{{if eq .name "nginx"}}{{.image}}{{end}}{{end}}{{end}}'
```

## 參考文檔

* [Kubernetes testing](https://github.com/kubernetes/community/blob/master/contributors/devel/testing.md)
* [End-to-End Testing](https://github.com/kubernetes/community/blob/master/contributors/devel/e2e-tests.md)
* [Node e2e test](https://github.com/kubernetes/community/blob/master/contributors/devel/e2e-node-tests.md)
* [How to write e2e test](https://github.com/kubernetes/community/blob/master/contributors/devel/writing-good-e2e-tests.md)
* [Coding Conventions](https://github.com/kubernetes/community/blob/master/contributors/guide/coding-conventions.md)
