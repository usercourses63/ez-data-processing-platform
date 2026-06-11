# External Tools — Sibling Repos & Parallel Sessions

**Last updated:** 2026-05-27

This file tracks external/sibling repos that are operationally coupled to EZ Platform
but live in separate working trees with their own git history and their own Claude
Code sessions.

---

## file-simulator-suite

| Field | Value |
|-------|-------|
| **Local path** | `C:\Users\Brian\Desktop\ez-simulator` |
| **Upstream** | https://github.com/usercourses63/file-simulator-suite |
| **Current version** | v2.1 (Dashboard Enhancements, released 2026-02-12) |
| **Purpose** | Multi-protocol file-access simulator (FTP, SFTP, HTTP/WebDAV, S3/MinIO, SMB, NFS) for testing EZ Platform's data-source connectors against realistic file servers |
| **Owned by** | A parallel Claude Code terminal — NOT this session |
| **Deployment shape** | Independent Helm chart, deployed into shared minikube cluster |

### Operational coupling

- **Shared minikube cluster** — both EZ and the simulator run on the same local
  minikube. Different namespaces (EZ: `ez-platform`, simulator: TBD — check
  `helm-chart/values.yaml` in the simulator repo if needed).
- **Shared image registry** — minikube image store is global. Don't reuse
  ambiguous tags (`frontend:latest`) across the two projects.
- **Port-allocation watchpoint** — the simulator's dashboard binds NodePort
  `30080` and its Control API binds NodePort `30500`. EZ Platform's port-forward
  script (`scripts/start-port-forwards.ps1`) allocates 18 different ports
  (3001, 4317–4318, 5001–5009, 5672, 5701, 7000, 9090–9091, 9094, 9200, 16686,
  27017) — no current collision. **Phase 33 sanity tests were rerouted from
  `:30080` to port-forwards (5001/5002/5004) specifically because `:30080`
  is now occupied by the simulator dashboard.**

### Rules of engagement

- **This session DOES NOT modify the simulator repo.** Edits, builds, deploys,
  and upgrades of the simulator are owned by the parallel terminal.
- **The simulator session DOES NOT modify this (EZ) repo.** It can read EZ
  Helm values if it needs to coordinate (e.g., verify which Kafka topic EZ
  consumes from), but writes are out of scope.
- **Coordination protocol** — if either session needs to know the live state
  of the cluster (deployed releases, pod status, NodePort allocations),
  use `kubectl get` / `helm list -A`. Don't assume; query.

### When to revisit this file

- Simulator upgrades to a new version (update the version row).
- New NodePort, hostname, or namespace allocation in either project.
- Coordination protocol changes (e.g., dedicated namespace per project, or
  switch to separate clusters).
- Either side decides to absorb the other (submodule, subtree, or merge).

---
