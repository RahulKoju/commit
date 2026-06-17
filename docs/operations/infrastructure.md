# Architecture

## Overview

Commit runs as a three-tier application on a 2-node Kubernetes cluster provisioned on AWS EC2 in the Mumbai region (`ap-south-1`). The infrastructure is fully defined as code — Terraform provisions AWS resources, Ansible configures nodes, and RKE bootstraps Kubernetes. Application deployments are managed by ArgoCD using a GitOps model — any change merged to `main` is automatically reconciled to the cluster.

---

## High-Level Architecture

```mermaid
graph TB
    Dev[Developer] -->|git push| GH[GitHub]
    GH -->|triggers| GHA[GitHub Actions CI]
    GHA -->|build + push images| DH[Docker Hub]
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
            subgraph Subnet A — 10.0.1.0/24
                CP[Control Plane EC2]
            end
            subgraph Subnet B — 10.0.2.0/24
                WK[Worker EC2]
            end
        end
    end
```

---

## AWS Infrastructure

```mermaid
graph TB
    subgraph AWS VPC — 10.0.0.0/16
        IGW[Internet Gateway]

        subgraph Public Subnet A — ap-south-1a
            CP[EC2 c7i-flex.large\nControl Plane + etcd\n2 vCPU 4GB RAM]
            EIP_CP[Elastic IP]
        end

        subgraph Public Subnet B — ap-south-1b
            WK[EC2 c7i-flex.large\nWorker Node\n2 vCPU 4GB RAM]
            EIP_WK[Elastic IP]
        end

        SG[Security Group\ncommit-production-sg]
        RT[Route Table\n0.0.0.0/0 → IGW]
        S3[S3 Bucket\ncommit-tf-state\nTerraform remote state]
    end

    IGW --> RT
    RT --> CP
    RT --> WK
    EIP_CP --> CP
    EIP_WK --> WK
    SG --> CP
    SG --> WK
```

**Security Group Rules:**

| Rule | Port | Source | Purpose |
|------|------|--------|---------|
| SSH | 22 | Your IP | Admin access |
| HTTP | 80 | 0.0.0.0/0 | Web traffic |
| HTTPS | 443 | 0.0.0.0/0 | Web traffic |
| K8s API | 6443 | Your IP | kubectl access |
| Internal | All | VPC CIDR | Node-to-node communication (etcd, kubelet, Canal VXLAN) |

---

## Kubernetes Cluster

```mermaid
graph TB
    subgraph Control Plane Node — 10.0.1.x
        API[kube-apiserver\nport 6443]
        ETCD[etcd\nports 2379-2380]
        SCH[kube-scheduler]
        CM[controller-manager]
        KBL_CP[kubelet\nport 10250]
        KP_CP[kube-proxy]
        SNAP[etcd-rolling-snapshots\nevery 12h retain 6]
        CANAL_CP[canal CNI]

        API --> ETCD
        API --> SCH
        API --> CM
    end

    subgraph Worker Node — 10.0.2.x
        KBL[kubelet\nport 10250]
        KP[kube-proxy]
        CANAL[canal CNI\nVXLAN UDP 8472]
        NG[nginx ingress\nports 80/443]
        CM_W[cert-manager]

        subgraph commit namespace
            FW[frontend-web\nx2 pods]
            FA[frontend-app\nx2 pods]
            BE[backend\nx2 pods]
            PG[postgres\nStatefulSet x1]
            PVC[PVC 5Gi\nlocal-path]
            CFG[ConfigMap]
            SEC[Secret]
        end

        subgraph monitoring namespace
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

---

## Network & Traffic Flow

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
    CF->>U: A record → worker Elastic IP
    U->>EIP: HTTPS request (port 443)
    EIP->>NG: forward to nginx ingress
    NG->>NG: TLS termination (Let's Encrypt cert)
    NG->>FE: route / → commit-frontend-web:80
    FE->>U: serve React bundle

    U->>EIP: POST /api/v1/auth/login
    EIP->>NG: forward
    NG->>BE: route /api/ → commit-backend:8080
    BE->>PG: query users table
    PG->>BE: user record
    BE->>U: JWT + set cookie Domain=.rahulkoju.com.np
```

