# 特性开关

特性开关（Feature Gates）是 Kubernetes 中用来开启实验性功能的配置，可以通过选项 `--feature-gates` 来给不同的组件（如 kube-apiserver、kube-controller-manager、kube-scheduler、kubelet、kube-proxy等）开启功能特性。

| 开关名称                                  | 默认开启 | 阶段  | 支持版本 |
| ----------------------------------------- | -------- | ----- | -------- |
| `Accelerators`                            | `false`  | Alpha | 1.6+     |
| `AdvancedAuditing`                        | `false`  | Alpha | 1.7      |
| `AdvancedAuditing`                        | `true`   | Beta  | 1.8+     |
| `AffinityInAnnotations`                   | `false`  | Alpha | 1.6-1.7  |
| `AllowExtTrafficLocalEndpoints`           | `false`  | Beta  | 1.4-1.6  |
| `AllowExtTrafficLocalEndpoints`           | `true`   | GA    | 1.7+     |
| `APIListChunking`                         | `false`  | Alpha | 1.8      |
| `APIListChunking`                         | `true`   | Beta  | 1.9+     |
| `APIResponseCompression`                  | `false`  | Alpha | 1.7+     |
| `AppArmor`                                | `true`   | Beta  | 1.4+     |
| `BlockVolume`                             | `false`  | Alpha | 1.9+     |
| `CPUManager`                              | `false`  | Alpha | 1.8-1.9  |
| `CPUManager`                              | `true`   | Beta  | 1.10     |
| `CSIPersistentVolume`                     | `false`  | Alpha | 1.9+     |
| `CustomPodDNS`                            | `false`  | Alpha | 1.9+     |
| `CustomResourceValidation`                | `false`  | Alpha | 1.8      |
| `CustomResourceValidation`                | `true`   | Beta  | 1.9+     |
| `CustomResourceSubresources`              | `false`  | Alpha | 1.10     |
| `DevicePlugins`                           | `false`  | Alpha | 1.8+     |
| `DynamicKubeletConfig`                    | `false`  | Alpha | 1.4+     |
| `DynamicVolumeProvisioning`               | `true`   | Alpha | 1.3-1.7  |
| `DynamicVolumeProvisioning`               | `true`   | GA    | 1.8+     |
| `EnableEquivalenceClassCache`             | `false`  | Alpha | 1.8+     |
| `ExpandPersistentVolumes`                 | `false`  | Alpha | 1.8+     |
| `ExperimentalCriticalPodAnnotation`       | `false`  | Alpha | 1.5+     |
| `ExperimentalHostUserNamespaceDefaulting` | `false`  | Beta  | 1.5+     |
| `HugePages`                               | `false`  | Alpha | 1.8+     |
| `Initializers`                            | `false`  | Alpha | 1.7+     |
| `KubeletConfigFile`                       | `false`  | Alpha | 1.8+     |
| `LocalStorageCapacityIsolation`           | `false`  | Alpha | 1.7+     |
| `MountContainers`                         | `false`  | Alpha | 1.9+     |
| `MountPropagation`                        | `false`  | Alpha | 1.8+     |
| `PersistentLocalVolumes`                  | `false`  | Alpha | 1.7+     |
| `PodPriority`                             | `false`  | Alpha | 1.8+     |
| `PVCProtection`                           | `false`  | Alpha | 1.9+     |
| `ResourceLimitsPriorityFunction`          | `false`  | Alpha | 1.9+     |
| `RotateKubeletClientCertificate`          | `true`   | Beta  | 1.7+     |
| `RotateKubeletServerCertificate`          | `false`  | Alpha | 1.7+     |
| `ServiceNodeExclusion`                    | `false`  | Alpha | 1.8+     |
| `StreamingProxyRedirects`                 | `true`   | Beta  | 1.5+     |
| `SupportIPVSProxyMode`                    | `false`  | Alpha | 1.8+     |
| `TaintBasedEvictions`                     | `false`  | Alpha | 1.6+     |
| `TaintNodesByCondition`                   | `false`  | Alpha | 1.8+     |
| `VolumeScheduling`                        | `false`  | Alpha | 1.9+     |

## 参考文档

- [Kubernetes Feature Gates](https://kubernetes.io/docs/reference/feature-gates/)
