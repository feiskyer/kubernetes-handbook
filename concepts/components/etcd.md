# etcd: The Backbone of Distributed Systems

Developed by CoreOS, etcd is an open-source distributed key-value store that serves as a backbone of distributed systems. It is based on the Raft consensus algorithm and shines in areas such as service discovery, sharing configuration information, and ensuring consistency (such as database master selection, distributed locks, etc.).

## What makes etcd so special?

- Basic key-value storage
- Listening mechanism
- Expiry and renewal mechanisms for keys, used for monitoring and service discovery
- Atomic Compare-and-Swap and Compare-and-Delete operations, used for distributed locks and leader elections

## How does etcd achieve consistency?

Etcd achieves consistency in its operations, thanks to the RAFT protocol.

The election process is as follows:

1. Initially, all nodes are in a 'follower' state and are assigned an election timeout. If they don't receive a heartbeat from the leader within this timeout, they switch to a 'candidate' state, ask other nodes in the cluster to vote for them, and initiate an election.
2. When a candidate receives votes from over half of the nodes in the cluster, it becomes the leader, starts receiving and saving client data, and syncs its logs with other follower nodes. If consensus isn't reached, candidates wait for a random period (between 150ms - 300ms), before initiating another vote.
3. A leader node maintains its position by sending heartbeats to follower nodes at regular intervals.
4. If, at any point, a follower node does not receive a heartbeat from the leader within the election timeout, it will switch to a 'candidate' state and initiate a new election. Each time this happens, the term of the newly elected leader is incremented by 1.

Replication of logs occurs in the following manner:

When the leader node receives a log (transaction request) from a client, it first appends this log to its own Log, then syncs this entry with other followers via a heartbeat. Followers, on receiving the log, record it and send an acknowledgment (ACK) back to the leader. Once the leader receives ACKs from the majority (n/2+1) of followers, it sets the log as committed, appends it to the local disk, notifies the client, and in the next heartbeat, instructs all followers to store the log in their local storage.

Etcd also has safety measures that make sure every node executes the same sequence of instructions. For example, if a follower becomes unavailable when the current leader commits a Log, that follower might later be elected as the Leader and may overwrite the already committed Log with a new one. This could lead to nodes executing different sequences, which is where Safety steps in. Safety ensures that any elected Leader must contain the previously committed Log. Some key safety measures include:

1. Election Safety: Only one Leader can be elected in a term.
2. Leader Completeness: The Leader's log must be complete. If a Log is committed in term1, then the Leaders in any future terms (term2, term3...) must contain that Log. This is verified by the Term during the election phase.

Etcd also has protocols for handling faults:

1. When a Leader fails: Other nodes, which have not received a heartbeat, initiate a new election. When the original Leader recovers, due to lower stepping numbers, it automatically becomes a follower, and its logs are overwritten by the new Leader's logs.
2. When a follower node becomes unavailable: This is relatively easy to handle. The cluster's log content is always synced from the Leader. As soon as the unavailable node re-joins the cluster, it replicates the log from the Leader.
3. When multiple candidates exist: In the event of a conflict, each candidate randomly selects a wait interval (between 150ms - 300ms) before initiating a new vote. The candidate that receives the majority (over half) of the votes in the cluster will become the Leader.

### etcd’s wal logs

While implementing Raft, etcd makes full use of the Concurrent Sequential Processes (CSP) concurrency model and channel magic in Go language. They have a wal log for finer details, which you can explore in the source code.

The wal logs are binary. When parsed, the resultant data structure is LogEntry. It consists of four main fields: The first one is type, which can either be 0 for Normal or 1 for ConfChange (which represents configuration alterations within etcd itself, like the addition of new nodes). The second one term represents the tenure of the leader, which changes every time there's a change in leadership. The third field, index, is a sequentially growing number denoting the change order. The last field, data, is a binary representation of the Raft request objects' Protocol Buffers (pb) structure, which is wholly saved. etcd has a tool called etcd-dump-logs which can transform wal logs into text for viewing, aiding in the analysis of the Raft protocol.

Though the Raft protocol does not concern itself with application data (the data part of it), it ensures consistency through syncing the wal logs, with each node applying the data received from the leader to its local storage. Raft is only concerned with the log's syncing status. If there's a bug in the local storage, such as one that fails to apply the data to the local, it could potentially cause a data discrepancy.

## What's the difference between etcd v2 and v3?

In essence, etcd v2 and v3 are two separate applications sharing the same Raft protocol code. Their APIs are not alike, their storage methods differ, and their data is mutually exclusive. Which is to say, if you upgraded from etcd v2 to etcd v3, you can only access v2 data via v2 interface, and data created using the v3 interface can only be accessed using the v3 interface.

When using etcd in Kubernetes clusters, etcd v3 is recommended as the v2 version has been deprecated as of Kubernetes v1.11.

## How does etcd v2 handle storage, watch operations, and expiration?

Etcd v2 is primarily an in-memory implementation. It does not write data to disk in real-time; instead, it serializes the entire store into a JSON format and writes it to a file. The data in memory is organised in a simple tree structure. For example, the following data is stored in etcd as shown in the figure.

```text
/nodes/1/name  node1
/nodes/1/ip    192.168.1.1
```

The store has a global currentIndex which increments by 1 with every change; each event is then linked to this currentIndex.

When a client invokes the watch interface (and includes the 'wait' parameter), if the request parameters contain a waitIndex that is lower than the currentIndex, it fetches those events from the EventHistory table which have an index greater than or equal to the waitIndex and are associated with the watch key. If there is data, it is returned immediately. If the history table does not contain any data, or if the request does not contain a waitIndex, then the request is placed into the WatchHub. Each key has an associated list of watchers. Any changes generate an event that is placed in the EventHistory table and notifies the relevant watcher associated with the key.

Similarly, the etcd v2 expiration mechanism sets the expiration time only on individual keys, making it difficult to ensure consistent lifecycles for multiple keys. Watchers can only watch a specific key and its sub-nodes (through the recursive parameter) and cannot conduct multiple watches. It is also challenging to implement complete data synchronization through the watch mechanism due to the risk of missing changes. Therefore, most current uses involve watching for changes, then retrieving data through a get request, rather than relying on the change events from the watch operation.

## How does etcd v3 handle storage, watch operations, and expiration?

Etcd v3 separates the watch and store operations and improves on the expiration mechanisms. You can set the lease on expiration time, and then link the key with the lease. This lets you link multiple keys to the same lease ID, making it easier to set a unified expiration time and implement batch renewal. This feature means that, compared to etcd v2, it is easier to use, more capable and provides a more efficient and reliable watch mechanism. With etcd v3, you can pretty much implement total data synchronization through the watch mechanism.

You can also set up an etcd cluster to automatically compact data when starting up or do it manually using a command. If the change frequency is high, this is recommended, or else it could result in excessive resource usage and even errors. In etcd v3, the default backend quota is 2GB, and if you do not compact your data and the boltdb file size exceeds this limit, you will see an 'Error: etcd