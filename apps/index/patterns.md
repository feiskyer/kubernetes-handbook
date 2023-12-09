# General Guidelines

* Separate build and runtime environments
* Use tools like `dumb-int` to avoid zombie processes
* It's not recommended to use Pods directly, but rather use Deployment/DaemonSet etc.
* Avoid running background processes in containers, instead, run processes in the foreground and use probes to ensure the services are actually running
* It's recommended that applications log to stdout and stderr in containers, for easy log plugin processing
* As containers use COW (Copy-On-Write), frequent heavy data writing may lead to performance issues, it's recommended to write data into Volumes instead
* Avoid using the `latest` tag for production images, while for development environment, you should use it and set `imagePullPolicy` to `Always`
* Use a Readiness probe to check if the service has truly started
* Use `activeDeadlineSeconds` to prevent jobs that fail quickly from restarting indefinitely
* Deploy Sidecars for proxy handling, request rate limiting, and connection control tasks

## Separating Build and Runtime Environments

Always separate build and runtime environments. Images built directly through Dockerfile are not only large in size but also contain unnecessary packages for runtime and are prone to introduce security vulnerabilities, such as embedding source codes of applications.

Use [Docker multi-stage build](https://docs.docker.com/engine/userguide/eng-image/multistage-build/) to simplify this step.

```text
FROM golang:1.7.3 as builder
WORKDIR /go/src/github.com/alexellis/href-counter/
RUN go get -d -v golang.org/x/net/html
COPY app.go    .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o app .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /go/src/github.com/alexellis/href-counter/app .
CMD ["./app"]
```

## Zombie and Orphan Processes

* Orphan process: A parent process exits while one or more of its child processes are still running, those child processes will become orphan processes. These orphans will be adopted by the init process (pid1), and the init process will complete their status collection.
* Zombie process: A process creates a child process using fork, if the child process exits, and the parent process didn't call wait or waitpid to get the status information of the child process, the process descriptor of the child process is still saved in the system.

A common pitfall in containers is that the init process doesn't correctly handle SIGTERM and similar exit signals. Here's an example to demonstrate it,

```bash
# First, run a container
$ docker run busybox sleep 10000

# Open another terminal
$ ps uax | grep sleep
sasha    14171  0.0  0.0 139736 17744 pts/18   Sl+  13:25   0:00 docker run busybox sleep 10000
root     14221  0.1  0.0   1188     4 ?        Ss   13:25   0:00 sleep 10000

# Then, kill the first process
$ kill 14171
# Now, you would find out that the sleep process didn't exit
$ ps uax | grep sleep
root     14221  0.0  0.0   1188     4 ?        Ss   13:25   0:00 sleep 10000
```

The solution is to ensure the init process in the container can correctly handle SIGTERM and other exit signals, such as by using dumb-init

```bash
$ docker run quay.io/gravitational/debian-tall /usr/bin/dumb-init /bin/sh -c "sleep 10000"
```

## Reference

* [Kubernetes Production Patterns](https://github.com/gravitational/workshop/blob/master/k8sprod.md)