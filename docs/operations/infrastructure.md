# Architecture

## Overview

Commit runs as a three-tier application on a 2-node Kubernetes cluster provisioned on AWS EC2 in the Mumbai region (`ap-south-1`). The infrastructure is fully defined as code — Terraform provisions AWS resources, Ansible configures nodes, and RKE bootstraps Kubernetes. Application deployments are managed by ArgoCD using a GitOps model — any change merged to `main` is automatically reconciled to the cluster.

---

## High-Level Architecture

```mermaid
graph TB
    Dev[Developer] -->|git push| GH[GitHub]
    GH -->|triggers| GHA[GitHub Actions CI]
    GHA -->|build and push images| DH[Docker Hub]
    GHA -->|update image SHA in manifests| GH
    GH -->|watches repo| ACD[ArgoCD]
    ACD -->|syncs manifests| K8S[Kubernetes Cluster]
    DH -->|pulls images| K8S

    User[User] -->|HTTPS| CF[Cloudflare DNS]
    CF -->|A record| EIP[Elastic IP]
    EIP -->|port 80/443| NG[nginx Ingress]
    NG -->|routes| APP[App Pods]

    subgraph AWS ap-south-1
        EIP
        subgraph VPC 10.0.0.0/16
            subgraph SubnetA
                CP[Control Plane EC2]
            end
            subgraph SubnetB
                WK[Worker EC2]
            end
        end
    end
```

---

## AWS Infrastructure

```mermaid
graph TB
    subgraph VPC 10.0.0.0/16
        IGW[Internet Gateway]

        subgraph SubnetA ap-south-1a
            CP[EC2 t3.small Control Plane and etcd]
            EIP_CP[Elastic IP]
        end

        subgraph SubnetB ap-south-1b
            WK[EC2 c7i-flex.large Worker Node]
            EIP_WK[Elastic IP]
        end

        SG[Security Group commit-production-sg]
        RT[Route Table 0.0.0.0/0 to IGW]
        S3[S3 Bucket commit-tf-state Terraform remote state]
    end

    IGW --> RT
    RT --> CP
    RT --> WK
    EIP_CP --> CP
    EIP_WK --> WK
    SG --> CP
    SG --> WK
```

**Security Group Rules — Ingress:**

| Rule | Port | Source | Purpose |
|------|------|--------|---------|
| SSH | 22 | Your IP | Admin access |
| HTTP | 80 | 0.0.0.0/0 | Web traffic |
| HTTPS | 443 | 0.0.0.0/0 | Web traffic |
| K8s API | 6443 | Your IP | kubectl access |
| Internal | All | VPC CIDR | Node-to-node communication (etcd, kubelet, Canal VXLAN) |

**Security Group Rules — Egress:**

Egress is restricted to only what the cluster needs — DNS resolution, outbound HTTPS, and intra-cluster traffic. The previous wide-open `0.0.0.0/0` all-protocol rule was replaced with granular rules to reduce the blast radius of a compromised container.

| Rule | Protocol | Port | Destination | Purpose |
|------|----------|------|-------------|---------|
| internal | all (-1) | all | VPC CIDR | Intra-cluster communication (etcd, kubelet, pod-to-pod) |
| https | TCP | 443 | 0.0.0.0/0 | Container registry pulls, Let's Encrypt ACME, API calls |
| dns_tcp | TCP | 53 | 0.0.0.0/0 | DNS resolution |
| dns_udp | UDP | 53 | 0.0.0.0/0 | DNS resolution |

**EC2 Instance Metadata — IMDSv2:**

EC2 instances enforce IMDSv2 by requiring a session token for metadata access (`http_tokens = "required"`). This prevents SSRF-based credential theft from the instance metadata endpoint (the `169.254.169.254` attack vector).

---

## Kubernetes Cluster

```mermaid
graph TB
    subgraph ControlPlane 10.0.1.x
        API[kube-apiserver port 6443]
        ETCD[etcd ports 2379-2380]
        SCH[kube-scheduler]
        CM[controller-manager]
        KBL_CP[kubelet port 10250]
        KP_CP[kube-proxy]
        SNAP[etcd-rolling-snapshots every 12h retain 6]
        CANAL_CP[canal CNI]

        API --> ETCD
        API --> SCH
        API --> CM
    end

    subgraph WorkerNode 10.0.2.x
        KBL[kubelet port 10250]
        KP[kube-proxy]
        CANAL[canal CNI VXLAN UDP 8472]
        NG[nginx ingress ports 80/443]
        CM_W[cert-manager]

        subgraph CommitNamespace
            FW[frontend-web x2 pods]
            FA[frontend-app x2 pods]
            BE[backend x2 pods]
            PG[postgres StatefulSet]
            PVC[PVC 5Gi local-path]
            CFG[ConfigMap]
            SEC[Secret]
        end

        subgraph MonitoringNamespace
            PROM[Prometheus]
            GRAF[Grafana]
            ALERT[Alertmanager]
            LOKI[Loki]
            PROM_T[Promtail]
            NE[node-exporter]
            KSM[kube-state-metrics]
        end
    end

    CANAL_CP <-->|VXLAN tunnel| CANAL
    API -->|schedules pods| KBL
    NG --> FW
    NG --> FA
    NG --> BE
    BE --> PG
    PG --> PVC
    BE --> CFG
    BE --> SEC
```

