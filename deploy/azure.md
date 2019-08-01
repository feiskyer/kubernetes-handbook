# Kubernetes on Azure

Azure 容器服務 (AKS) 是 Microsoft Azure 最近發佈的一個託管的 Kubernetes 服務（預覽版），它獨立於現有的 Azure Container Service （ACS）。藉助 AKS 用戶無需具備容器業務流程的專業知識就可以快速、輕鬆的部署和管理容器化的應用程序。AKS 支持自動升級和自動故障修復，按需自動擴展或縮放資源池，消除了用戶管理和維護 Kubernetes 集群的負擔。並且集群管理本身是免費的，Azure 只收取容器底層的虛擬機的費用。

ACS 是 Microsoft Azure 在 2015 年推出的容器服務，支持 Kubernetes、DCOS 以及 Dockers Swarm 等多種容器編排工具。並且 ACS 的核心功能是開源的，用戶可以通過 https://github.com/Azure/acs-engine 來查看和下載使用。

## AKS

### 基本使用

以下文檔假設用戶已經安裝好了 Azure CLI ，如未安裝可以參考 [這裡](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli?view=azure-cli-latest) 操作。

在創建 AKS 集群之前，首先需要開啟容器服務

```sh
# Enable AKS
az provider register -n Microsoft.ContainerService
```

然後創建一個資源組（Resource Group）用來管理所有相關資源

```sh
# Create Resource Group
az group create --name group1 --location centralus
```

接下來就可以創建 AKS 集群了

```sh
# Create aks
az aks create --resource-group group1 --name myK8sCluster --node-count 3 --generate-ssh-keys
```

稍等一會，集群創建好後安裝並配置 kubectl

```sh
# Install kubectl
az aks install-cli

# Configure kubectl
az aks get-credentials --resource-group=group1 --name=myK8sCluster
```

> 注意使用 azure-cli 2.0.24 版本時，`az aks get-credentials` 命令可能會失敗，解決方法是升級到更新版本，或回退到 2.0.23 版本。

### 訪問 Dashboard

```sh
# Create dashboard
az aks browse --resource-group group1 --name myK8SCluster
```

### 手動擴展或收縮集群

```sh
az aks scale --resource-group=group1 --name=myK8SCluster --agent-count 5
```

### 升級集群

```sh
# 查詢當前集群的版本以及可升級的版本
az aks get-versions --name myK8sCluster --resource-group group1 --output table

# 升級到 1.11.3 版本
az aks upgrade --name myK8sCluster --resource-group group1 --kubernetes-version 1.11.3
```

下圖動態展示了一個部署 v1.7.7 版本集群並升級到 v1.8.1 的過程：

