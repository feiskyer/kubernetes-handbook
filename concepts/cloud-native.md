# Cloud-Native Applications: A Nifty Leap in Software Development

## 101 of Cloud-Native Applications

Cloud-native applications are designed specifically for deployment in the cloud. To level with you, most traditional applications can run on cloud platforms without any modifications, provided the platform supports the computer architecture and operating system the app is designed to run on. The catch is, this is tantamount to using virtual machines as if they were physical machines, effectively missing out on truly harnessing the capabilities of the cloud.

The Cloud Native Computing Foundation (CNCF) defines [cloud-native](https://github.com/cncf/toc/blob/master/DEFINITION.md) technologies as: 

> ...those that empower organizations to create and run scalable applications in modern, dynamic environments such as public, private, and hybrid clouds. These techniques enable loosely coupled systems that are resilient, manageable, and observable. When combined with robust automation, they allow engineers to make high-impact changes frequently and predictably with minimal toil.

## Unraveling the Relationship: Cloud-Native Apps and Associated Tech Concepts

### The Bond Between Cloud-Native Apps and Cloud Platforms

Cloud platforms are devised to deploy, manage, and run SaaS cloud applications. SaaS is one of the three service models of cloud computing, directly catering to business-related applications. The fundamental premise of cloud computing is the on-demand allocation of resources and elastic computing capabilities, a philosophy that cloud-native applications embody to use compute resources as desired and to scale elastically, making them a perfect fit as SaaS applications. 

### Cloud-Native Apps and ‘The Twelve Principles’

The Twelve Principles are application design principles advocated by the Heroku team for the PaaS platform. They serve as guidelines for designing SaaS applications. You could say that twelve-principle apps are synonymous with cloud-native applications.

### The Intersection of Cloud-Native Apps, Stateless, and Share Nothing Architectures

To facilitate horizontal scaling, cloud-native applications need to leverage Stateless and Share Nothing architectures.

### Microservice Architecture's Role in Cloud-Native Applications

Microservice architecture is a design pattern that decomposes complex monolithic applications to independent components based on bounded business contexts. These independently deployed components are referred to as microservices. But when we talk about the relationship between cloud-native applications and microservice architecture, we are referring to two scenarios: 

One is when we consider the entire distributed system as an application or macro cloud-native application. In this context, the microservice architecture serves as a design pattern to implement the cloud-native application. The other scenario views each individual microservice as a micro cloud-native application. Then, as per the ethos of cloud-native applications, each microservice is designed to achieve the objective that the microservice architecture aspires to—providing distributed system resistance for on-demand use of compute resources and elastic scaling. 

### Pets vs. Cattle and Cloud-Native Applications

The design philosophy of cloud-native applications is more akin to rearing cattle rather than nurturing pets. Deploying a cluster of cloud-native applications is like maintaining a herd of dairy cows. The main aim is milk production. If a cow dies, simply replace it. There's no emotional attachment, much like dealing with machines. 

Traditional applications tend to heavily rely on the running environment, requiring meticulous care and maintenance. If there's a system crash, the norm is to fix the issue on the server and then restore operation. If recovery proves impossible, the entire application system collapses, eliciting the kind of distress you'd feel if you lost a beloved pet.

## The Building Blocks of Cloud Native Applications: The Twelve Principles

### One Codebase, Many Deploys

With this principle, it's imperative to clearly discern what constitutes an application and what signifies a deployment. One codebase corresponds to a single software product, while a deployment pertains to a running application. Hence, the relationship between the application and deployment is one-to-many, reflecting the reusability of a set of code deployable numerous times. The divergence between deployments boils down to configuration, while code remains shared.

### Declare Dependencies Explicitly

Regardless of the language used to develop the application, there is always a mechanism for managing libraries. This principle underscores the necessity of explicitly outlining all dependencies to ensure accurate deployment of necessary libraries on the cloud during runtime.

### Storing Configuration in Environment

As mentioned before, one application, but different deployments, share the same set of codes. Hence the configuration isn't stored in the codebase. Each instance of deployment enjoys its separate environment, where the corresponding configuration resides, meaning configuration is essentially environment variables.

### Treat Backend Services as Attached Resources

This principle emphasizes the approach to utilizing backend support services. Different services are distinguished only by their resource URLs, that is, by setting the associated environment variables differently. Regardless of the nature of the resource—be it local or remote—the application can function normally. The difference lies in the value of the environment variable, causing no alteration to the application itself. 

### Strictly Separate Build and Run Stages

This concept is similar to distinguishing between applications and deployments. At its core, it advocates for identifying non-runtime application behavior from its runtime counterparts. The 'build' is a non-runtime phase involving the compilation and packaging of application codes, ensuring application stability during runtime.

### Execute the App as One or More Stateless Processes

In alignment with this principle, every bit of user data has to be stored via backend services, making the application stateless. This quality equips the app with the capability of horizontal scaling, effectively leveraging the elasticity of the cloud platform.

### Export Services Via Port Binding

This principle emphasizes that the application environment should not make excessive demands for service publishing. Instead, it should be self-contained without dependencies on application running containers provided by the cloud platform. The app merely requires the cloud platform to allocate a port for service publishing.

### Scale Out Via the Process Model

Similar to UNIX processes, cloud-native applications run independently on the cloud platform, not disturbing each other while fully harnessing the combined computing power of the cloud platform.

### Maximize Robustness with Fast Startup and Graceful Shutdown

Fast startup ensures optimal use of the cloud platform's capability to dynamically allocate resources. This enables minimum lag time to expand computing power and provide services when needed. Graceful shutdown aids in reallocating unused resources back to the cloud platform while maintaining the integrity of the application's logic.

### Keep Development, Staging, and Production Environments as Similar as Possible

Maintaining a uniform environment amplifies the effectiveness of unit, feature, and integration tests in the development phase, mitigating instances of flawless performance in testing but failures in the production environment.

### Treat Logs as Event Streams

Given the complex distributed infrastructure upon which cloud-native applications run, managing logs through a simple, unified pattern becomes vital for system debugging or data mining. Storing logs in system files would increase storage pressure and operational complexity. Hence, redirecting logs to standard output with the cloud platform aggregating the data is the recommended approach.

### Run Admin/Management Tasks as One-off Processes

Running application management tasks in the same way as application business requests facilitates similar monitoring and scheduling, looking for similar log entries and fostering system stability and comprehensive performance analysis.

## Hurdles with Cloud-Native Applications

### Networking in Distributed Systems

Cloud-native applications demand design adjustments to account for the complexities in network communication pertaining to distributed systems. Often, developers, due to complex design demands and pressure to deliver functionalities, tend to sideline these complex issues, thus accruing 'technical debt'.

### Handling Consistency in Distributed Systems

The CAP theorem advocates that in a distributed environment, consistency, availability, and partition tolerance can't coexist. Owing to the inherent instability in network communication, partition tolerance is a given, leading to a trade-off between consistency and availability.

### Fostering 'Eventual Consistency'

Striving for availability over consistency, cloud-native applications often adopt 'eventual consistency' over the 'ACID consistency' as assured by traditional transaction management. A point of contention is the complexity of ensuring 'eventual consistency', which demands business relevancy for rationale validation.

### Service Discovery and Load Balancing

As the cloud-native instances can shut down and start up anytime, customers require a mechanism to identify the running instances and avoid accessing the non-operational ones - service discovery. Together with service discovery, the equally significant task is load balancing - choosing an instance among multiple operational instances to serve a particular customer.

### Task Division and Data Sharding

Task decomposition distributes large tasks into several smaller assignments that can be executed on respective running instances and thereafter, results aggregated. Here, data storage and processing are dispersed across various instances - data sharding.

### Master's Role Election

Regardless of which tasks are handed over to which applications and which data sharded to which instances, standardization in distribution mapping is pivotal. Amidst the fluid cloud-computing environment where no instance guarantees perennial operation, the master's role can't be permanent, necessitating an election mechanism for the appointment of a new master.

Just like design patterns help resolve complex issues in object-oriented designs, a set of typical design patterns are indispensable to reusable solutions for unique scenarios pertaining to cloud-native applications. We'll be getting more into this in the subsequent articles of this series.

## References

- http://www.infoq.com/cn/articles/kubernetes-and-cloud-native-applications-part02
- https://github.com/cncf/toc/blob/master/DEFINITION.md