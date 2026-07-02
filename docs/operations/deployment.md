# Deployment Guide

Step-by-step instructions to provision infrastructure and deploy the Commit app from scratch.

> See [Infrastructure](infrastructure.md) for system design and architecture diagrams.

## Prerequisites

- AWS account with credentials configured (`aws configure`)
- Terraform installed
- Ansible installed
- `rke` CLI installed (v1.6.4)
- `kubectl` installed
- `helm` installed (v4+)
- SSH key pair created in AWS (`commit-key`)
- Domain managed in Cloudflare (`rahulkoju.com.np`)

---

## 1. Infrastructure

Provisions the VPC, EC2 instances, configures the nodes, and bootstraps Kubernetes.

```bash
cd infra/terraform && terraform apply -auto-approve
cd infra/ansible && ansible-playbook playbooks/setup-nodes.yml
cd infra/rke && rm -f cluster.rkestate kube_config_cluster.yml && rke up
export KUBECONFIG=/path/to/infra/rke/kube_config_cluster.yml
```

### Step Details

**Terraform** — creates a VPC with 2 public subnets across 2 AZs, 2 EC2 instances (control-plane: `t3.small`, worker: `c7i-flex.large`), Elastic IPs, a security group with SSH (22), HTTP (80), HTTPS (443), K8s API (6443), and full internal VPC traffic. Also provisions an EventBridge Scheduler + Lambda function to automatically stop the cluster at midnight and start it at 7:50am (Asia/Kathmandu).

Note the `control_plane_ip`, `worker_ip`, `control_plane_private_ip`, and `worker_private_ip` outputs from Terraform.

**Ansible** — installs Docker 27.2.x, disables swap, loads kernel modules (`overlay`, `br_netfilter`), tunes sysctl for Kubernetes networking, and disables UFW.

Update `infra/ansible/inventory/hosts.ini` with the new public IPs before running.

**RKE** — bootstraps Kubernetes v1.28.x. The `rm -f` ensures no stale state from a previous cluster interferes.

### Expected Output

```bash
kubectl get nodes
# Both nodes show Ready
```

---

## 2. Label the Worker Node

Monitoring workloads are scheduled only on the worker node to keep the control plane lean.

```bash
kubectl get nodes
kubectl label node <worker-node-name> node-role.kubernetes.io/worker=true
```

---

## 3. One-Time Cluster Setup

Installs foundational cluster components: namespaces, storage provisioner, and TLS certificate manager.

```bash
kubectl apply -f infra/k8s/namespaces/
kubectl apply -f infra/k8s/storage/
kubectl apply -f infra/k8s/cert-manager/cert-manager.yaml
# wait ~30s for cert-manager pods to be ready
kubectl apply -f infra/k8s/cert-manager/clusterissuer.yaml
kubectl apply -f infra/k8s/config/secret.yaml
```

The `storage/` manifests deploy `local-path-provisioner` — the default `StorageClass` for PVCs. cert-manager issues Let's Encrypt TLS certificates automatically.

`secret.yaml` is never committed to git. It contains database credentials, JWT secrets, and API keys. Create it locally from `secret.yaml.example` before applying.

---

## 4. Install ArgoCD

```bash
kubectl create namespace argocd
kubectl apply -n argocd --server-side --force-conflicts \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
# wait ~60s for all pods to be Running
```

---

## 5. Access ArgoCD UI (Optional)

For debugging and monitoring:

```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d
```

Login at `https://localhost:8080` with username `admin`. Connect the GitHub repo under Settings → Repositories.

---

## 6. Deploy the Application

```bash
kubectl apply -f infra/argocd/application.yaml
```

ArgoCD takes over from here — it watches `infra/k8s/` and automatically applies the ConfigMap, database, backend, frontend, and ingress manifests. Any future change pushed to `main` syncs automatically.

### Verify Pods

```bash
kubectl get pods -n commit
```

All 7 pods should reach `Running`:
- postgres (1)
- backend (2)
- frontend-web (2)
- frontend-app (2)

### Verify TLS

```bash
kubectl get certificate -n commit
```

Should show `READY: True` for `commit-tls` within a minute or two. If it stays `False`, see the runbook for cert-manager troubleshooting.

---

## 7. Monitoring Setup

Installs Prometheus, Grafana, Loki, and Alertmanager via Helm. See [Observability](observability.md) for full configuration details.