---

## GitOps & CI/CD Flow

```mermaid
flowchart LR
    DEV[Developer\npushes code] --> GH[GitHub\nmain branch]

    GH --> GHA{GitHub Actions\nCI Pipeline}

    GHA --> B1[Build commit-web\nwith VITE args]
    GHA --> B2[Build commit-app\nwith VITE args]
    GHA --> B3[Build commit-backend]

    B1 --> DH[Docker Hub\nrahulkoju/commit-web:sha]
    B2 --> DH[Docker Hub\nrahulkoju/commit-app:sha]
    B3 --> DH[Docker Hub\nrahulkoju/commit-backend:sha]

    GHA --> UP[Update image SHA\nin k8s manifests]
    UP --> COMMIT[git commit\nci: update image tags]
    COMMIT --> GH

    GH -->|manifest changed| ACD[ArgoCD\nwatching main branch]
    ACD -->|kubectl apply| K8S[Kubernetes\nRolling update]
    K8S -->|pull new image| DH
```

---

## Observability Stack

```mermaid
graph TB
    subgraph Data Collection
        NE[node-exporter\nnode metrics]
        KSM[kube-state-metrics\nk8s object metrics]
        PT[Promtail\nlog collection]
        KBL[kubelet\ncontainer metrics]
    end

    subgraph Storage
        PROM[Prometheus\n15d retention 10Gi]
        LOKI[Loki\n7d retention 10Gi]
    end

    subgraph Visualization
        GRAF[Grafana\ngrafana.commit.rahulkoju.com.np]
    end

    subgraph Alerting
        ALERT[Alertmanager]
        EMAIL[Gmail\nrahulkoju69@gmail.com]
    end

    NE --> PROM
    KSM --> PROM
    KBL --> PROM
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

## Container Architecture

```mermaid
graph TB
    subgraph frontend/Dockerfile.web — 5 stages
        B1[base\nnode:26-alpine\ncorepack + pnpm] --> B2[pruner\nturbo prune web]
        B2 --> B3[installer\npnpm install frozen]
        B3 --> B4[builder\npnpm turbo build\nVITE args baked in]
        B4 --> B5[server\nnginx:alpine\nserve dist/]
    end

    subgraph frontend/Dockerfile.app — 5 stages
        A1[base] --> A2[pruner\nturbo prune app]
        A2 --> A3[installer] --> A4[builder] --> A5[server\nnginx:alpine]
    end

    subgraph backend/Dockerfile — 2 stages
        G1[golang:1.26-alpine\nCGO_ENABLED=0\ngo build -o app] --> G2[alpine:latest\n13.6MB binary]
    end
```

**Image sizes:** commit-web ~29MB · commit-app ~27MB · commit-backend ~14MB

---

## Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| Terraform | Provision VPC, subnets, EC2, Elastic IPs, security groups, S3 state backend |
| Ansible | Install Docker 27.2.x, disable swap, load kernel modules, configure sysctl, disable UFW |
| RKE | Bootstrap Kubernetes v1.28.15, deploy Canal CNI, nginx ingress, CoreDNS, Metrics Server |
| cert-manager | Issue and renew Let's Encrypt TLS certificates automatically |
| local-path-provisioner | Provide PersistentVolumes backed by node local disk |
| ArgoCD | Watch git repo, reconcile cluster state to match manifests on every push |
| GitHub Actions | Build Docker images, tag with commit SHA, update manifests, push to Docker Hub |
| nginx ingress | Route external HTTPS traffic to correct backend services based on hostname and path |
| Canal CNI | Create VXLAN overlay network enabling pod-to-pod communication across nodes |
| Prometheus | Scrape and store metrics from all cluster components and application pods |
| Grafana | Visualize metrics and logs, pre-loaded with Kubernetes dashboards |
| Loki | Aggregate and index logs from all pods via Promtail |
| Alertmanager | Route alerts from Prometheus rules to Gmail |
