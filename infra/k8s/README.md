# Kubernetes Manifests

## Apply Order

```bash
kubectl apply -f namespaces/
kubectl apply -f storage/
kubectl apply -f cert-manager/cert-manager.yaml
kubectl apply -f cert-manager/clusterissuer.yaml  # wait ~30s after cert-manager
kubectl apply -f config/
kubectl apply -f database/
kubectl apply -f backend/
kubectl apply -R -f frontend/
kubectl apply -f ingress/
```

## Frontend Images

Must be built with production VITE env vars:

```bash
docker build -f Dockerfile.web \
  --build-arg VITE_API_URL=https://commit.rahulkoju.com.np \
  --build-arg VITE_APP_URL=https://app.commit.rahulkoju.com.np \
  --build-arg VITE_WEB_URL=https://commit.rahulkoju.com.np \
  -t rahulkoju/commit-web:latest .
```

```bash
docker build -f Dockerfile.app \
  --build-arg VITE_API_URL=https://app.commit.rahulkoju.com.np \
  --build-arg VITE_APP_URL=https://app.commit.rahulkoju.com.np \
  --build-arg VITE_WEB_URL=https://commit.rahulkoju.com.np \
  -t rahulkoju/commit-app:latest .
```

## Redeploying After terraform destroy

Before running `rke up` on fresh infrastructure always:

1. Delete local RKE state files:

```bash
   rm -f infra/rke/cluster.rkestate
   rm -f infra/rke/kube_config_cluster.yml
```

2. Clean up old certificates and etcd data on control plane node:

```bash
   ssh -i ~/.ssh/commit-key.pem ubuntu@<CONTROL_PLANE_IP>
   sudo docker rm -f etcd etcd-rolling-snapshots 2>/dev/null; true
   sudo rm -rf /etc/kubernetes/ssl/
   sudo rm -rf /var/lib/etcd/
   exit
```

3. Then run `rke up`
