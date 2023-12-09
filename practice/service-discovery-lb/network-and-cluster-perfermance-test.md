# Testing Kubernetes Network and Cluster Performance

## Preparation

**Test Environment**

Tests were conducted under the following conditions:

- Accessing via Cluster IP on the Kubernetes cluster node
- Internal access through service in the Kubernetes cluster
- External access through address exposed by the traefik ingress of the Kubernetes cluster

**Test Addresses**

Cluster IP: 10.254.149.31

Service Port: 8000

Ingress Host: traefik.sample-webapp.io

**Testing Tools**

- [Locust](http://locust.io): A simple and easy-to-use load testing tool for assessing how many concurrent users a web system or other types of systems can handle.
- curl
- [kubemark](https://github.com/kubernetes/kubernetes/tree/master/test/e2e)
- Test program: sample-webapp, source code available on Github [Distributed load testing on kubernetes](https://github.com/feiskyer/kubernetes-handbook/blob/master/practice/service-discovery-lb/distributed-load-test.md)

**Testing Explanation**

Response times were obtained by sending curl requests to `sample-webapp`, with the direct result of the curl being:

```Bash
$ curl "http://10.254.149.31:8000/"
Welcome to the "Distributed Load Testing Using Kubernetes" sample web app
```

## Network Latency Testing

### Scenario One: Via Cluster IP on the Kubernetes Cluster Node

**Test Command**

```shell
curl -o /dev/null -s -w '%{time_connect} %{time_starttransfer} %{time_total}' "http://10.254.149.31:8000/"
```

**10 Sets of Test Results**

| No   | time_connect | time_starttransfer | time_total |
| ---- | ------------ | ------------------ | ---------- |
| ...  | ...          | ...                | ...        |

**Average Response Time**: 2ms

**Timing Metrics Explanation**

Unit: seconds

time_connect: Time taken to establish a TCP connection to the server

time_starttransfer: Time taken to receive the first byte of data from the web server after issuing the request

time_total: Total time taken to complete the request

### Scenario Two: Accessing Internally Through Service in the Kubernetes Cluster

...

### Scenario Three: External Access Through the Address Exposed by Traefik Ingress

...

### Test Results

The response time test results for these three scenarios are as follows:

- Via Cluster IP on the Kubernetes cluster node: 2ms
- Internally through service in the Kubernetes cluster: 6ms
- External access through the address exposed by traefik ingress: 110ms

*Note: The distance between the testing node/Pod and the service's pod, such as whether they are on the same host, may have an impact on the first two scenarios.*

## Network Performance Testing

The network was using the VXLAN mode of flannel.

Testing was done with iperf.

Server command:

...

Client command:

...

### Scenario One: Between Hosts

...

### Scenario Two: Between Pods on Different Hosts (Using Flannel's VXLAN Mode)

...

### Scenario Three: Between a Node and a Pod on a Different Host (Using Flannel's VXLAN Mode)

...

### Scenario Four: Between Pods on Different Hosts (Using Flannel's Host-Gw Mode)

...

### Scenario Five: Between a Node and a Pod on a Different Host (Using Flannel's Host-Gw Mode)

...

### Network Performance Comparison Summary

When using Flannel's **VXLAN** mode, the network performance drops by 30%~40% compared to direct host-to-host connections. This is consistent with online test results. However, Flannel's host-gw mode reduces network performance by only about 10% compared to host connections. The VXLAN mode involves a process of packet encapsulation and decapsulation, which causes more significant network performance overhead, while the host-gw mode operates directly on routing information, incurring less network overhead. For more information on the host-gw architecture, visit [Flannel host-gw architecture](https://docs.openshift.com/container-platform/3.4/architecture/additional_concepts/flannel.html).

## Kubernetes Performance Testing

Following the steps in [Testing Kubernetes Cluster Performance](https://supereagle.github.io/2017/03/09/kubemark/), Kubernetes performance was tested.

...

**Test Results**

...

*The logs show that creating 90 pods took less than 40 seconds, with an average creation time of 0.44 seconds per pod.*

### API Request Timing Distributions for Different Resource Types

...

More detailed request metrics can be seen in the `log.txt` log.

...

## Locust Testing

Request statistics

...

Response time distribution

...

The above tables represent instantaneous values. The request failure rate is around 2%.

48 pods were started for the Sample-webapp.

Locust simulated 100,000 users, increasing by 100 users per second.

...

## References

[List of various references]

----

**Rephrased Translation for Popular Science Style Article:**

# Pushing the Limits: How Kubernetes Handles the Digital Deluge

## Gear Up for the Experiment

Let's dive into an intriguing digital experiment! We set out to evaluate Kubernetes, an orchestral maestro for our digital resources, within varied scenarios, accessing:

- Internally, cozy on the cluster node using Cluster IP.
- Through the cluster's internal network, like whispers inside a secret club.
- Across the great divide of internet space via a nifty gateway: the Traefik Ingress.

Armed with the likes of [Locust](http://locust.io), the stress-test swarm, and kubemark, the Kubernetes hallmark tool, we're ready to spin the wheel of tests! For a touch of authenticity, we've got `sample-webapp`, the star of our Github stage on [Distributed load testing on kubernetes](https://github.com/feiskyer/kubernetes-handbook/blob/master/practice/service-discovery-lb/distributed-load-test.md).

Does our web app greet us back in a timely fashion? Here's a sneak-peek:

```Bash
$ curl "http://10.254.149.31:8000/"
Welcome to the "Distributed Load Testing Using Kubernetes" sample web app
```

There we go - polite and prompt!

## Clocking the Network

First, we wanted to check the pulse of our system. Like taking a digital 'blood pressure,' we measured how fast data travels under various conditions:

- **Scenario One**: It's a breeze on the cluster node itself, a swift average of 2ms.
- **Scenario Two**: Inside the cluster's own ecosystem, the response still zips back in an average of 6ms.
- **Scenario Three**: Reaching out from the outer web through the Traefik Ingress, it took an average of 110ms.

Not bad, for a stroll through the cyber park!

But how about a bit of heavyweight lifting? Enter Flannel's VXLAN mode on the internal network – a technological conundrum that quite predictably slows things down by about 30-40%.

## A Kubernetes Marathon

Now, how quickly does Kubernetes itself respond when poked and prodded? Ah, it’s almost Olympic in its performance! In a thunderous feat, it created 90 pods in less than a colossal clap of 40 seconds; that's just under half a second for each!

## The Locust Swarm Takes Flight

Finally, Locust – our swarm of virtual users. What does it do? It descends on our digital realm, simulating the hustle and bustle of 100,000 busy bees. They mimic real-world digital foot traffic, creating a cacophony of clicks and clatters as they go about testing the sample-webapp's welcome.

The result? Only about 2% missed the mark – a stellar show of resilience.

Ready to leap into the digital fray yourself, or simply marvel at the speed of cyber affairs? Kubernetes is here, handling the heat, one blink-and-you-miss-it moment at a time.

## Further Reading

[Here's an ensemble of scholarly sources, for those inclined to further their cyber symphonic knowledge.]