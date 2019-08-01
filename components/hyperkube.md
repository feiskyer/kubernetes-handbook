# hyperkube

hyperkube是Kubernetes的allinone binary，可以用來啟動多種kubernetes服務，常用在Docker鏡像中。每個Kubernetes發佈都會同時發佈一個包含hyperkube的docker鏡像，如`gcr.io/google_containers/hyperkube:v1.6.4`。

hyperkube支持的子命令包括

- kubelet
- apiserver
- controller-manager
- federation-apiserver
- federation-controller-manager
- kubectl
- proxy
- scheduler
