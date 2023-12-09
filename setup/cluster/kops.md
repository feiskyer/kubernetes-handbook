# Mastering Kops

[Kops](https://github.com/kubernetes/kops) is a top-tier tool for deploying Kubernetes clusters. Its versatility allows it to automatically set up high-availability Kubernetes clusters on platforms such as AWS, GCE, and VMWare vSphere. Here are some of its standout features:

* Automated deployment of high-availability Kubernetes clusters.
* Upgrade capability from clusters created with [kube-up](https://github.com/kubernetes/kops/blob/master/docs/upgrade_from_kubeup.md) to Kops versions.
* Dry-run and automatic idempotent upgrades, based on a state synchronization model.
* Auto-generation of AWS CloudFormation and Terraform configurations.
* Customizable extension add-ons.
* Command-line auto-completion.

## Installing kops and kubectl

```bash
# on macOS
brew install kubectl kops

# on Linux
wget https://github.com/kubernetes/kops/releases/download/1.7.0/kops-linux-amd64
chmod +x kops-linux-amd64
mv kops-linux-amd64 /usr/local/bin/kops
```

## Launching on AWS

First, you'll need to install AWS CLI and configure IAM:

```bash
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

Next, create a route53 domain:

```bash
aws route53 create-hosted-zone --name dev.example.com --caller-reference 1
```

Then, set up an S3 storage bucket:

```bash
aws s3api create-bucket --bucket clusters.dev.example.com --region us-east-1
aws s3api put-bucket-versioning --bucket clusters.dev.example.com  --versioning-configuration Status=Enabled
```

Now you're ready to deploy a Kubernetes cluster:

```bash
export KOPS_STATE_STORE=s3://clusters.dev.example.com

kops create cluster --zones=us-east-1c useast1.dev.example.com --yes
```

Want a high-availability cluster? No problem:

```bash
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

When your needs shift, you can delete your cluster:

```bash
kops delete cluster --name ${NAME} --yes
```

## Launching on GCE

```bash
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
