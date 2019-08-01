# 備份恢復

[Velero](https://velero.io/) 是一個提供 Kubernetes 集群和持久卷的備份、遷移以及災難恢復等的開源工具。

## 安裝

從 <https://github.com/heptio/velero/releases> 下載最新的穩定版。

以 Azure 為例，安裝 Velero 需要以下步驟：

（1） 創建存儲賬戶

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

（2）創建 service principal

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

（3）啟動 Velero

```sh
velero install \
    --provider azure \
    --bucket $BLOB_CONTAINER \
    --secret-file ./credentials-velero \
    --backup-location-config resourceGroup=$AZURE_BACKUP_RESOURCE_GROUP,storageAccount=$AZURE_STORAGE_ACCOUNT_ID \
    --snapshot-location-config apiTimeout=<YOUR_TIMEOUT>
```

## 備份

創建定期備份：

```sh
velero schedule create <SCHEDULE NAME> --schedule "0 7 * * *"
```

## 災難恢復

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

## 遷移

首先，在集群 1 中創建備份（默認 TTL 是 30 天，你可以使用 --ttl 來修改）：

```sh
velero backup create <BACKUP-NAME>
```

然後，為集群 2 配置 BackupStorageLocations 和 VolumeSnapshotLocations，指向與集群 1 相同的備份和快照路徑，並確保 BackupStorageLocations 是隻讀的（使用 --access-mode=ReadOnly）。接下來，稍微等一會（默認的同步時間為 1 分鐘），等待 Backup 對象創建成功。

```sh
# The default sync interval is 1 minute, so make sure to wait before checking.
# You can configure this interval with the --backup-sync-period flag to the Velero server.
velero backup describe <BACKUP-NAME>
```

最後，執行數據恢復：

```sh
velero restore create --from-backup <BACKUP-NAME>
velero restore get
velero restore describe <RESTORE-NAME-FROM-GET-COMMAND>
```

## 參考文檔

- <https://velero.io/>

