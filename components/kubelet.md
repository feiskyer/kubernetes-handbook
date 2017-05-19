# Kubelet 概述  
每个节点上都运行一个kubelet服务进程，默认监听10250端口，接收并执行master发来的指令，管理Pod及Pod中的容器。每个kubelet进程会在API Server上注册节点自身信息，定期向master节点汇报节点的资源使用情况，并通过cAdvisor监控节点和容器的资源。 
  
##  节点管理  
节点管理主要是节点自注册和节点状态更新：  
(1) Kubelet可以通过设置启动参数 --register-node 来确定是否向API Server注册自己；  
(2) 如果Kubelet没有选择自注册模式，则需要用户自己配置Node资源信息，同时需要告知Kubelet集群上的API Server的位置；  
(3) Kubelet在启动时通过API Server注册节点信息，并定时向API Server发送节点新消息，API Server在接收到新消息后，将信息写入etcd   
   
## Pod管理  
### 获取Pod清单  
Kubelet以PodSpec的方式工作。PodSpec是描述一个Pod的YAML或JSON对象。 kubelet采用一组通过各种机制提供的PodSpecs（主要通过apiserver），并确保这些PodSpecs中描述的Pod正常健康运行。  
  
  向Kubelet提供节点上需要运行的Pod清单的方法：  
  (1) 文件：启动参数 --config 指定的配置目录下的文件(默认/etc/kubernetes/manifests/)。该文件每20秒重新检查一次（可配置）。  
  (2) HTTP endpoint (URL)：启动参数 --manifest-url 设置。每20秒检查一次这个端点（可配置）。  
  (3) API Server：通过API Server监听etcd目录，同步Pod清单。  
  (4) HTTP server：kubelet侦听HTTP请求，并响应简单的API以提交新的Pod清单。  
        
###  通过API Server获取Pod清单及创建Pod的过程  
Kubelet通过API Server Client(Kubelet启动时创建)使用Watch加List的方式监听"/registry/nodes/$当前节点名"和“/registry/pods”目录，将获取的信息同步到本地缓存中。  
  
  Kubelet监听etcd，所有针对Pod的操作都将会被Kubelet监听到。如果发现有新的绑定到本节点的Pod，则按照Pod清单的要求创建该Pod。 
    
  如果发现本地的Pod被修改，则Kubelet会做出相应的修改，比如删除Pod中某个容器时，则通过Docker Client删除该容器。  
  如果发现删除本节点的Pod，则删除相应的Pod，并通过Docker Client删除Pod中的容器。  
  
  Kubelet读取监听到的信息，如果是创建和修改Pod任务，则执行如下处理：  
  (1) 为该Pod创建一个数据目录；  
  (2) 从API Server读取该Pod清单；  
  (3) 为该Pod挂载外部卷；  
  (4) 下载Pod用到的Secret；  
  (5) 检查已经在节点上运行的Pod，如果该Pod没有容器或Pause容器没有启动，则先停止Pod里所有容器的进程。如果在Pod中有需要删除的容器，则删除这些容器；  
  (6) 用“kubernetes/pause”镜像为每个Pod创建一个容器。Pause容器用于接管Pod中所有其他容器的网络。每创建一个新的Pod，Kubelet都会先创建一个Pause容器，然后创建其他容器。  
  (7) 为Pod中的每个容器做如下处理：       
    a. 为容器计算一个hash值，然后用容器的名字去Docker查询对应容器的hash值。若查找到容器，且两者hash值不同，则停止Docker中容器的进程，并停止与之关联的Pause容器的进程；若两者相同，则不做任何处理；  
    b. 如果容器被终止了，且容器没有指定的restartPolicy，则不做任何处理；  
    c. 调用Docker Client下载容器镜像，调用Docker Client运行容器。
  
###  Static Pod  
所有以非API Server方式创建的Pod都叫Static Pod。Kubelet将Static Pod的状态汇报给API Server，API Server为该Static Pod创建一个Mirror Pod和其相匹配。Mirror Pod的状态将真实反映Static Pod的状态。当Static Pod被删除时，与之相对应的Mirror Pod也会被删除。  
      
##  容器健康检查  
Pod通过两类探针检查容器的健康状态:  
(1) LivenessProbe 探针：用于判断容器是否健康，告诉Kubelet一个容器什么时候处于不健康的状态。如果LivenessProbe探针探测到容器不健康，则Kubelet将删除该容器，并根据容器的重启策略做相应的处理。如果一个容器不包含LivenessProbe探针，那么Kubelet认为该容器的LivenessProbe探针返回的值永远是“Success”；  
(2)ReadinessProbe：用于判断容器是否启动完成且准备接收请求。如果ReadinessProbe探针探测到失败，则Pod的状态将被修改。Endpoint Controller将从Service的Endpoint中删除包含该容器所在Pod的IP地址的Endpoint条目。  
  Kubelet定期调用容器中的LivenessProbe探针来诊断容器的健康状况。LivenessProbe包含如下三种实现方式：  
  (1) ExecAction：在容器内部执行一个命令，如果该命令的退出状态码为0，则表明容器健康；  
  (2) TCPSocketAction：通过容器的IP地址和端口号执行TCP检查，如果端口能被访问，则表明容器健康；   
  (3) HTTPGetAction：通过容器的IP地址和端口号及路径调用HTTP GET方法，如果响应的状态码大于等于200且小于400，则认为容器状态健康。  
    
LivenessProbe探针包含在Pod定义的spec.containers.{某个容器}中。  
  
##  cAdvisor资源监控  
Kubernetes集群中，应用程序的执行情况可以在不同的级别上监测到，这些级别包括：容器、Pod、Service和整个集群。  
Heapster项目为Kubernetes提供了一个基本的监控平台，它是集群级别的监控和事件数据集成器(Aggregator)。Heapster以Pod的方式运行在集群中，Heapster通过Kubelet发现所有运行在集群中的节点，并查看来自这些节点的资源使用情况。Kubelet通过cAdvisor获取其所在节点及容器的数据。Heapster通过带着关联标签的Pod分组这些信息，这些数据将被推到一个可配置的后端，用于存储和可视化展示。支持的后端包括InfluxDB(使用Grafana实现可视化)和Google Cloud Monitoring。  
cAdvisor是一个开源的分析容器资源使用率和性能特性的代理工具，已集成到Kubernetes代码中。cAdvisor自动查找所有在其所在节点上的容器，自动采集CPU、内存、文件系统和网络使用的统计信息。cAdvisor通过它所在节点机的Root容器，采集并分析该节点机的全面使用情况。  
cAdvisor通过其所在节点机的4194端口暴露一个简单的UI。    