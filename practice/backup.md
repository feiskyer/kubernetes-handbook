# 备份恢复

[Velero](https://velero.io/) 是一个提供 Kubernetes 集群和持久卷的备份、迁移以及灾难恢复等的开源工具。

## 安装

从 <https://github.com/heptio/velero/releases> 下载最新的稳定版。

以 Azure 为例，安装 Velero 需要以下步骤：

（1） 创建存储账户

```sh
AZURE_BACKUP_RESOURCE_GROUP=Velero_Backups
az group create -n $AZURE_BACKUP_RESOURCE_GROUP --location WestUS

AZURE_STORAGE_ACCOUNT_ID="velero$(uuidgen | cut -d '-' -f5 | tr '[A-Z]' '[a-z]')"
az storage account create \
    --name $AZURE_STORAGE_ACCOUNT_ID \
    --resource-group $AZURE_BACKUP_RESOURCE_GROUP \
    --sku Standard_GRS \
    --encryption-services blob \
    --https-only true \
    --kind BlobStorage \
    --access-tier Hot

BLOB_CONTAINER=velero
az storage container create -n $BLOB_CONTAINER --public-access off --account-name $AZURE_STORAGE_ACCOUNT_ID
```

（2）创建 service principal

```sh
AZURE_RESOURCE_GROUP=<NAME_OF_RESOURCE_GROUP>
AZURE_SUBSCRIPTION_ID=`az account list --query '[?isDefault].id' -o tsv`
AZURE_TENANT_ID=`az account list --query '[?isDefault].tenantId' -o tsv`
AZURE_CLIENT_SECRET=`az ad sp create-for-rbac --name "velero" --role "Contributor" --query 'password' -o tsv`
AZURE_CLIENT_ID=`az ad sp list --display-name "velero" --query '[0].appId' -o tsv`

cat << EOF  > ./credentials-velero
AZURE_SUBSCRIPTION_ID=${AZURE_SUBSCRIPTION_ID}
AZURE_TENANT_ID=${AZURE_TENANT_ID}
AZURE_CLIENT_ID=${AZURE_CLIENT_ID}
AZURE_CLIENT_SECRET=${AZURE_CLIENT_SECRET}
AZURE_RESOURCE_GROUP=${AZURE_RESOURCE_GROUP}
EOF
```

（3）启动 Velero

```sh
velero install \
    --provider azure \
    --bucket $BLOB_CONTAINER \
    --secret-file ./credentials-velero \
    --backup-location-config resourceGroup=$AZURE_BACKUP_RESOURCE_GROUP,storageAccount=$AZURE_STORAGE_ACCOUNT_ID \
    --snapshot-location-config apiTimeout=<YOUR_TIMEOUT>
```

## 备份

创建定期备份：

```sh
velero schedule create <SCHEDULE NAME> --schedule "0 7 * * *"
```

## 灾难恢复

```sh
# Update your backup storage location to read-only mode 
kubectl patch backupstoragelocation <STORAGE LOCATION NAME> \
    --namespace velero \
    --type merge \
    --patch '{"spec":{"accessMode":"ReadOnly"}}'

# Create a restore with your most recent Velero Backup
velero restore create --from-backup <SCHEDULE NAME>-<TIMESTAMP>

# When ready, revert your backup storage location to read-write mode
kubectl patch backupstoragelocation <STORAGE LOCATION NAME> \
       --namespace velero \
       --type merge \
       --patch '{"spec":{"accessMode":"ReadWrite"}}'
```

## 迁移

首先，在集群 1 中创建备份（默认 TTL 是 30 天，你可以使用 --ttl 来修改）：

```sh
velero backup create <BACKUP-NAME>
```

然后，为集群 2 配置 BackupStorageLocations 和 VolumeSnapshotLocations，指向与集群 1 相同的备份和快照路径，并确保 BackupStorageLocations 是只读的（使用 --access-mode=ReadOnly）。接下来，稍微等一会（默认的同步时间为 1 分钟），等待 Backup 对象创建成功。

```sh
# The default sync interval is 1 minute, so make sure to wait before checking.
# You can configure this interval with the --backup-sync-period flag to the Velero server.
velero backup describe <BACKUP-NAME>
```

最后，执行数据恢复：

```sh
velero restore create --from-backup <BACKUP-NAME>
velero restore get
velero restore describe <RESTORE-NAME-FROM-GET-COMMAND>
```

## 参考文档

- <https://velero.io/>

