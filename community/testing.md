# Unit Testing and Integration Testing

* [Current Test Status](https://prow.k8s.io/)
* [Aggregated Failures](https://storage.googleapis.com/k8s-gubernator/triage/index.html)
* [Test Grid](https://k8s-testgrid.appspot.com/)

## Unit Testing

Unit testing is solely dependent on the source code, serving as the simplest method to test if the code logic aligns with expectations.

### Run all Unit Tests

```bash
make test
```

### Test Specific Package(s) Only

```bash
# Single package
make test WHAT=./pkg/api
# Multiple packages
make test WHAT=./pkg/{api,kubelet}
```

Or, you can directly use `go test`

```bash
go test -v k8s.io/kubernetes/pkg/kubelet
```

### Test a Specific Test Case in a Given Package Only

```bash
# Runs TestValidatePod in pkg/api/validation with the verbose flag set
make test WHAT=./pkg/api/validation KUBE_GOFLAGS="-v" KUBE_TEST_ARGS='-run ^TestValidatePod$'

# Runs tests that match the regex ValidatePod|ValidateConfigMap in pkg/api/validation
make test WHAT=./pkg/api/validation KUBE_GOFLAGS="-v" KUBE_TEST_ARGS="-run ValidatePod\\|ValidateConfigMap$"
```

Or simply use `go test`

```bash
go test -v k8s.io/kubernetes/pkg/api/validation -run ^TestValidatePod$
```

### Parallel Testing

Parallel testing is an effective way to root out flakes:

```bash
# Have 2 workers run all tests 5 times each (10 total iterations).
make test PARALLEL=2 ITERATION=5
```

### Generate Test Reports

```bash
make test KUBE_COVER=y
```

## Benchmark Testing

```bash
go test ./pkg/apiserver -benchmem -run=XXX -bench=BenchmarkWatch
```

## Integration Testing

Kubernetes integration tests require the installation of etcd (just the installation, no need to start it up), like:

```bash
hack/install-etcd.sh  # Installs in ./third_party/etcd
echo export PATH="\$PATH:$(pwd)/third_party/etcd" >> ~/.profile  # Add to PATH
```

Integration tests will automatically start etcd and Kubernetes services when needed and run the tests within [test/integration](https://github.com/kubernetes/kubernetes/tree/master/test/integration).

### Run All Integration Tests

```bash
make test-integration  # Run all integration tests.
```

### Specify Integration Test Cases

```bash
# Run integration test TestPodUpdateActiveDeadlineSeconds with the verbose flag set.
make test-integration KUBE_GOFLAGS="-v" KUBE_TEST_ARGS="-run ^TestPodUpdateActiveDeadlineSeconds$"
```

## End-to-End (e2e) Testing

End-to-End (e2e) testing simulates user actions on Kubernetes, ensuring that the behavior of the Kubernetes services or clusters is fully in line with the design expectations.

Before starting e2e testing, you need to compile the test files and set KUBERNETES\_PROVIDER (default is gce):

```text
make WHAT='test/e2e/e2e.test'
make ginkgo
export KUBERNETES_PROVIDER=local
```

### Start Cluster, Test, and Stop Cluster Eventually

```bash
# Builds Kubernetes, puts up a cluster, runs tests, and tears everything down
go run hack/e2e.go -- -v --build --up --test --down
```

### Test Specific Case Only

```bash
go run hack/e2e.go -v -test --test_args='--ginkgo.focus=Kubectl\sclient\s\[k8s\.io\]\sKubectl\srolling\-update\sshould\ssupport\srolling\-update\sto\ssame\simage\s\[Conformance\]$'
```

### Skip Test Cases

```bash
go run hack/e2e.go -- -v --test --test_args="--ginkgo.skip=Pods.*env
```

### Parallel Testing

```bash
# Run tests in parallel, skip any that must be run serially
GINKGO_PARALLEL=y go run hack/e2e.go --v --test --test_args="--ginkgo.skip=\[Serial\]"

# Run tests in parallel, skip any that must be run serially and keep the test namespace if test failed
GINKGO_PARALLEL=y go run hack/e2e.go --v --test --test_args="--ginkgo.skip=\[Serial\] --delete-namespace-on-failure=false"
```

### Clean Up Testing Resources

```bash
go run hack/e2e.go -- -v --down
```

### Useful `-ctl`

```bash
# -ctl can be used to quickly call kubectl against your e2e cluster. Useful for
# cleaning up after a failed test or viewing logs. Use -v to avoid suppressing
# kubectl output.
go run hack/e2e.go -- -v -ctl='get events'
go run hack/e2e.go -- -v -ctl='delete pod foobar'
```

## Federation E2E Testing

```bash
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

You can use `cluster/log-dump.sh <directory>` to download related logs conveniently, which can help troubleshoot issues encountered during testing.

## Node E2E Testing

Node e2e only tests Kubelet-related functionalities and can be conducted either locally or inside clusters.

```bash
export KUBERNETES_PROVIDER=local
make test-e2e-node FOCUS="InitContainer"
make test_e2e_node TEST_ARGS="--experimental-cgroups-per-qos=true"
```

## Additional Explanation

You can conveniently obtain desired data with the assistance of the kubectl template. For example, the method to query the image of a certain container is:

```bash
kubectl get pods nginx-4263166205-ggst4 -o template '--template={{if (exists ."status""containerStatuses")}}{{range .status.containerStatuses}}{{if eq .name "nginx"}}{{.image}}{{end}}{{end}}{{end}}'
```

## Referenced Documents

* [Kubernetes testing](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-testing/testing.md)
* [End-to-End Testing](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-testing/e2e-tests.md)
* [Node e2e test](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-node/e2e-node-tests.md)
* [How to write e2e test](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-testing/writing-good-e2e-tests.md)
* [Coding Conventions](https://github.com/kubernetes/community/blob/master/contributors/guide/coding-conventions.md)
