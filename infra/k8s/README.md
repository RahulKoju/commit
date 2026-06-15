# Kubernetes Manifests

## Apply Order (Fresh Infrastructure)

### 1. Infrastructure

```bash
cd infra/terraform && terraform apply -auto-approve
cd infra/ansible && ansible-playbook playbooks/setup-nodes.yml
cd infra/rke && rm -f cluster.rkestate kube_config_cluster.yml && rke up
export KUBECONFIG=/path/to/infra/rke/kube_config_cluster.yml
```

### 2. One-time cluster setup (manual)

```bash
kubectl apply -f infra/k8s/namespaces/
kubectl apply -f infra/k8s/storage/
kubectl apply -f infra/k8s/cert-manager/cert-manager.yaml
# wait ~30s
kubectl apply -f infra/k8s/cert-manager/clusterissuer.yaml
kubectl apply -f infra/k8s/config/secret.yaml  # sensitive, never in git
```

### 3. Install ArgoCD

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
# wait ~60s for pods to be ready
```

### 4. Access ArgoCD UI (optional — for debugging and monitoring)

```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
# get password:
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
# login at https://localhost:8080
# Settings → Repositories → Connect Repo → add GitHub repo with PAT
```

### 5. Deploy app via ArgoCD

```bash
kubectl apply -f infra/argocd/application.yaml
# ArgoCD automatically syncs all manifests from infra/k8s/
```

## ArgoCD manages (automatic)

- configmap
- database (StatefulSet, Services)
- backend (Deployment, Service)
- frontend web + app (Deployments, Services)
- ingress

## You manage manually

- `infra/k8s/config/secret.yaml` — never in git, apply after fresh infrastructure
- `infra/k8s/storage/` — one-time install
- `infra/k8s/cert-manager/` — one-time install

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

## Frontend Images

Must be rebuilt with production VITE env vars:

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

## DNS Records (Cloudflare)

Point to worker node Elastic IP:

- `commit.rahulkoju.com.np` → worker public IP
- `app.commit.rahulkoju.com.np` → worker public IP
