# Backup and Recovery

[Velero](https://velero.io/) is an open-source tool that provides backup, migration, and disaster recovery for Kubernetes clusters and persistent volumes.

## Installation

Download the latest stable version from [https://github.com/heptio/velero/releases](https://github.com/heptio/velero/releases).

For example, with Azure, installing Velero requires the following steps:

(1) Create a storage account

```bash
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

(2) Create a service principal

```bash
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

(3) Launch Velero

```bash
velero install \
    --provider azure \
    --bucket $BLOB_CONTAINER \
    --secret-file ./credentials-velero \
    --backup-location-config resourceGroup=$AZURE_BACKUP_RESOURCE_GROUP,storageAccount=$AZURE_STORAGE_ACCOUNT_ID \
    --snapshot-location-config apiTimeout=<YOUR_TIMEOUT>
```

## Backup

Create a regular backup:

```bash
velero schedule create <SCHEDULE NAME> --schedule "0 7 * * *"
```

## Disaster Recovery

```bash
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

## Migration

First, create a backup in cluster 1 (the default TTL is 30 days; you can modify it using --ttl):

```bash
velero backup create <BACKUP-NAME>
```

Next, configure BackupStorageLocations and VolumeSnapshotLocations for cluster 2 to point to the same backup and snapshot paths as cluster 1 and make sure BackupStorageLocations are read-only (--access-mode=ReadOnly). Then wait a moment (the default sync time is 1 minute), until the Backup object is successfully created.

```bash
# The default sync interval is 1 minute, so make sure to wait before checking.
# You can configure this interval with the --backup-sync-period flag to the Velero server.
velero backup describe <BACKUP-NAME>
```

Finally, perform data recovery:

```bash
velero restore create --from-backup <BACKACK-NAME>
velero restore get
velero restore describe <RESTORE-NAME-FROM-GET-COMMAND>
```

## Reference Documents

* [https://velero.io/](https://velero.io/)
