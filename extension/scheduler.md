# Extending the Scheduler

If the default scheduler does not meet your requirements, you can deploy your own custom scheduler. Furthermore, you can run multiple scheduler instances throughout the cluster, selecting which scheduler to use for a particular pod by setting `pod.Spec.schedulerName` (with the default being the built-in scheduler).

## Developing a Custom Scheduler

The main function of a custom scheduler is to locate unscheduled Pods, choose a new Node based on a custom scheduling strategy, and update the Pod's Node Binding accordingly.

For example, a very simple scheduler might be written using shell script (assuming `kubectl proxy` is already running and listening on `localhost:8001`):

```bash
#!/bin/bash
SERVER='localhost:8001'
while true;
do
    for PODNAME in $(kubectl --server $SERVER get pods -o json | jq '.items[] | select(.spec.schedulerName =="my-scheduler") | select(.spec.nodeName == null) | .metadata.name' | tr -d '"')
;
    do
        NODES=($(kubectl --server $SERVER get nodes -o json | jq '.items[].metadata.name' | tr -d '"'))
        NUMNODES=${#NODES[@]}
        CHOSEN=${NODES[$[ $RANDOM % $NUMNODES]]}
        curl --header "Content-Type:application/json" --request POST --data '{"apiVersion":"v1","kind":"Binding","metadata": {"name":"'$PODNAME'"},"target": {"apiVersion":"v1","kind"
: "Node", "name": "'$CHOSEN'"}}' http://$SERVER/api/v1/namespaces/default/pods/$PODNAME/binding/
        echo "Assigned $PODNAME to $CHOSEN"
    done
    sleep 1
done
```

## Using the Custom Scheduler

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
  labels:
    app: nginx
spec:
  # Choose to use the custom scheduler my-scheduler
  schedulerName: my-scheduler
  containers:
  - name: nginx
    image: nginx:1.10
```

---

Taking the direct translation provided, let's rephrase it into a more magazine-style presentation:

---

# Powering Up Kubernetes: The Art of Custom Schedulers

Dissatisfied with the out-of-the-box options? No problem! With Kubernetes, you have the power to deploy tailor-made schedulers to better suit your unique infrastructure needs. Even cooler? You can have multiple schedulers operating side-by-side in your cluster, seamlessly. To set your preferred scheduling maestro in motion, simply twiddle with the `pod.Spec.schedulerName` (the default baton is waved by the built-in scheduler, but there's room for your code to conduct).

## Crafting Your Very Own Scheduler Wizardry

Roll up your sleeves—it's time to craft a scheduler that seeks out those pods still waiting in the wings, twirls them into a custom scheduled dance, and updates their Node Binding with a flourish.

Consider this: a scheduler that's as easy to script as a bash loop (with the `kubectl proxy` serenading in the background at `localhost:8001`):

```bash
#!/bin/bash
SERVER='localhost:8001'
while true;
do
    for PODNAME in $(kubectl --server $SERVER get pods -o json | jq '.items[] | select(.spec.schedulerName =="my-scheduler") | select(.spec.nodeName == null) | .metadata.name' | tr -d '"')
;
    do
        NODES=($(kubectl --server $SERVER get nodes -o json | jq '.items[].metadata.name' | tr -d '"'))
        NUMNODES=${#NODES[@]}
        CHOSEN=${NODES[$[ $RANDOM % $NUMNODES]]}
        curl --header "Content-Type:application/json" --request POST --data '{"apiVersion":"v1","kind":"Binding","metadata": {"name":"'$PODNAME'"},"target": {"apiVersion":"v1","kind"
: "Node", "name": "'$CHOSEN'"}}' http://$SERVER/api/v1/namespaces/default/pods/$PODNAME/binding/
        echo "Assigned $PODNAME to $CHOSEN"
    done
    sleep 1
done
```

Cast your own scheduling spell with a touch of old-school shell charm and watch as pods are whimsically whisked away to their new abode!

## Summoning Your Scheduler into Action

Grab your YAML wand and with a flick, give life to a pod that chooses its fate via your crafted scheduler:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx
  labels:
    app: nginx
spec:
  # Opt for the magic of the custom scheduler my-scheduler
  schedulerName: my-scheduler
  containers:
  - name: nginx
    image: nginx:1.10
```

In this enchanting Kubernetes world, your desires command the digital orchestra, ensuring every pod hits the right note in your symphony of services. Happy orchestrating!