### Container Security Context

All application containers are hardened to follow Kubernetes security best practices and CIS benchmark compliance:

| Property | Value | Purpose |
|----------|-------|---------|
| `runAsNonRoot` | `true` | Prevents containers from running as root |
| `runAsUser` / `runAsGroup` | `10001` (app/frontend), `70` (postgres) | Least-privilege UIDs |
| `readOnlyRootFilesystem` | `true` | Prevents runtime modification of the container image |
| `allowPrivilegeEscalation` | `false` | Blocks SUID/SGID bit escalation |
| `capabilities.drop` | `ALL` | Drops all Linux capabilities |
| `seccompProfile` | `RuntimeDefault` | Applies the container runtime's seccomp filter |

**Frontend containers (app + web):** Since nginx needs to bind port 80 as non-root, the `NET_BIND_SERVICE` capability is added. EmptyDir volumes are mounted at `/var/cache/nginx`, `/var/run`, and `/tmp` to allow nginx to write temp/cache files on a read-only rootfs.

**Backend container:** Full read-only rootfs, non-root, all capabilities dropped — no exceptions needed.

**Postgres StatefulSet:** Runs as UID 70 (the `postgres` user) with read-only rootfs and all capabilities dropped. An `initContainer` (`busybox:1.36`) runs as root to `chown -R 70:70` the data directory before postgres starts — this works around `hostPath`/`fsGroup` limitations where Kubernetes cannot recursively change ownership of an existing host directory. EmptyDir volumes are mounted for `/tmp` and `/var/run/postgresql`.

---

## Network and Traffic Flow

```mermaid
sequenceDiagram
    participant U as User Browser
    participant CF as Cloudflare DNS
    participant EIP as Elastic IP
    participant NG as nginx Ingress
    participant FE as Frontend Pod
    participant BE as Backend Pod
    participant PG as PostgreSQL

    U->>CF: DNS lookup commit.rahulkoju.com.np
    CF->>U: A record to worker Elastic IP
    U->>EIP: HTTPS request port 443
    EIP->>NG: forward to nginx ingress
    NG->>NG: TLS termination via Let's Encrypt cert
    NG->>FE: route / to commit-frontend-web:80
    FE->>U: serve React bundle

    U->>EIP: POST /api/v1/auth/login
    EIP->>NG: forward
    NG->>BE: route /api/ to commit-backend:8080
    BE->>PG: query users table
    PG->>BE: user record
    BE->>U: JWT and set cookie Domain=.rahulkoju.com.np
```

---

## GitOps and CI/CD Flow

```mermaid
flowchart LR
    DEV[Developer pushes code] --> GH[GitHub main branch]

    GH --> GHA{GitHub Actions CI Pipeline}

    GHA --> B1[Build commit-web with VITE args]
    GHA --> B2[Build commit-app with VITE args]
    GHA --> B3[Build commit-backend]

    B1 --> DH[Docker Hub rahulkoju/commit-web:sha]
    B2 --> DH
    B3 --> DH

    GHA --> UP[Update image SHA in k8s manifests]
    UP --> COMMIT[git commit ci: update image tags]
    COMMIT --> GH

    GH -->|manifest changed| ACD[ArgoCD watching main branch]
    ACD -->|kubectl apply| K8S[Kubernetes Rolling update]
    K8S -->|pull new image| DH
```

---

## Observability Stack

```mermaid
graph TB
    subgraph Collection
        NE[node-exporter node metrics]
        KSM[kube-state-metrics k8s object metrics]
        PT[Promtail log collection]
        KBL[kubelet container metrics]
        APP[Go backend /metrics endpoint]
    end

    subgraph Storage
        PROM[Prometheus 15d retention 10Gi]
        LOKI[Loki 7d retention 10Gi]
    end

    subgraph Visualization
        GRAF[Grafana grafana.commit.rahulkoju.com.np]
    end

    subgraph Alerting
        ALERT[Alertmanager]
        EMAIL[Gmail rahulkoju69@gmail.com]
    end

    NE --> PROM
    KSM --> PROM
    KBL --> PROM
    APP --> PROM
    PT --> LOKI
    PROM --> GRAF
    LOKI --> GRAF
    PROM --> ALERT
    ALERT --> EMAIL
```