![](https://feisky.xyz/images/aks-examples.gif)

### 使用 Helm

當然也可以使用其他 Kubernetes 社區提供的工具和服務，比如使用 Helm 部署 Nginx Ingress 控制器

```sh
helm init --client-only
helm install stable/nginx-ingress
```

### 刪除集群

當集群不再需要時，可以刪除集群

```sh
az group delete --name group1 --yes --no-wait
```

## acs-engine

雖然未來 AKS 是 Azure 容器服務的下一代主打產品，但用戶可能還是希望可以自己管理容器集群以保證足夠的靈活性（比如自定義 master 服務等）。這時用戶可以使用開源的 [acs-engine](https://github.com/Azure/acs-engine) 來創建和管理自己的集群。acs-engine 其實就是 ACS 的核心部分，提供了一個部署和管理 Kubernetes、Swarm 和 DC/OS 集群的命令行工具。它通過將容器集群描述文件轉化為一組 ARM（Azure Resource Manager）模板來建立容器集群。

在 acs-engine 中，每個集群都通過一個 json 文件來描述，比如一個 Kubernetes 集群可以描述為

```sh
{
  "apiVersion": "vlabs",
  "properties": {
    "orchestratorProfile": {
      "orchestratorType": "Kubernetes",
      "orchestratorRelease": "1.12",
      "kubernetesConfig": {
        "networkPolicy": "",
        "enableRbac": true
      }
    },
    "masterProfile": {
      "count": 1,
      "dnsPrefix": "",
      "vmSize": "Standard_D2_v2"
    },
    "agentPoolProfiles": [
      {
        "name": "agentpool1",
        "count": 3,
        "vmSize": "Standard_D2_v2",
        "availabilityProfile": "AvailabilitySet"
      }
    ],
    "linuxProfile": {
      "adminUsername": "azureuser",
      "ssh": {
        "publicKeys": [
          {
            "keyData": ""
          }
        ]
      }
    },
    "servicePrincipalProfile": {
      "clientId": "",
      "secret": ""
    }
  }
}
```

orchestratorType 指定了部署集群的類型，目前支持三種

- Kubernetes
- Swarm
- DCOS

而創建集群的步驟也很簡單

```sh
# create a new resource group.
az group create --name myResourceGroup  --location "centralus"

# start deploy the kubernetes
acs-engine deploy --resource-group myResourceGroup --subscription-id <subscription-id> --auto-suffix --api-model kubernetes.json --location centralus --dns-prefix <dns-prefix>

# setup kubectl
export KUBECONFIG="$(pwd)/_output/<name-with-suffix>/kubeconfig/kubeconfig.centralus.json"
kubectl get node
```

### 開啟 RBAC

RBAC 默認是不可以開啟的，可以通過設置 enableRbac 開啟

```json
     "kubernetesConfig": {
        "enableRbac": true
      }
```

### 自定義 Kubernetes 版本

acs-engine 基於 hyperkube 來部署 Kubernetes 服務，所以只需要使用自定義的 hyperkube 鏡像即可。

```json
{
	"kubernetesConfig": {
		"customHyperkubeImage": "docker.io/feisky/hyperkube-amd64:v1.12.1"
	}
}
```

hyperkube 鏡像可以從 Kubernetes 源碼編譯，編譯步驟為

```sh
# Build Kubernetes
bash build/run.sh make KUBE_FASTBUILD=true ARCH=amd64

# Build docker image for hyperkube
cd cluster/images/hyperkube
make VERSION=v1.12.x-dev
cd ../../..

# push docker image
docker tag gcr.io/google-containers/hyperkube-amd64:v1.12.x-dev feisky/hyperkube-amd64:v1.12.x-dev
docker push feisky/hyperkube-amd64:v1.12.x-dev
```

### 添加 Windows 節點

可以通過設置 osType 來添加 Windows 節點（完整示例見 [這裡](https://github.com/Azure/acs-engine/blob/master/examples/windows/kubernetes.json)）

```json
    "agentPoolProfiles": [
      {
        "name": "windowspool2",
        "count": 2,
        "vmSize": "Standard_D2_v2",
        "availabilityProfile": "AvailabilitySet",
        "osType": "Windows"
      }
    ],
    "windowsProfile": {
      "adminUsername": "azureuser",
      "adminPassword": "replacepassword1234$"
    },
```

### 使用 GPU

設置 vmSize 為 `Standard_NC*` 或  `Standard_NV*` 會自動配置 GPU，並自動安裝所需要的 NVDIA 驅動。

### 自定義網絡插件

acs-engine 默認使用 kubenet 網絡插件，並通過用戶自定義的路由以及 IP-forwarding 轉發 Pod 網絡。此時，Pod 網絡與 Node 網絡在不同的子網中，Pod 不受 VNET 管理。

用戶還可以使用 [Azure CNI plugin](https://github.com/Azure/azure-container-networking) 插件將 Pod 連接到 Azure VNET 中

```json
"properties": {
    "orchestratorProfile": {
      "orchestratorType": "Kubernetes",
      "kubernetesConfig": {
        "networkPolicy": "azure"
      }
    }
}
```

也可以使用 calico 網絡插件

```json
"properties": {
    "orchestratorProfile": {
      "orchestratorType": "Kubernetes",
      "kubernetesConfig": {
        "networkPolicy": "calico"
      }
    }
}
```

## Azure Container Registry

在 AKS 預覽版發佈的同時，Azure 還同時發佈了 Azure Container Registry（ACR）服務，用於託管用戶的私有鏡像。

```sh
# Create ACR
az acr create --resource-group myResourceGroup --name <acrName> --sku Basic --admin-enabled true

# Login
az acr login --name <acrName>

# Tag the image.
az acr list --resource-group myResourceGroup --query "[].{acrLoginServer:loginServer}" --output table
docker tag azure-vote-front <acrLoginServer>/azure-vote-front:redis-v1

# push image
docker push <acrLoginServer>/azure-vote-front:redis-v1

# List images.
az acr repository list --name <acrName> --output table
```

## Virtual Kubelet

Azure 容器實例（ACI）提供了在 Azure 中運行容器的最簡捷方式，它不需要用戶配置任何虛擬機或其它高級服務。ACI 適用於快速突發式增長和資源調整的業務，但其本身的功能相對比較簡單。 [Virtual Kubelet](https://github.com/virtual-kubelet/virtual-kubelet) 可以將 ACI 作為 Kubernetes 集群的一個無限 Node 使用，這樣就無需考慮 Node 數量的問題，ACI 會根據運行容器自動管理集群資源。

![](images/virtual-kubelet.png)

可以使用 Helm 來部署 Virtual Kubelet：

```sh
RELEASE_NAME=virtual-kubelet
CHART_URL=https://github.com/virtual-kubelet/virtual-kubelet/raw/master/charts/virtual-kubelet-0.4.0.tgz

helm install "$CHART_URL" --name "$RELEASE_NAME" --namespace kube-system --set env.azureClientId=<YOUR-AZURECLIENTID-HERE>,env.azureClientKey=<YOUR-AZURECLIENTKEY-HERE>,env.azureTenantId=<YOUR-AZURETENANTID-HERE>,env.azureSubscriptionId=<YOUR-AZURESUBSCRIPTIONID-HERE>,env.aciResourceGroup=<YOUR-ACIRESOURCEGROUP-HERE>,env.nodeName=aci, env.nodeOsType=<Linux|Windows>,env.nodeTaint=azure.com/aci
```

在開啟 RBAC 的集群中，還需要給 virtual-kubelet 開啟對應的權限。最簡單的方法是給 service account `kube-system:default ` 設置 admin 權限（不推薦生產環境這麼設置，應該設置具體的權限），比如

```sh
kubectl create clusterrolebinding virtual-kubelet-cluster-admin-binding --clusterrole=cluster-admin --serviceaccount=kube-system:default
```

部署成功後，會發現集群中會出現一個新的名為 `aci` 的 Node：

```sh
$ kubectl get nodes aci
NAME      STATUS    ROLES     AGE       VERSION
aci       Ready     agent     34s       v1.8.3
```

此時，就可以通過 ** 指定 nodeName 或者容忍 taint `azure.com/aci=NoSchedule` 調度 ** 到 ACI 上面。比如

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
spec:
  containers:
  - image: nginx
    imagePullPolicy: Always
    name: nginx
    resources:
      requests:
        memory: 100M
        cpu: 1
    ports:
    - containerPort: 80
      name: http
      protocol: TCP
    - containerPort: 443
      name: https
  dnsPolicy: ClusterFirst
  nodeName: aci
```

## 參考文檔

- [AKS – Managed Kubernetes on Azure](https://www.reddit.com/r/AZURE/comments/7d7diz/ama_aks_managed_kubernetes_on_azure/)
- [Azure Container Service (AKS)](https://docs.microsoft.com/en-us/azure/aks/)
- [Azure/acs-engine Github](https://github.com/Azure/acs-engine)
- [acs-engine/examples](https://github.com/Azure/acs-engine/tree/master/examples)