```bash
# Add Helm repos
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Create namespace
kubectl create namespace monitoring

# Apply secrets manually (never in git)
kubectl apply -f infra/monitoring/alertmanager-secret.yaml
kubectl apply -f infra/monitoring/grafana-admin-secret.yaml

# Install kube-prometheus-stack
helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --values infra/monitoring/kube-prometheus-stack-values.yaml

# Install Loki
helm install loki grafana/loki \
  --namespace monitoring \
  --values infra/monitoring/loki-values.yaml

# Install Promtail (log shipper)
helm install promtail grafana/promtail \
  --namespace monitoring \
  --set "config.clients[0].url=http://loki.monitoring.svc.cluster.local:3100/loki/api/v1/push"

# Deploy monitoring ArgoCD application
kubectl apply -f infra/argocd/monitoring-application.yaml
```

---

## What ArgoCD Manages vs What You Manage Manually

| ArgoCD manages automatically | You manage manually |
|---|---|
| ConfigMap | `infra/k8s/config/secret.yaml` (gitignored) |
| PostgreSQL StatefulSet + Services | `infra/monitoring/alertmanager-secret.yaml` (gitignored) |
| Backend Deployment + Service | `infra/monitoring/grafana-admin-secret.yaml` (gitignored) |
| Frontend web + app Deployments + Services | `infra/k8s/storage/` — one-time cluster install |
| Ingress | `infra/k8s/cert-manager/` — one-time cluster install |
| Monitoring Helm values changes | Helm installs for kube-prometheus-stack and Loki — one-time per cluster |

---

## DNS Records (Cloudflare)

Add A records pointing to the worker node's Elastic IP (DNS only — grey cloud, not proxied):

| Hostname | Target |
|----------|--------|
| `commit.rahulkoju.com.np` | worker public IP |
| `app.commit.rahulkoju.com.np` | worker public IP |
| `grafana.commit.rahulkoju.com.np` | worker public IP |

---

## Day-to-Day Operation: EC2 Stop/Start

The cluster runs on a schedule (start 7:50am, stop midnight Asia/Kathmandu) managed by AWS EventBridge Scheduler and a Lambda function. This stop/start cycle preserves the cluster state because AWS retains the private IPs and EBS volumes:

- **Cluster state:** Kubernetes, etcd, and all PVC data survive the stop/start cycle intact
- **No re-provisioning needed:** no `rke up`, no Ansible, no `terraform apply` — the cluster resumes as-is
- **Manual override:** use `workflow_dispatch` in `.github/workflows/cluster-schedule.yaml` with `action: start` or `action: stop` for unscheduled restarts or on-demand demos

See [CI/CD & GitOps](cicd.md#aws-eventbridge-scheduler) for implementation details.

## Full Redeployment After `terraform destroy`

Only necessary when re-provisioning from scratch (new VPC, new instances). Since `terraform apply` creates entirely new EC2 instances with new private IPs, RKE's local state and TLS certificates from the previous cluster must be cleared first:

```bash
# 1. Delete local RKE state files
rm -f infra/rke/cluster.rkestate
rm -f infra/rke/kube_config_cluster.yml

# 2. Clean up stale certificates and etcd data on the new control plane node
ssh -i ~/.ssh/commit-key.pem ubuntu@<CONTROL_PLANE_IP>
sudo docker rm -f etcd etcd-rolling-snapshots 2>/dev/null; true
sudo rm -rf /etc/kubernetes/ssl/
sudo rm -rf /var/lib/etcd/
exit

# 3. Update cluster.yml and hosts.ini with new IPs, then rke up
```

---

## Frontend Image Builds

Handled automatically by GitHub Actions on every push to `main` (see [CI/CD & GitOps](cicd.md)). Manual rebuild if needed:

```bash
cd frontend

docker build -f Dockerfile.web \
  --build-arg VITE_API_URL=https://commit.rahulkoju.com.np \
  --build-arg VITE_APP_URL=https://app.commit.rahulkoju.com.np \
  --build-arg VITE_WEB_URL=https://commit.rahulkoju.com.np \
  -t rahulkoju/commit-web:latest .

docker build -f Dockerfile.app \
  --build-arg VITE_API_URL=https://app.commit.rahulkoju.com.np \
  --build-arg VITE_APP_URL=https://app.commit.rahulkoju.com.np \
  --build-arg VITE_WEB_URL=https://commit.rahulkoju.com.np \
  -t rahulkoju/commit-app:latest .

docker push rahulkoju/commit-web:latest
docker push rahulkoju/commit-app:latest
```
