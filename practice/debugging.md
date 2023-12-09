# Debugging

For typical server processes, we can conveniently use a variety of tools on the host machine to debug; however, containers often contain only the necessary application and usually do not include common debugging tools. So how do we debug processes inside a container online? The simplest method is to start a new container that includes debugging tools.

Let's take a look at how to debug a basic web container.

## webserver Container

Write a simple webserver in Go:

```go
// go-examples/basic/webserver
package main

import "net/http"
import "fmt"
import "log"

func index(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintln(w, "Hello World")
}

func main() {
    http.HandleFunc("/", index)
    err := http.ListenAndServe(":80", nil)
    if err != nil {

        log.Println(err)
    }
}
```

Compile it for the Linux platform:

```bash
GOOS=linux go build -o webserver
```

Then create a Docker image using the following build:

```text
FROM scratch

COPY ./webserver /
CMD ["/webserver"]
```

```bash
# docker build -t feisky/hello-world .
Sending build context to Docker daemon 5.655 MB
Step 1/3 : FROM scratch
 --->
Step 2/3 : COPY ./webserver /
 ---> 184eb7c074b5
Removing intermediate container abf107844295
Step 3/3 : CMD /webserver
 ---> Running in fe9fa4841e70
 ---> dca5ec00b3e7
Removing intermediate container fe9fa4841e70
Successfully built dca5ec00b3e7
```

Finally, launch the webserver container:

```bash
docker run -itd --name webserver -p 80:80 feisky/hello-world
```

Visit the mapped port 80; the webserver container correctly returns "Hello World":

```bash
# curl http://$(hostname):80
Hello World
```

## Create a New Container to Debug the webserver

Create a new container with an image that includes debugging tools or allows easy installation of debugging tools (such as alpine). To facilitate access to the status of the webserver process, the new container shares the pid namespace and net namespace of the webserver container, and adds necessary capabilities:

```bash
docker run -it --rm --pid=container:webserver --net=container:webserver --cap-add sys_admin --cap-add sys_ptrace alpine sh
/ # ps -ef
PID   USER     TIME   COMMAND
    1 root       0:00 /webserver
   13 root       0:00 sh
   18 root       0:00 ps -ef
```

This allows the new container to directly attach to the webserver process for online debugging, such as tracing the webserver process with `strace`:

```bash
# Continue in the shell of the newly created container
/ # apk update && apk add strace
fetch http://dl-cdn.alpinelinux.org/alpine/v3.5/main/x86_64/APKINDEX.tar.gz
fetch http://dl-cdn.alpinelinux.org/alpine/v3.5/community/x86_64/APKINDEX.tar.gz
v3.5.1-34-g1d3b13bd53 [http://dl-cdn.alpinelinux.org/alpine/v3.5/main]
v3.5.1-29-ga981b1f149 [http://dl-cdn.alpinelinux.org/alpine/v3.5/community]
OK: 7958 distinct packages available
(1/1) Installing strace (4.14-r0)
Executing busybox-1.25.1-r0.trigger
OK: 5 MiB in 12 packages
/ # strace -p 1
strace: Process 1 attached
epoll_wait(4,
^Cstrace: Process 1 detached
 <detached ...>
```

It is also possible to get the network status of the webserver container:

```bash
# Continue in the shell of the newly created container
/ # apk add lsof
(1/1) Installing lsof (4.89-r0)
Executing busybox-1.25.1-r0.trigger
OK: 5 MiB in 13 packages
/ # lsof -i TCP
COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME
webserver   1 root    3u  IPv6  14233      0t0  TCP *:http (LISTEN)
```

Of course, you can also access the filesystem of the webserver container:

```bash
/ # ls -l /proc/1/root/
total 5524
drwxr-xr-x    5 root     root           360 Feb 14 13:16 dev
drwxr-xr-x    2 root     root          4096 Feb 14 13:16 etc
dr-xr-xr-x  128 root     root             0 Feb 14 13:16 proc
dr-xr-xr-x   13 root     root             0 Feb 14 13:16 sys
-rwxr-xr-x    1 root     root       5651357 Feb 14 13:15 webserver
```