**Alert Rules:**

| Alert | Condition | Severity |
|-------|-----------|----------|
| PodCrashLooping | restart rate > 1 per 5min for 5min | critical |
| PodOOMKilled | container terminated with OOMKilled | critical |
| PostgresDown | StatefulSet ready replicas < 1 for 1min | critical |
| DeploymentReplicasMismatch | desired != available for 5min | critical |
| NodeMemoryHigh | memory usage > 85% for 5min | warning |
| NodeCPUHigh | CPU usage > 85% for 5min | warning |
| PVCUsageHigh | PVC usage > 80% for 5min | warning |
| HighErrorRate | HTTP 5xx rate > 5% for 5min | warning |

---

## Cluster Schedule

The cluster automatically stops overnight and starts each morning to reduce EC2 running costs from 24/7 to ~16 hours/day.

```mermaid
sequenceDiagram
    participant ES as EventBridge Scheduler
    participant LA as Lambda ec2_scheduler
    participant CP as Control Plane t3.small
    participant WK as Worker c7i-flex.large

    Note over ES: 7:50am Asia/Kathmandu
    ES->>LA: invoke { action: "start" }
    LA->>CP: StartInstances
    LA->>LA: Wait instance_status_ok
    LA->>WK: StartInstances

    Note over ES: Midnight Asia/Kathmandu
    ES->>LA: invoke { action: "stop" }
    LA->>WK: StopInstances
    LA->>CP: StopInstances
```

- **Start:** `cron(50 7 * * ? *)` — control-plane first, then worker
- **Stop:** `cron(0 0 * * ? *)` — worker first, then control-plane
- **Timezone:** Asia/Kathmandu, evaluated natively by EventBridge
- **IAM:** Lambda role scoped to only the two managed instance ARNs
- **Manual override:** `workflow_dispatch` in `.github/workflows/cluster-schedule.yaml` (kept as fallback for demos outside the window)

The GHA scheduled cron triggers were removed and replaced by EventBridge because GitHub's shared runner queue had confirmed platform-level delays and dropped runs during high-load UTC windows, causing the morning start to silently not fire.

---

## Container Architecture

```mermaid
graph LR
    subgraph WebDockerfile
        W1[base node:26-alpine corepack pnpm] --> W2[pruner turbo prune web]
        W2 --> W3[installer pnpm install frozen]
        W3 --> W4[builder pnpm turbo build VITE args baked in]
        W4 --> W5[server nginx:alpine serve dist]
    end

    subgraph AppDockerfile
        A1[base] --> A2[pruner turbo prune app]
        A2 --> A3[installer] --> A4[builder] --> A5[server nginx:alpine]
    end

    subgraph BackendDockerfile
        G1[golang:1.26-alpine CGO_ENABLED=0 go build] --> G2[alpine:latest 14MB binary]
    end
```

Image sizes: commit-web ~29MB, commit-app ~27MB, commit-backend ~14MB

Both frontend Dockerfiles (web and app) apply `apk update && apk upgrade --no-cache` in the final nginx:alpine stage to pull in security patches for the base image at build time.

---

## Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| Terraform | Provision VPC, subnets, EC2, Elastic IPs, security groups, S3 state backend, EventBridge Scheduler + Lambda for cluster start/stop |
| Ansible | Install Docker 27.2.x, disable swap, load kernel modules, configure sysctl, disable UFW |
| RKE | Bootstrap Kubernetes v1.28.15, deploy Canal CNI, nginx ingress, CoreDNS, Metrics Server |
| cert-manager | Issue and renew Let's Encrypt TLS certificates automatically |
| local-path-provisioner | Provide PersistentVolumes backed by node local disk |
| ArgoCD | Watch git repo, reconcile cluster state to match manifests on every push |
| GitHub Actions | Build Docker images, tag with commit SHA, update manifests, push to Docker Hub |
| nginx ingress | Route external HTTPS traffic to correct backend services based on hostname and path |
| Canal CNI | Create VXLAN overlay network enabling pod-to-pod communication across nodes |
| Prometheus | Scrape and store metrics from all cluster components and application pods |
| Grafana | Visualize metrics and logs, pre-loaded with Kubernetes and custom app dashboards |
| Loki | Aggregate and index logs from all pods via Promtail |
| Promtail | Tail container logs from node filesystem and ship to Loki with Kubernetes metadata labels |
| Alertmanager | Route alerts from Prometheus rules to Gmail |
| EventBridge Scheduler | Trigger EC2 start at 7:50am and stop at midnight (Asia/Kathmandu) via Lambda |
| Lambda (`ec2_scheduler`) | Start control-plane first (wait for status-ok), then worker; stop worker first, then control-plane |
