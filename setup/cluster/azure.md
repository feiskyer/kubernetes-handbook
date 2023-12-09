# Exploring Azure's Container Services 

Azure's container services, specifically the Azure Container Service (AKS) and Azure Container Service (ACS), offer unique opportunities for deployment and management of containerized applications. AKS, recently debuted by Microsoft Azure, runs separately from ACS. Through AKS, users can easily deploy and manage containerized applications without needing specialist knowledge of container business processes. Even better? The AKS platform doesn't require any additional user maintenance - it offers automatic upgrades, fault repair, and scaling of resource pools as needed. What’s more, users only pay for virtual machines running their containers - AKS’s cluster management is completely free of charge.

Since 2015, Microsoft Azure's ACS has supported a range of container orchestration tools, including Kubernetes, DCOS, and Dockers Swarm. What's also cool about ACS is that its core function is open source – users can check it out and download it from their Github page at [https://github.com/Azure/acs-engine](https://github.com/Azure/acs-engine).

## AKS: A Deep Dive

### Getting Started

Following are simple steps to get started with AKS. The process will require the Azure CLI software to be installed on your computer. If it's not already installed, you can do that from [here](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli?view=azure-cli-latest).

Before you can create AKS clusters, you first need to enable AKS using the following command:

```bash
# Enable AKS
az provider register -n Microsoft.ContainerService
```

The next step is to create a resource group to manage all the related resources:

```bash
# Create Resource Group
az group create --name group1 --location centralus
```

Now, you are ready to create your AKS clusters:

```bash
# Create aks
az aks create --resource-group group1 --name myK8sCluster --node-count 3 --generate-ssh-keys
```

It’s almost done! Once your cluster is created, install and configure kubectl:

```bash
# Install kubectl
az aks install-cli

# Configure kubectl
az aks get-credentials --resource-group=group1 --name=myK8sCluster
```

>Using version 2.0.24 of azure-cli might result in the `az aks get-credentials` command failing. You can fix this by upgrading to a newer version or reverting back to version 2.0.23.

### Connect with Dashboard

```bash
# Create dashboard
az aks browse --resource-group group1 --name myK8SCluster
```

### Manually enlarge or shrink your cluster

```bash
az aks scale --resource-group=group1 --name=myK8SCluster --agent-count 5
```

### Upgrade your cluster

Get your cluster's current version and check the ones you can upgrade to:

```bash
# Current version and upgradable versions
az aks get-versions --name myK8sCluster --resource-group group1 --output table

# Upgrade to version 1.11.3
az aks upgrade --name myK8sCluster --resource-group group1 --kubernetes-version 1.11.3
```

The graphic below shows the process of deploying a version 1.7.7 cluster and upgrading it to version 1.8.1:
 
![](https://feisky.xyz/images/aks-examples.gif)

### Using Helm

Other tools and services in the Kubernetes community can also be used, such as deploying the Nginx Ingress Controller with Helm:

```bash
helm init --client-only
helm install stable/nginx-ingress
```

### Cluster deletion

Your cluster can be deleted when no longer required:

```bash
az group delete --name group1 --yes --no-wait
```

## Looking at acs-engine

Although AKS is expected to be the future of Azure's container services, many users value being able to manage their own container clusters to ensure maximum flexibility (such as customizing master services).  Such users can utilize the open-source [acs-engine](https://github.com/Azure/acs-engine) for creating and managing their clusters. Acs-engine is, actually, core to ACS. It is a command line tool that assists with deployment and management of Kubernetes, Swarm, and DC/OS clusters, by transforming a container cluster descriptor file into a group of ARM (Azure Resource Manager) templates.

In acs-engine, each cluster is described through a json file. For example, a Kubernetes cluster can be described as follows:

```bash
{
  "apiVersion": "vlabs",
  "properties": {
    "orchestratorProfile": {
      ...
    },
    "masterProfile": {
      ...
    },
    "agentPoolProfiles": [
      {
        ...
      }
    ],
    ...
}
```

## Azure's Container Registry  

Around the same time that AKS was launched, Azure also debuted their Azure Container Registry (ACR) services. This service hosts users' private images.

```bash
# Create ACR
az acr create --resource-group myResourceGroup --name <acrName> --sku Basic --admin-enabled true

# Login to the registry:
az acr login --name <acrName>

# Tag your image:
az acr list --resource-group myResourceGroup --query "[].{acrLoginServer:loginServer}" --output table
docker tag azure-vote-front <acrLoginServer>/azure-vote-front:redis-v1

# Push your image to the registry
docker push <acrLoginServer>/azure-vote-front:redis-v1

# List available images
az acr repository list --name <acrName> --output table
```

## Virtual Kubelet

Azure's container instances (ACI) offer a simplified way to run containers in Azure as ACI effectively absolves users from having to configure any virtual machines or other sophisticated services. Ideal for fast growth and resource adjustment, ACI is designed to be relatively straightforward. The [Virtual Kubelet](https://github.com/virtual-kubelet/virtual-kubelet) allows ACI to function as an unlimited Node for a Kubernetes cluster, making Node quantity a non-issue. ACI then automatically manages the cluster's resources based on the containers in operation.

![](../../.gitbook/assets/virtual-kubelet%20%284%29.png)

You can use Helm to deploy your Virtual Kubelet:

```bash
RELEASE_NAME=virtual-kubelet
CHART_URL=https://github.com/virtual-kubelet/virtual-kubelet/raw/master/charts/virtual-kubelet-0.4.0.tgz

helm install "$CHART_URL" --name "$RELEASE_NAME" --namespace kube-system --set env.azureClientId=<YOUR-AZURECLIENTID-HERE>,env.azureClientKey=<YOUR-AZURECLIENTKEY-HERE>,env.azureTenantId=<YOUR-AZURETENANTID-HERE>,env.azureSubscriptionId=<YOUR-AZURESUBSCRIPTIONID-HERE>,env.aciResourceGroup=<YOUR-ACIRESOURCEGROUP-HERE>,env.nodeName=aci, env.nodeOsType=<Linux|Windows>,env.nodeTaint=azure.com/aci
```

## References

* [AKS – Managed Kubernetes on Azure](https://www.reddit.com/r/AZURE/comments/7d7diz/ama_aks_managed_kubernetes_on_azure/)
* [Azure Container Service \(AKS\)](https://docs.microsoft.com/en-us/azure/aks/)
* [Azure/acs-engine Github](https://github.com/Azure/acs-engine)
* [acs-engine/examples](https://github.com/Azure/acs-engine/tree/master/examples)