The Kubernetes community is also proposing adding a `kubectl debug` command to start a new container in a Pod in a similar way to debug running processes. More details can be found at [https://github.com/kubernetes/community/pull/649](https://github.com/kubernetes/community/pull/649).

---

After translation and rephrasing:

# A Guide to Container Troubleshooting

When dealing with typical server processes, swift and effective debugging is often facilitated by a slew of handy tools on our host machine. But imagine you're navigating the lean world of containers—stripped down to essential apps and often devoid of our go-to debugging utilities. The conundrum then becomes: how do you perform live debugging within this contained environment? The key lies in booting up a new container—one that's armed with all the debugging toolkit you'll need.

Let's dive into the nitty-gritty of troubleshooting a no-frills web container.

## The Barebones webserver Container

Forge a minimalist Go-based webserver like so:

```go
// go-examples/basic/webserver
package main

import "net/http"
import "fmt"
import "log"

func index(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintln(w, "Hello World")
}

func main() {
    http.HandleFunc("/", index)
    err := http.ListenAndServe(":80", nil)
    if err != nil {

        log.Println(err)
    }
}
```

For the adaptation to the Linux scene, you'd compile:

```bash
GOOS=linux go build -o webserver
```

Next up, whip up a Docker image, lining up the following build commands:

```text
FROM scratch

COPY ./webserver /
CMD ["/webserver"]
```

Running the build might look like this:

```bash
# docker build -t feisky/hello-world .
Merely sending the context to the Docker daemon sparks the creation sequence.
---> The foundation is laid down with Step 1/3: FROM scratch.
Then, we move to securely placing the webserver in this digital vessel.
---> The command sequence culminates in Step 3/3: CMD /webserver.
Your new webserver container is primed and ready after a successful build.
```

This cued the stage for the webserver container to be unleashed into action:

```bash
docker run -itd --name webserver -p 80:80 feisky/hello-world
```

Now, when you hit the newly mapped port 80, be greeted by the "Hello World" from your crisp webserver container:

```bash
# curl http://$(hostname):80
Hello World
```

## Spawning a New Container to Peer Inside the webserver

Craft a fresh container using an image rich with debugging tools, or one that welcomes tool installation with ease—alpine being a case in point. This new discovery box shares the webserver's PID and networking space for a deep insight into the webserver’s pulse, supplemented with enhanced capabilities:

```bash
docker run -it --rm --pid=container:webserver --net=container:webserver --cap-add sys_admin --cap-add sys_ptrace alpine sh
--> Whale of a time perusing the processes of your server-bound voyage.
```

Embark on a real-time debugging spree by hitching to the webserver's process—unraveling the mysteries with `strace`:

```bash
# In the freshly spawned container's shell:
--> First, we refresh the tool repertoire with apk update and welcome strace aboard.
Here's to a seamless attachment to process 1, embarking upon an epoll_wait...
--> Should you need to disengage, a quick Ctrl+C detaches from the chase.
```

Thrill in the ability to sleuth through the webserver's networking activities:

```bash
# Staying the course in our discovery shell:
--> We enlist lsof into our crew to oversee the TCP connections.
There lays the humble webserver, ears perked up and listening on http.
```

Venturing further, the filesystem within the webserver's container isn't out of reach:

```bash
Through the window of "/proc/1/root/", glimpse into the container's inner hold.
```

On a broader horizon, the Kubernetes community sails towards simplifying such troubleshooting with a proposed `kubectl debug` command. This would introduce new debugging containers into Pods with similar ease, illuminating the way through the often opaque waters of runtime processes. You can chart these developing waters at [https://github.com/kubernetes/community/pull/649](https://github.com/kubernetes/community/pull/649).