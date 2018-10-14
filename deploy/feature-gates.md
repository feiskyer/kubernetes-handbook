# 特性开关

特性开关（Feature Gates）是 Kubernetes 中用来开启实验性功能的配置，可以通过选项 `--feature-gates` 来给不同的组件（如 kube-apiserver、kube-controller-manager、kube-scheduler、kubelet、kube-proxy等）开启功能特性。

| Feature                                   | Default | Stage      | Since | Until |
| ----------------------------------------- | ------- | ---------- | ----- | ----- |
| `Accelerators`                            | `false` | Alpha      | 1.6   | 1.10  |
| `AdvancedAuditing`                        | `false` | Alpha      | 1.7   | 1.7   |
| `AdvancedAuditing`                        | `true`  | Beta       | 1.8   | 1.11  |
| `AdvancedAuditing`                        | `true`  | GA         | 1.12  | -     |
| `AffinityInAnnotations`                   | `false` | Alpha      | 1.6   | 1.7   |
| `AllowExtTrafficLocalEndpoints`           | `false` | Beta       | 1.4   | 1.6   |
| `AllowExtTrafficLocalEndpoints`           | `true`  | GA         | 1.7   | -     |
| `APIListChunking`                         | `false` | Alpha      | 1.8   | 1.8   |
| `APIListChunking`                         | `true`  | Beta       | 1.9   |       |
| `APIResponseCompression`                  | `false` | Alpha      | 1.7   |       |
| `AppArmor`                                | `true`  | Beta       | 1.4   |       |
| `AttachVolumeLimit`                       | `false` | Alpha      | 1.11  |       |
| `BlockVolume`                             | `false` | Alpha      | 1.9   |       |
| `CPUManager`                              | `false` | Alpha      | 1.8   | 1.9   |
| `CPUManager`                              | `true`  | Beta       | 1.10  |       |
| `CRIContainerLogRotation`                 | `false` | Alpha      | 1.10  | 1.10  |
| `CRIContainerLogRotation`                 | `true`  | Beta       | 1.11  |       |
| `CSIBlockVolume`                          | `false` | Alpha      | 1.11  | 1.11  |
| `CSIPersistentVolume`                     | `false` | Alpha      | 1.9   | 1.9   |
| `CSIPersistentVolume`                     | `true`  | Beta       | 1.10  |       |
| `CustomPodDNS`                            | `false` | Alpha      | 1.9   | 1.9   |
| `CustomPodDNS`                            | `true`  | Beta       | 1.10  |       |
| `CustomResourceSubresources`              | `false` | Alpha      | 1.10  |       |
| `CustomResourceValidation`                | `false` | Alpha      | 1.8   | 1.8   |
| `CustomResourceValidation`                | `true`  | Beta       | 1.9   |       |
| `DebugContainers`                         | `false` | Alpha      | 1.10  |       |
| `DevicePlugins`                           | `false` | Alpha      | 1.8   | 1.9   |
| `DevicePlugins`                           | `true`  | Beta       | 1.10  |       |
| `DynamicKubeletConfig`                    | `false` | Alpha      | 1.4   | 1.10  |
| `DynamicKubeletConfig`                    | `true`  | Beta       | 1.11  |       |
| `DynamicProvisioningScheduling`           | `false` | Alpha      | 1.11  | 1.11  |
| `DynamicVolumeProvisioning`               | `true`  | Alpha      | 1.3   | 1.7   |
| `DynamicVolumeProvisioning`               | `true`  | GA         | 1.8   |       |
| `EnableEquivalenceClassCache`             | `false` | Alpha      | 1.8   |       |
| `ExpandInUsePersistentVolumes`            | `false` | Alpha      | 1.11  |       |
| `ExpandPersistentVolumes`                 | `false` | Alpha      | 1.8   | 1.10  |
| `ExpandPersistentVolumes`                 | `true`  | Beta       | 1.11  |       |
| `ExperimentalCriticalPodAnnotation`       | `false` | Alpha      | 1.5   |       |
| `ExperimentalHostUserNamespaceDefaulting` | `false` | Beta       | 1.5   |       |
| `GCERegionalPersistentDisk`               | `true`  | Beta       | 1.10  |       |
| `HugePages`                               | `false` | Alpha      | 1.8   | 1.9   |
| `HugePages`                               | `true`  | Beta       | 1.10  |       |
| `HyperVContainer`                         | `false` | Alpha      | 1.10  |       |
| `Initializers`                            | `false` | Alpha      | 1.7   |       |
| `KubeletConfigFile`                       | `false` | Alpha      | 1.8   | 1.9   |
| `KubeletPluginsWatcher`                   | `false` | Alpha      | 1.11  | 1.11  |
| `KubeletPluginsWatcher`                   | `true`  | Beta       | 1.12  |       |
| `LocalStorageCapacityIsolation`           | `false` | Alpha      | 1.7   | 1.9   |
| `LocalStorageCapacityIsolation`           | `true`  | Beta       | 1.10  |       |
| `MountContainers`                         | `false` | Alpha      | 1.9   |       |
| `MountPropagation`                        | `false` | Alpha      | 1.8   | 1.9   |
| `MountPropagation`                        | `true`  | Beta       | 1.10  | 1.11  |
| `MountPropagation`                        | `true`  | GA         | 1.12  |       |
| `PersistentLocalVolumes`                  | `false` | Alpha      | 1.7   | 1.9   |
| `PersistentLocalVolumes`                  | `true`  | Beta       | 1.10  |       |
| `PodPriority`                             | `false` | Alpha      | 1.8   |       |
| `PodReadinessGates`                       | `false` | Alpha      | 1.11  |       |
| `PodReadinessGates`                       | `true`  | Beta       | 1.12  |       |
| `PodShareProcessNamespace`                | `false` | Alpha      | 1.10  |       |
| `PodShareProcessNamespace`                | `true`  | Beta       | 1.12  |       |
| `PVCProtection`                           | `false` | Alpha      | 1.9   | 1.9   |
| `ReadOnlyAPIDataVolumes`                  | `true`  | Deprecated | 1.10  |       |
| `ResourceLimitsPriorityFunction`          | `false` | Alpha      | 1.9   |       |
| `RotateKubeletClientCertificate`          | `true`  | Beta       | 1.7   |       |
| `RotateKubeletServerCertificate`          | `false` | Alpha      | 1.7   |       |
| `RunAsGroup`                              | `false` | Alpha      | 1.10  |       |
| `RuntimeClass`                            | `false` | Alpha      | 1.12  |       |
| `SCTPSupport`                             | `false` | Alpha      | 1.12  |       |
| `ServiceNodeExclusion`                    | `false` | Alpha      | 1.8   |       |
| `StorageObjectInUseProtection`            | `true`  | Beta       | 1.10  | 1.10  |
| `StorageObjectInUseProtection`            | `true`  | GA         | 1.11  |       |
| `StreamingProxyRedirects`                 | `true`  | Beta       | 1.5   |       |
| `SupportIPVSProxyMode`                    | `false` | Alpha      | 1.8   | 1.8   |
| `SupportIPVSProxyMode`                    | `false` | Beta       | 1.9   | 1.9   |
| `SupportIPVSProxyMode`                    | `true`  | Beta       | 1.10  | 1.10  |
| `SupportIPVSProxyMode`                    | `true`  | GA         | 1.11  |       |
| `SupportPodPidsLimit`                     | `false` | Alpha      | 1.10  |       |
| `Sysctls`                                 | `true`  | Beta       | 1.11  |       |
| `TaintBasedEvictions`                     | `false` | Alpha      | 1.6   |       |
| `TaintNodesByCondition`                   | `false` | Alpha      | 1.8   |       |
| `TaintNodesByCondition`                   | `true`  | Beta       | 1.12  |       |
| `TokenRequest`                            | `false` | Alpha      | 1.10  | 1.11  |
| `TokenRequest`                            | `True`  | Beta       | 1.12  |       |
| `TokenRequestProjection`                  | `false` | Alpha      | 1.11  | 1.11  |
| `TokenRequestProjection`                  | `True`  | Beta       | 1.12  |       |
| `TTLAfterFinished`                        | `false` | Alpha      | 1.12  |       |
| `VolumeScheduling`                        | `false` | Alpha      | 1.9   | 1.9   |
| `VolumeScheduling`                        | `true`  | Beta       | 1.10  |       |
| `VolumeSubpathEnvExpansion`               | `false` | Alpha      | 1.11  |       |
| `ScheduleDaemonSetPods`                   | `true`  | Beta       | 1.12  |       |

## 参考文档

- [Kubernetes Feature Gates](https://kubernetes.io/docs/reference/command-line-tools-reference/feature-gates/)
