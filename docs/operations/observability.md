# Observability

## Stack

| Component | Role |
|-----------|------|
| Prometheus | Scrapes and stores time-series metrics |
| Grafana | Dashboards and visualization |
| Loki | Log aggregation and indexing |
| Promtail | Ships container logs to Loki |
| Alertmanager | Routes alerts to email |
| node-exporter | Host-level metrics (CPU, memory, disk, network) |
| kube-state-metrics | Kubernetes object state metrics (deployments, pods, PVCs) |

All components are installed via Helm using the `kube-prometheus-stack` and `loki` charts, deployed into a dedicated `monitoring` namespace, and managed by a second ArgoCD Application for ongoing configuration changes.

---

## Why Worker-Node-Only Scheduling

The control plane node should stay lean to protect etcd and the API server from resource contention. All monitoring workloads use a `nodeSelector` targeting `node-role.kubernetes.io/worker: "true"` — a label applied manually after `rke up` since RKE doesn't set this label by default.

```bash
kubectl label node <worker-node-name> node-role.kubernetes.io/worker=true
```

---

## Prometheus Configuration

- **Retention:** 15 days / 8GB max
- **Storage:** 10Gi PVC via `local-path-provisioner`
- **Resources:** 100m–500m CPU, 512Mi–1Gi memory
- **Security context:** runs as `root` (`runAsUser: 0`) — required because `local-path-provisioner` volumes don't support the non-root user Prometheus defaults to; without this the pod crash loops with a permission error on `/prometheus/queries.active`
- **Additional scrape target:** the Go backend at `commit-backend.commit.svc.cluster.local:8080`
- **RKE-specific rules disabled:** Default rules for `kubeControllerManager`, `kubeScheduler`, and `kubeProxy` are disabled in `defaultRules.rules` — RKE v1.28.x doesn't expose those metrics, so the rules would always fire as false positives

---

## Grafana Configuration

- **Exposed at:** `https://grafana.commit.rahulkoju.com.np`
- **TLS:** cert-manager + Let's Encrypt, same ClusterIssuer as the main app
- **Admin credentials:** stored in `grafana-admin-secret` (gitignored), never in the Helm values file
- **Persistence:** 2Gi PVC via `local-path-provisioner`
- **Pre-loaded dashboards** (via the chart's `dashboards` provider, pulled from grafana.com):

| Dashboard | Source ID | Purpose |
|-----------|-----------|---------|
| Kubernetes Cluster | 7249 | Cluster-wide resource overview |
| Node Exporter Full | 1860 | Per-node CPU, memory, disk, network |
| Kubernetes Pods | 6417 | Per-pod resource usage |

Plus the charts ship their own out-of-the-box dashboards for Alertmanager, CoreDNS, etcd, kubelet, API server, and networking — visible immediately under **Dashboards** with no manual setup.

- **Data sources:** Prometheus (default) and Loki, both wired automatically via `additionalDataSources` in the Helm values

---

## Loki Configuration

- **Mode:** Single binary (appropriate for a 2-node cluster — avoids the overhead of the full microservices deployment mode)
- **Retention:** 7 days (168h)
- **Storage:** 10Gi PVC via `local-path-provisioner`, filesystem backend
- **Cache components disabled:** `chunksCache` and `resultsCache` (memcached-based) were disabled — they require more memory than the cluster could spare and aren't necessary at this log volume
- **Resources:**
  - Requests: 150m CPU, 256Mi memory
  - Limits: 500m CPU, 768Mi memory
  - Limits were bumped from 200m CPU / 512Mi memory after Loki repeatedly OOMKilled during post-WAL-recovery flush bursts on startup (`KubePodCrashLooping` and `CPUThrottlingHigh` alerts)
- **Promtail:** runs as a DaemonSet, ships logs from every pod on every node to `http://loki.monitoring.svc.cluster.local:3100`

### Querying Logs

In Grafana, go to **Explore** → select **Loki** as the datasource:

```logql
{namespace="commit"}
```

Filter to a specific container:

```logql
{namespace="commit", container="backend"}
```

Search for errors (case-insensitive):

```logql
{namespace="commit"} |~ "(?i)error|panic|fatal"
```

---

## Alertmanager Configuration

- **Transport:** Gmail SMTP (`smtp.gmail.com:587`)
- **Sender / Recipient:** `rahulkoju69@gmail.com` (personal setup — same address sends and receives)
- **Authentication:** Gmail App Password (requires 2FA enabled on the account), stored in `alertmanager-secret` (gitignored)
- **Grouping:** alerts grouped by `alertname` and `namespace`, 30s initial wait, 5m group interval, 12h repeat interval
- **Inhibition rule:** a `critical` alert suppresses matching `warning` alerts for the same `alertname`/`namespace` to reduce noise
- **Secrets mount:** `alertmanagerSpec.secrets` mounts `alertmanager-secret` at runtime, making the SMTP password file available to the Alertmanager pod
- **Empty routes override:** An explicit `routes: []` is set in the Helm values to clear the chart's default `null` receiver — without this, ArgoCD's `selfHeal` would constantly fight the default route value injected by the chart, causing a perpetual OutOfSync

### Alert Rules

Defined in `additionalPrometheusRulesMap` within the Helm values:

| Alert | Expression (summary) | For | Severity |
|-------|----------------------|-----|----------|
| `PodCrashLooping` | restart rate > 1 per 5min in `commit` namespace | 5m | critical |
| `PodOOMKilled` | container's last termination reason is `OOMKilled` | instant | critical |
| `PostgresDown` | postgres StatefulSet has 0 ready replicas | 1m | critical |
| `DeploymentReplicasMismatch` | desired replicas ≠ available replicas | 5m | critical |
| `NodeMemoryHigh` | node memory usage > 85% | 5m | warning |
| `NodeCPUHigh` | node CPU usage > 85% | 5m | warning |
| `PVCUsageHigh` | PVC usage > 80% of capacity | 5m | warning |
| `HighErrorRate` | nginx ingress 5xx rate > 5% of total requests | 5m | warning |

> Default kube-prometheus-stack rules for `kubeControllerManager`, `kubeScheduler`, and `kubeProxy` are disabled — RKE doesn't expose those metrics (see Prometheus Configuration).

---

## Resource Tuning Note

Initial CPU **requests** (not actual usage) for the backend (`250m` × 2 pods) combined with monitoring stack requests over-committed the worker node's schedulable CPU on a `c7i-flex.large` (2 vCPU), even though actual measured usage (`kubectl top pods`) was under 15m per pod across the board. Requests were reduced for monitoring components; the backend request was kept at 250m after evaluation:

| Component | Original request | Current request |
|-----------|-------------------|-----------------|
| Backend | 250m CPU | 250m CPU (kept unchanged after evaluation) |
| Grafana | 100m CPU | 50m CPU |
| Prometheus | 200m CPU | 100m CPU |

This is a common Kubernetes pitfall — the scheduler reasons about requests, not live usage, so over-provisioned requests can block scheduling even on an idle node.

---

## Accessing the Stack

| What | How |
|------|-----|
| Grafana dashboards | `https://grafana.commit.rahulkoju.com.np` |
| Prometheus UI (debug) | `kubectl port-forward svc/kube-prometheus-stack-prometheus -n monitoring 9090:9090` |
| Alertmanager UI (debug) | `kubectl port-forward svc/kube-prometheus-stack-alertmanager -n monitoring 9093:9093` |
| Live resource usage | `kubectl top pods -n monitoring` / `kubectl top nodes` |
