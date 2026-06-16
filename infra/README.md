# Commit App — Deployment Guide

## Apply Order (Fresh Infrastructure)

### 1. Infrastructure

```bash
cd infra/terraform && terraform apply -auto-approve
cd infra/ansible && ansible-playbook playbooks/setup-nodes.yml
cd infra/rke && rm -f cluster.rkestate kube_config_cluster.yml && rke up
export KUBECONFIG=/path/to/infra/rke/kube_config_cluster.yml
```

### 2. Label worker node

```bash
kubectl get nodes  # get worker node name
kubectl label node <worker-node-name> node-role.kubernetes.io/worker=true
```

### 3. One-time cluster setup (manual)

```bash
kubectl apply -f infra/k8s/namespaces/
kubectl apply -f infra/k8s/storage/
kubectl apply -f infra/k8s/cert-manager/cert-manager.yaml
# wait ~30s
kubectl apply -f infra/k8s/cert-manager/clusterissuer.yaml
kubectl apply -f infra/k8s/config/secret.yaml          # sensitive, never in git
```

### 4. Install ArgoCD

```bash
kubectl create namespace argocd
kubectl apply -n argocd --server-side --force-conflicts -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
# wait ~60s for pods to be ready
```

### 5. Access ArgoCD UI (optional — for debugging and monitoring)

```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
# get password:
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
# login at https://localhost:8080
# Settings → Repositories → Connect Repo → add GitHub repo with PAT
```

### 6. Deploy app via ArgoCD

```bash
kubectl apply -f infra/argocd/application.yaml
# ArgoCD automatically syncs all manifests from infra/k8s/
```

### 7. Monitoring setup

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

# Deploy monitoring ArgoCD application
kubectl apply -f infra/argocd/monitoring-application.yaml
```

---

## ArgoCD manages (automatic)

- configmap
- database (StatefulSet, Services)
- backend (Deployment, Service)
- frontend web + app (Deployments, Services)
- ingress
- monitoring values changes (via monitoring-application.yaml)

## You manage manually

- `infra/k8s/config/secret.yaml` — app secrets, never in git
- `infra/monitoring/alertmanager-secret.yaml` — Gmail app password, never in git
- `infra/monitoring/grafana-admin-secret.yaml` — Grafana admin password, never in git
- `infra/k8s/storage/` — one-time cluster install
- `infra/k8s/cert-manager/` — one-time cluster install
- Helm installs for kube-prometheus-stack and Loki — one-time per cluster

---

## Redeployment After terraform destroy

Before running `rke up` on fresh infrastructure always:

1. Delete local RKE state files:

```bash
rm -f infra/rke/cluster.rkestate
rm -f infra/rke/kube_config_cluster.yml
```

2. Clean up old certificates on control plane:

```bash
ssh -i ~/.ssh/commit-key.pem ubuntu@<CONTROL_PLANE_IP>
sudo docker rm -f etcd etcd-rolling-snapshots 2>/dev/null; true
sudo rm -rf /etc/kubernetes/ssl/
sudo rm -rf /var/lib/etcd/
exit
```

3. Then run `rke up`

---

## DNS Records (Cloudflare)

Point all to worker node Elastic IP (DNS only, grey cloud):

- `commit.rahulkoju.com.np` → worker public IP
- `app.commit.rahulkoju.com.np` → worker public IP
- `grafana.commit.rahulkoju.com.np` → worker public IP

---

## Frontend Images

Handled automatically by GitHub Actions CI on push to main.
Manual rebuild if needed:

```bash
# web
docker build -f Dockerfile.web \
  --build-arg VITE_API_URL=https://commit.rahulkoju.com.np \
  --build-arg VITE_APP_URL=https://app.commit.rahulkoju.com.np \
  --build-arg VITE_WEB_URL=https://commit.rahulkoju.com.np \
  -t rahulkoju/commit-web:latest .

# app
docker build -f Dockerfile.app \
  --build-arg VITE_API_URL=https://app.commit.rahulkoju.com.np \
  --build-arg VITE_APP_URL=https://app.commit.rahulkoju.com.np \
  --build-arg VITE_WEB_URL=https://commit.rahulkoju.com.np \
  -t rahulkoju/commit-app:latest .
```
