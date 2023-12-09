# Serverless

Serverless, or serverless architecture, frees everyone from servers, allowing attention to focus solely on business logic itself. As users, you only need to care about data and business functions without the maintenance of servers or concerns about system capacity and scaling. Serverless is essentially a more user-friendly PaaS containing two main ideas:

1. Applications or services relying solely on cloud services for managing business logic and state, generally referred to as BaaS (Backend as a Service).
2. Event-driven and ephemeral applications or services, where main logic is completed by developers but managed by a third party (like AWS Lambda), typically called FaaS (Function as a Service). The currently trending Serverless usually refers to FaaS.

Adopting serverless architecture can bring clear benefits to application developers:

* No need to configure and manage servers
* Services aren't required to be based on specific frameworks or software libraries
* Simple deployment: just upload the code to the serverless platform
* Completely automated horizontal scaling
* Event-triggered, such as by an HTTP request, file update, time, or message.
* Cost-efficient, such as AWS Lambda charging based on execution time and the number of triggers – no fees when code isn't running.

However, serverless isn't a cure-all and has its own limitations:

* Stateless: Any in-process or host state is not retained for later calls; external databases or network storage are needed to manage state.
* Limited function execution duration, such as AWS Lambda restricting each function to a maximum runtime of 5 minutes.
* Start-up latency, especially noticeable for inactive applications or in the event of unexpected traffic spikes.
* Platform dependency for services like service discovery, monitoring, debugging, API Gateway are reliant on the functionalities provided by the serverless platform.

## Open Source Frameworks

* OpenFaas: [https://github.com/openfaas/faas](https://github.com/openfaas/faas)
* Fission: [https://github.com/fission/fission](https://github.com/fission/fission)
* Kubeless: [https://github.com/kubeless/kubeless](https://github.com/kubeless/kubeless)
* OpenWhisk: [https://github.com/apache/incubator-openwhisk](https://github.com/apache/incubator-openwhisk)
* Fn: [https://fnproject.io/](https://fnproject.io/)

## Commercial Products

* AWS Lambda: [http://docs.aws.amazon.com/lambda/latest/dg/welcome.html](http://docs.aws.amazon.com/lambda/latest/dg/welcome.html)
* AWS Fargate: [https://aws.amazon.com/cn/fargate/](https://aws.amazon.com/cn/fargate/)
* Azure Container Instance (ACI): [https://azure.microsoft.com/zh-cn/services/container-instances/](https://azure.microsoft.com/zh-cn/services/container-instances/)
* Azure Functions: [https://azure.microsoft.com/zh-cn/services/functions/](https://azure.microsoft.com/zh-cn/services/functions/)
* Google Cloud Functions: [https://cloud.google.com/functions/](https://cloud.google.com/functions/)
* Huawei CCI: [https://www.huaweicloud.com/product/cci.html](https://www.huaweicloud.com/product/cci.html)
* Aliyun Serverless Kubernetes: [https://help.aliyun.com/document_detail/71480.html](https://help.aliyun.com/document_detail/71480.html)

Many commercial products can also be integrated seamlessly with Kubernetes, using [Virtual Kubelet](https://github.com/virtual-kubelet/virtual-kubelet) to treat commercial Serverless products (such as ACI and Fargate) as an infinite Node in a Kubernetes cluster, removing concerns about the number of Nodes.

![](../.gitbook/assets/virtual-kubelet%20%282%29.png)

## Reference Documentation

* [Awesome Serverless](https://github.com/anaibol/awesome-serverless)
* [AWS Lambda](http://docs.aws.amazon.com/lambda/latest/dg/welcome.html)
* [Serverless Architectures](https://martinfowler.com/articles/serverless.html)
* [TNS Guide to Serverless Technologies](http://thenewstack.io/tns-guide-serverless-technologies-best-frameworks-platforms-tools/)
* [Serverless blogs and posts](https://github.com/JustServerless/awesome-serverless)

---

**Transformed for a Popular Science Magazine:**

# Serverless: The Future of Cloud Magic

Imagine crafting digital wonders without ever worrying about the messy complexities of managing servers. That's the marvel of Serverless architecture—a cloud-based sorcery that lets developers brew their applications with a singular focus on concocting the magic potion of business logic.

At its core, Serverless is a spellbinding twist on Platform as a Service (PaaS), offering two enchanted pathways:

1. **Backend as a Service (BaaS)**: Charmed apps that summon cloud services to handle all the background mumbo-jumbo and data juggling.
2. **Function as a Service (FaaS)**: These incantations are short-lived, event-driven spells where wizards (aka developers) craft the main enchantments, and cloud custodians (like AWS Lambda) keep the arcane machinery humming smoothly. When the tech world whispers about the hot new Serverless trend, FaaS is the spell they're casting.

### The Perks of Going Serverless:

- **No more server gremlins**: Forget about taming servers. Be free and let the cloud spirits do the heavy lifting.
- **Freedom of the framework**: No allegiance to any particular coding grimoire or arcane library is required.
- **Simplicity of deployment**: Teleport your magical script (your code) directly to the serverless realm.
- **Enchantments that scale**: Watch your spells grow in power automatically to match the demand, no incantations needed.
- **Triggered by events**: Various omens like web requests, time signals, or message scrolls can set your spell in motion.
- **Cost-effective conjuring**: Pay are only required for the time your spells are active, letting your coin purse stay plump.

### But Beware... Serverless isn't All-Powerful:

- **Amnesic spells**: Spells forget their past use, meaning you'll need a magical ledger (like a database) to keep track of things.
- **A limit on the magic show**: Don't plan on long enchantments; for instance, AWS Lambda won't let a single spell run past five minutes.
- **The initial sluggishness**: When your magical act is rarely performed or is suddenly in high demand, be prepared for a momentary delay.
- **Reliance on the cloud realm**: Your magic is only as good as the Serverless realm's services for things like spell monitoring and weaving APIs.

### Drawing from the Open Source Spell Book:

Seek out these repositories of knowledge where open-source conjurers share their secrets:
- [OpenFaas](https://github.com/openfaas/faas)
- [Fission](https://github.com/fission/fission)
- [Kubeless](https://github.com/kubeless/kubeless)
- [OpenWhisk](https://github.com/apache/incubator-openwhisk)
- [Fn](https://fnproject.io/)

### Enchanted Commercial Cauldrons:

Here lie the powerful Serverless domains where your spells can be channeled:
- [AWS Lambda](http://docs.aws.amazon.com/lambda/latest/dg/welcome.html)
- and more...

Some mighty cloud domains allow for merging with the grand Kubernetes cabal, where the mythical [Virtual Kubelet](https://github.com/virtual-kubelet/virtual-kubelet) can make an infinite Node of Serverless nodes, lifting the burden of counting from your shoulders.

*To embark on your Serverless quest, study these ancient scrolls and expand your arcanum:*
- [Awesome Serverless](https://github.com/anaibol/awesome-serverless) 
- and others...

Step into the future with Serverless, where your wizardly ambitions are bounded only by imagination, not servers! 🧙‍♂️✨