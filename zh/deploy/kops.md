# kops 集群部署

[kops](https://github.com/kubernetes/kops) 是一个生产级 Kubernetes 集群部署工具，可以在 AWS、GCE、VMWare vSphere 等平台上自动部署高可用的 Kubernetes 集群。主要功能包括

- 自动部署高可用的 kubernetes 集群
- 支持从 [kube-up](https://github.com/kubernetes/kops/blob/master/docs/upgrade_from_kubeup.md) 创建的集群升级到 kops 版本
- dry-run 和自动幂等升级等基于状态同步模型
- 支持自动生成 AWS CloudFormation 和 Terraform 配置
- 支持自定义扩展 add-ons
- 命令行自动补全

## 安装 kops 和 kubectl

```sh
# on macOS
brew install kubectl kops

# on Linux
wget https://github.com/kubernetes/kops/releases/download/1.7.0/kops-linux-amd64
chmod +x kops-linux-amd64
mv kops-linux-amd64 /usr/local/bin/kops
```

## 在 AWS 上面部署

首先需要安装 AWS CLI 并配置 IAM：

```sh
# install AWS CLI
pip install awscli

# configure iam
aws iam create-group --group-name kops
aws iam attach-group-policy --policy-arn arn:aws:iam::aws:policy/AmazonEC2FullAccess --group-name kops
aws iam attach-group-policy --policy-arn arn:aws:iam::aws:policy/AmazonRoute53FullAccess --group-name kops
aws iam attach-group-policy --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess --group-name kops
aws iam attach-group-policy --policy-arn arn:aws:iam::aws:policy/IAMFullAccess --group-name kops
aws iam attach-group-policy --policy-arn arn:aws:iam::aws:policy/AmazonVPCFullAccess --group-name kops
aws iam create-user --user-name kops
aws iam add-user-to-group --user-name kops --group-name kops
aws iam create-access-key --user-name kops

# configure the aws client to use your new IAM user
aws configure           # Use your new access and secret key here
aws iam list-users      # you should see a list of all your IAM users here

# Because "aws configure" doesn't export these vars for kops to use, we export them now
export AWS_ACCESS_KEY_ID=<access key>
export AWS_SECRET_ACCESS_KEY=<secret key>
```

创建 route53 域名

```sh
aws route53 create-hosted-zone --name dev.example.com --caller-reference 1
```

创建 s3 存储 bucket

```sh
aws s3api create-bucket --bucket clusters.dev.example.com --region us-east-1
aws s3api put-bucket-versioning --bucket clusters.dev.example.com  --versioning-configuration Status=Enabled
```

部署 Kubernetes 集群

```sh
export KOPS_STATE_STORE=s3://clusters.dev.example.com

kops create cluster --zones=us-east-1c useast1.dev.example.com --yes
```

当然，也可以部署一个高可用的集群

```sh
kops create cluster \
    --node-count 3 \
    --zones us-west-2a,us-west-2b,us-west-2c \
    --master-zones us-west-2a,us-west-2b,us-west-2c \
    --node-size t2.medium \
    --master-size t2.medium \
    --topology private \
    --networking kopeio-vxlan \
    hacluster.example.com
```

删除集群

```sh
kops delete cluster --name ${NAME} --yes
```

## 在 GCE 上面部署

```sh
# Create cluster in GCE.
# This is an alpha feature.
export KOPS_STATE_STORE="gs://mybucket-kops"
export ZONES=${MASTER_ZONES:-"us-east1-b,us-east1-c,us-east1-d"}
export KOPS_FEATURE_FLAGS=AlphaAllowGCE

kops create cluster kubernetes-k8s-gce.example.com
  --zones $ZONES \
  --master-zones $ZONES \
  --node-count 3
  --project my-gce-project \
  --image "ubuntu-os-cloud/ubuntu-1604-xenial-v20170202" \
  --yes
```
